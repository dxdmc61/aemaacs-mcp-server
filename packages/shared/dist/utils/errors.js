/**
 * Error handling utilities for AEMaaCS MCP servers
 */
import { ErrorType } from '../types/aem.js';
import { MCPErrorCode } from '../types/mcp.js';
export class AEMException extends Error {
    constructor(message, code = ErrorType.UNKNOWN_ERROR, recoverable = false, retryAfter, details) {
        super(message);
        this.name = 'AEMException';
        this.code = code;
        this.recoverable = recoverable;
        this.retryable = recoverable; // alias for recoverable
        this.retryAfter = retryAfter;
        this.details = details;
    }
    toAEMError() {
        return {
            code: this.code,
            message: this.message,
            recoverable: this.recoverable,
            retryAfter: this.retryAfter,
            details: this.details
        };
    }
    toMCPError() {
        const mcpCode = this.getMCPErrorCode();
        return {
            code: mcpCode,
            message: this.message,
            data: {
                aemCode: this.code,
                recoverable: this.recoverable,
                retryAfter: this.retryAfter,
                details: this.details
            }
        };
    }
    getMCPErrorCode() {
        switch (this.code) {
            case ErrorType.VALIDATION_ERROR:
                return MCPErrorCode.INVALID_PARAMS;
            case ErrorType.NOT_FOUND_ERROR:
                return MCPErrorCode.METHOD_NOT_FOUND;
            case ErrorType.AUTHENTICATION_ERROR:
            case ErrorType.AUTHORIZATION_ERROR:
                return -32001; // Custom authentication error
            case ErrorType.NETWORK_ERROR:
            case ErrorType.TIMEOUT_ERROR:
                return -32002; // Custom network error
            case ErrorType.SERVER_ERROR:
                return MCPErrorCode.INTERNAL_ERROR;
            default:
                return MCPErrorCode.INTERNAL_ERROR;
        }
    }
}
export class ErrorHandler {
    static handleError(error, context) {
        if (error instanceof AEMException) {
            return error.toAEMError();
        }
        // Handle axios errors
        if (error.name === 'AxiosError') {
            return this.handleAxiosError(error, context);
        }
        // Handle validation errors
        if (error.name === 'ValidationError') {
            return {
                code: ErrorType.VALIDATION_ERROR,
                message: error.message,
                recoverable: false,
                details: { context }
            };
        }
        // Default error handling
        return {
            code: ErrorType.UNKNOWN_ERROR,
            message: error.message || 'An unknown error occurred',
            recoverable: false,
            details: {
                context,
                stack: error.stack
            }
        };
    }
    static handleAxiosError(error, context) {
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const data = error.response?.data;
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return {
                code: ErrorType.TIMEOUT_ERROR,
                message: 'Request timeout',
                recoverable: true,
                retryAfter: 5000,
                details: { context, originalError: error.message }
            };
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return {
                code: ErrorType.NETWORK_ERROR,
                message: 'Network connection failed',
                recoverable: true,
                retryAfter: 10000,
                details: { context, originalError: error.message }
            };
        }
        switch (status) {
            case 401:
                return {
                    code: ErrorType.AUTHENTICATION_ERROR,
                    message: 'Authentication failed',
                    recoverable: false,
                    details: { context, status, statusText, data }
                };
            case 403:
                return {
                    code: ErrorType.AUTHORIZATION_ERROR,
                    message: 'Access denied',
                    recoverable: false,
                    details: { context, status, statusText, data }
                };
            case 404:
                return {
                    code: ErrorType.NOT_FOUND_ERROR,
                    message: 'Resource not found',
                    recoverable: false,
                    details: { context, status, statusText, data }
                };
            case 400:
                return {
                    code: ErrorType.VALIDATION_ERROR,
                    message: 'Invalid request parameters',
                    recoverable: false,
                    details: { context, status, statusText, data }
                };
            case 429:
                return {
                    code: ErrorType.SERVER_ERROR,
                    message: 'Rate limit exceeded',
                    recoverable: true,
                    retryAfter: parseInt(error.response?.headers?.['retry-after']) * 1000 || 60000,
                    details: { context, status, statusText }
                };
            case 500:
            case 502:
            case 503:
            case 504:
                return {
                    code: ErrorType.SERVER_ERROR,
                    message: `Server error: ${statusText}`,
                    recoverable: true,
                    retryAfter: 30000,
                    details: { context, status, statusText, data }
                };
            default:
                return {
                    code: ErrorType.UNKNOWN_ERROR,
                    message: `HTTP ${status}: ${statusText}`,
                    recoverable: false,
                    details: { context, status, statusText, data }
                };
        }
    }
    static isRecoverable(error) {
        return error.recoverable;
    }
    static getRetryDelay(attempt, baseDelay = 1000, maxDelay = 30000) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        // Add jitter to prevent thundering herd
        return delay + Math.random() * 1000;
    }
}
export class RetryHandler {
    constructor(config) {
        this.config = config;
    }
    async executeWithRetry(operation, context) {
        let lastError;
        for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                const aemError = ErrorHandler.handleError(lastError, context);
                // Don't retry if error is not recoverable
                if (!aemError.recoverable) {
                    throw new AEMException(aemError.message, aemError.code, aemError.recoverable, aemError.retryAfter, aemError.details);
                }
                // Don't retry on last attempt
                if (attempt === this.config.maxAttempts - 1) {
                    break;
                }
                // Wait before retry
                const delay = aemError.retryAfter || ErrorHandler.getRetryDelay(attempt, this.config.baseDelay, this.config.maxDelay);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        // All retries exhausted
        const finalError = ErrorHandler.handleError(lastError, context);
        throw new AEMException(`Operation failed after ${this.config.maxAttempts} attempts: ${finalError.message}`, finalError.code, false, undefined, { ...finalError.details, attempts: this.config.maxAttempts });
    }
}
//# sourceMappingURL=errors.js.map