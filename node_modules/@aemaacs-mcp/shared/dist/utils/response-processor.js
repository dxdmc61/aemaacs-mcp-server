/**
 * Response processing utilities for AEMaaCS operations
 */
import { ErrorType } from '../types/aem.js';
import { Logger } from './logger.js';
import { AEMException } from './errors.js';
import { randomUUID } from 'crypto';
export class ResponseProcessor {
    constructor() {
        this.logger = Logger.getInstance();
    }
    /**
     * Process successful AEM response
     */
    processSuccess(data, requestId, duration, cached, options) {
        const opts = {
            includeMetadata: true,
            sanitizeOutput: true,
            formatForMCP: false,
            ...options
        };
        let processedData = data;
        // Sanitize output if requested
        if (opts.sanitizeOutput) {
            processedData = this.sanitizeOutput(data);
        }
        const response = {
            success: true,
            data: processedData
        };
        // Add metadata if requested
        if (opts.includeMetadata) {
            response.metadata = {
                timestamp: new Date(),
                requestId: requestId || randomUUID(),
                duration: duration || 0,
                cached
            };
        }
        return response;
    }
    /**
     * Process error response
     */
    processError(error, requestId, duration, options) {
        const opts = {
            includeMetadata: true,
            sanitizeOutput: true,
            formatForMCP: false,
            ...options
        };
        let aemError;
        if (error instanceof AEMException) {
            aemError = error.toAEMError();
        }
        else {
            // Convert generic error to AEMError
            aemError = {
                code: ErrorType.UNKNOWN_ERROR,
                message: error.message || 'An unknown error occurred',
                recoverable: false,
                details: opts.sanitizeOutput ? undefined : { stack: error.stack }
            };
        }
        const response = {
            success: false,
            error: aemError
        };
        // Add metadata if requested
        if (opts.includeMetadata) {
            response.metadata = {
                timestamp: new Date(),
                requestId: requestId || randomUUID(),
                duration: duration || 0
            };
        }
        // Log error
        this.logger.error('AEM operation failed', error, {
            requestId: response.metadata?.requestId,
            errorCode: aemError.code,
            recoverable: aemError.recoverable
        });
        return response;
    }
    /**
     * Convert AEM response to MCP response
     */
    toMCPResponse(aemResponse, id, formatContent) {
        if (aemResponse.success && aemResponse.data !== undefined) {
            let content;
            if (formatContent) {
                content = formatContent(aemResponse.data);
            }
            else {
                // Default formatting
                content = [{
                        type: 'text',
                        text: typeof aemResponse.data === 'string'
                            ? aemResponse.data
                            : JSON.stringify(aemResponse.data, null, 2)
                    }];
            }
            return {
                jsonrpc: '2.0',
                id,
                result: {
                    content,
                    isError: false
                }
            };
        }
        else {
            // Error response
            const error = aemResponse.error;
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: this.getJSONRPCErrorCode(error.code),
                    message: error.message,
                    data: {
                        aemCode: error.code,
                        recoverable: error.recoverable,
                        retryAfter: error.retryAfter,
                        details: error.details
                    }
                }
            };
        }
    }
    /**
     * Process AEMaaCS-specific response formats
     */
    processAEMResponse(rawResponse, operation) {
        // Handle different AEMaaCS response formats
        if (this.isAEMErrorResponse(rawResponse)) {
            throw this.createAEMExceptionFromResponse(rawResponse, operation);
        }
        // Handle package manager responses
        if (operation.includes('package') && rawResponse.results) {
            return this.processPackageResponse(rawResponse);
        }
        // Handle query builder responses
        if (rawResponse.success !== undefined && rawResponse.hits !== undefined) {
            return this.processQueryBuilderResponse(rawResponse);
        }
        // Handle workflow responses
        if (rawResponse.workflowInstances || rawResponse.workflowModels) {
            return this.processWorkflowResponse(rawResponse);
        }
        // Handle replication responses
        if (rawResponse.agents || rawResponse.distributionAgents) {
            return this.processReplicationResponse(rawResponse);
        }
        // Default processing
        return rawResponse;
    }
    /**
     * Sanitize output data
     */
    sanitizeOutput(data) {
        if (data === null || data === undefined) {
            return data;
        }
        if (typeof data === 'string') {
            // Remove potentially sensitive information
            return data
                .replace(/password["\s]*[:=]["\s]*[^"\s,}]*/gi, 'password":"***"')
                .replace(/token["\s]*[:=]["\s]*[^"\s,}]*/gi, 'token":"***"')
                .replace(/secret["\s]*[:=]["\s]*[^"\s,}]*/gi, 'secret":"***"');
        }
        if (Array.isArray(data)) {
            return data.map(item => this.sanitizeOutput(item));
        }
        if (typeof data === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(data)) {
                // Remove sensitive keys
                if (this.isSensitiveKey(key)) {
                    sanitized[key] = '***';
                }
                else {
                    sanitized[key] = this.sanitizeOutput(value);
                }
            }
            return sanitized;
        }
        return data;
    }
    /**
     * Check if key contains sensitive information
     */
    isSensitiveKey(key) {
        const sensitiveKeys = [
            'password', 'passwd', 'pwd',
            'token', 'accessToken', 'refreshToken',
            'secret', 'clientSecret', 'privateKey',
            'apiKey', 'authorization', 'auth',
            'cookie', 'session'
        ];
        return sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()));
    }
    /**
     * Check if response indicates an AEM error
     */
    isAEMErrorResponse(response) {
        return (response.success === false ||
            response.error ||
            response.status === 'error' ||
            (response.status && response.status >= 400) ||
            response.exception ||
            response.message?.includes('error'));
    }
    /**
     * Create AEMException from AEM error response
     */
    createAEMExceptionFromResponse(response, operation) {
        let code = ErrorType.SERVER_ERROR;
        let message = 'AEM operation failed';
        let recoverable = false;
        let retryAfter;
        // Extract error information from different response formats
        if (response.error) {
            message = response.error.message || response.error;
            code = this.mapAEMErrorCode(response.error.code || response.error.type);
        }
        else if (response.exception) {
            message = response.exception.message || response.exception;
            code = ErrorType.SERVER_ERROR;
        }
        else if (response.message) {
            message = response.message;
        }
        // Determine if error is recoverable
        recoverable = this.isRecoverableError(code, response);
        // Extract retry-after if available
        if (response.retryAfter || response['retry-after']) {
            retryAfter = parseInt(response.retryAfter || response['retry-after']) * 1000;
        }
        return new AEMException(`${operation}: ${message}`, code, recoverable, retryAfter, { originalResponse: response });
    }
    /**
     * Map AEM error codes to internal error types
     */
    mapAEMErrorCode(aemCode) {
        const codeMap = {
            'javax.jcr.AccessDeniedException': ErrorType.AUTHORIZATION_ERROR,
            'javax.jcr.security.AccessControlException': ErrorType.AUTHORIZATION_ERROR,
            'javax.jcr.PathNotFoundException': ErrorType.NOT_FOUND_ERROR,
            'javax.jcr.ItemNotFoundException': ErrorType.NOT_FOUND_ERROR,
            'javax.jcr.InvalidItemStateException': ErrorType.VALIDATION_ERROR,
            'javax.jcr.RepositoryException': ErrorType.SERVER_ERROR,
            'java.net.SocketTimeoutException': ErrorType.TIMEOUT_ERROR,
            'java.net.ConnectException': ErrorType.NETWORK_ERROR,
            'java.io.IOException': ErrorType.NETWORK_ERROR
        };
        return codeMap[aemCode] || ErrorType.SERVER_ERROR;
    }
    /**
     * Determine if error is recoverable
     */
    isRecoverableError(code, response) {
        const recoverableErrors = [
            ErrorType.NETWORK_ERROR,
            ErrorType.TIMEOUT_ERROR,
            ErrorType.SERVER_ERROR
        ];
        if (recoverableErrors.includes(code)) {
            return true;
        }
        // Check HTTP status codes
        const status = response.status || response.statusCode;
        if (status) {
            return status >= 500 || status === 429; // Server errors and rate limiting
        }
        return false;
    }
    /**
     * Get JSON-RPC error code from AEM error code
     */
    getJSONRPCErrorCode(aemCode) {
        switch (aemCode) {
            case ErrorType.VALIDATION_ERROR:
                return -32602; // Invalid params
            case ErrorType.NOT_FOUND_ERROR:
                return -32601; // Method not found
            case ErrorType.AUTHENTICATION_ERROR:
            case ErrorType.AUTHORIZATION_ERROR:
                return -32001; // Custom authentication error
            case ErrorType.NETWORK_ERROR:
            case ErrorType.TIMEOUT_ERROR:
                return -32002; // Custom network error
            case ErrorType.SERVER_ERROR:
                return -32603; // Internal error
            default:
                return -32603; // Internal error
        }
    }
    /**
     * Process package manager response
     */
    processPackageResponse(response) {
        if (response.results) {
            return {
                packages: response.results.map((pkg) => ({
                    name: pkg.name,
                    group: pkg.group,
                    version: pkg.version,
                    path: pkg.path,
                    size: pkg.size,
                    created: new Date(pkg.created),
                    lastModified: new Date(pkg.lastModified),
                    installed: pkg.installed === 'true',
                    builtWith: pkg.builtWith
                }))
            };
        }
        return response;
    }
    /**
     * Process query builder response
     */
    processQueryBuilderResponse(response) {
        return {
            success: response.success,
            total: response.total,
            offset: response.offset,
            hits: response.hits?.map((hit) => ({
                path: hit.path,
                title: hit.title,
                excerpt: hit.excerpt,
                lastModified: hit.lastModified ? new Date(hit.lastModified) : undefined,
                score: hit.score
            })) || []
        };
    }
    /**
     * Process workflow response
     */
    processWorkflowResponse(response) {
        if (response.workflowInstances) {
            return {
                instances: response.workflowInstances.map((instance) => ({
                    id: instance.id,
                    modelPath: instance.model,
                    payloadPath: instance.payload,
                    state: instance.state,
                    startTime: new Date(instance.startTime),
                    endTime: instance.endTime ? new Date(instance.endTime) : undefined,
                    initiator: instance.initiator
                }))
            };
        }
        if (response.workflowModels) {
            return {
                models: response.workflowModels.map((model) => ({
                    path: model.path,
                    title: model.title,
                    description: model.description,
                    version: model.version
                }))
            };
        }
        return response;
    }
    /**
     * Process replication response
     */
    processReplicationResponse(response) {
        if (response.agents || response.distributionAgents) {
            const agents = response.agents || response.distributionAgents;
            return {
                agents: agents.map((agent) => ({
                    name: agent.name,
                    title: agent.title,
                    description: agent.description,
                    enabled: agent.enabled,
                    valid: agent.valid,
                    queue: agent.queue
                }))
            };
        }
        return response;
    }
}
/**
 * Global response processor instance
 */
export const responseProcessor = new ResponseProcessor();
//# sourceMappingURL=response-processor.js.map