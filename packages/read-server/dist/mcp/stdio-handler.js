/**
 * STDIO Protocol Handler for MCP Communication
 * Handles MCP protocol over STDIO for read server
 */
import { Logger } from '@aemaacs-mcp/shared';
import { MCPHandler } from './mcp-handler.js';
export class STDIOHandler {
    constructor(client) {
        this.running = false;
        this.initialized = false;
        this.requestQueue = new Map();
        this.maxRequestTimeout = 30000; // 30 seconds
        this.logger = Logger.getInstance();
        this.mcpHandler = new MCPHandler(client);
        // Clean up request queue periodically
        setInterval(() => this.cleanupRequestQueue(), 60000); // Every minute
    }
    /**
     * Start STDIO handler
     */
    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.logger.info('Starting MCP STDIO handler');
        // Set up STDIO handling
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', this.handleInput.bind(this));
        process.stdin.on('end', this.handleEnd.bind(this));
        process.stdin.on('error', this.handleError.bind(this));
        // NOTE: Do NOT send 'initialized' notification here!
        // According to MCP protocol:
        // 1. Client sends 'initialize' request
        // 2. Server responds with capabilities
        // 3. Client sends 'initialized' notification
        // The server waits for client's initialize request
    }
    /**
     * Stop STDIO handler
     */
    stop() {
        if (!this.running) {
            return;
        }
        this.running = false;
        this.logger.info('Stopping MCP STDIO handler');
        // Clean up STDIO listeners
        process.stdin.removeAllListeners('data');
        process.stdin.removeAllListeners('end');
        process.stdin.removeAllListeners('error');
    }
    /**
     * Handle input from STDIN
     */
    async handleInput(data) {
        try {
            const lines = data.toString().trim().split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    await this.processMessage(line.trim());
                }
            }
        }
        catch (error) {
            this.logger.error('Error handling STDIO input', error);
        }
    }
    /**
     * Process individual message
     */
    async processMessage(messageStr) {
        try {
            const message = JSON.parse(messageStr);
            this.logger.debug('Received MCP message', { method: message.method, id: message.id });
            // Handle different message types
            if (message.method) {
                await this.handleMethodCall(message);
            }
            else if (message.result !== undefined || message.error !== undefined) {
                // This is a response to a request we sent - log it
                this.logger.debug('Received response', { id: message.id, hasError: !!message.error });
            }
        }
        catch (error) {
            this.logger.error('Error processing MCP message', error, { messageStr });
            // Send error response only if we can parse the ID
            try {
                const partialMessage = JSON.parse(messageStr);
                if (partialMessage.id !== undefined && partialMessage.id !== null) {
                    this.sendErrorResponse(partialMessage.id, -32700, 'Parse error');
                }
                // If no valid id, just log the error - don't send response with null id
            }
            catch {
                // Can't even parse for ID, just log the error
                this.logger.error('Cannot parse message for ID, skipping error response');
            }
        }
    }
    /**
     * Handle method calls
     */
    async handleMethodCall(message) {
        const { method, params, id } = message;
        // Add request to queue for timeout tracking (except for ping)
        if (method !== 'ping' && id !== undefined) {
            this.addRequestToQueue(id);
        }
        try {
            switch (method) {
                case 'initialize':
                    await this.handleInitialize(params, id);
                    break;
                case 'initialized':
                case 'notifications/initialized':
                    // Client notification after initialize - no response needed
                    this.logger.debug('Received initialized notification from client');
                    break;
                case 'tools/list':
                    await this.handleToolsList(id);
                    break;
                case 'tools/call':
                    await this.handleToolsCall(params, id);
                    break;
                case 'ping':
                    this.sendResponse(id, { status: 'pong' });
                    break;
                default:
                    // Only send error for requests (with id), not for notifications
                    if (id !== undefined) {
                        this.sendErrorResponse(id, -32601, `Method not found: ${method}`);
                    }
                    else {
                        this.logger.debug(`Ignoring unknown notification: ${method}`);
                    }
                    break;
            }
        }
        catch (error) {
            this.logger.error('Error handling method call', error, { method, id });
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.sendErrorResponse(id, -32603, `Internal error: ${errorMessage}`);
        }
        finally {
            // Remove request from queue
            if (id !== undefined) {
                this.removeRequestFromQueue(id);
            }
        }
    }
    /**
     * Handle initialize request
     */
    async handleInitialize(params, id) {
        this.logger.info('Handling MCP initialize request', { params });
        this.initialized = true;
        const response = {
            protocolVersion: '2025-11-25',
            capabilities: {
                tools: {},
                resources: {
                    subscribe: false,
                    listChanged: false
                },
                prompts: {
                    listChanged: false
                }
            },
            serverInfo: {
                name: 'aem-read-server',
                version: '1.0.0',
                description: 'AEM as a Cloud Service Read Operations MCP Server'
            }
        };
        this.sendResponse(id, response);
    }
    /**
     * Handle tools/list request
     */
    async handleToolsList(id) {
        this.logger.debug('Handling tools/list request');
        const tools = this.mcpHandler.getTools();
        this.sendResponse(id, { tools });
    }
    /**
     * Handle tools/call request
     */
    async handleToolsCall(params, id) {
        this.logger.debug('Handling tools/call request', { toolName: params?.name });
        if (!params || !params.name) {
            this.sendErrorResponse(id, -32602, 'Invalid params: tool name is required');
            return;
        }
        // Check if this is a streaming request
        const isStreaming = params.stream === true;
        if (isStreaming) {
            await this.handleStreamingToolCall(params, id);
            return;
        }
        const request = {
            method: 'tools/call',
            params: {
                name: params.name,
                arguments: params.arguments || {}
            }
        };
        try {
            const response = await this.mcpHandler.executeTool(request);
            if (response.isError) {
                this.sendErrorResponse(id, -32603, response.content?.[0]?.text || 'Tool execution failed');
            }
            else {
                this.sendResponse(id, response);
            }
        }
        catch (error) {
            this.logger.error('Error executing tool', error, { toolName: params.name });
            this.sendErrorResponse(id, -32603, `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Handle streaming tool call
     */
    async handleStreamingToolCall(params, id) {
        this.logger.debug('Handling streaming tool call', { toolName: params?.name });
        const request = {
            method: 'tools/call',
            params: {
                name: params.name,
                arguments: params.arguments || {}
            }
        };
        try {
            // Send initial response indicating streaming has started
            this.sendResponse(id, {
                streaming: true,
                status: 'started'
            });
            // Execute tool with streaming support
            const response = await this.mcpHandler.executeTool(request);
            if (response.isError) {
                this.sendErrorResponse(id, -32603, response.content?.[0]?.text || 'Streaming tool execution failed');
                return;
            }
            // For large responses, stream the content in chunks
            if (response.content && response.content.length > 0) {
                const content = response.content[0]?.text || '';
                const chunkSize = 1024; // 1KB chunks
                for (let i = 0; i < content.length; i += chunkSize) {
                    const chunk = content.slice(i, i + chunkSize);
                    this.sendResponse(id, {
                        streaming: true,
                        status: 'progress',
                        chunk: chunk,
                        progress: {
                            current: i + chunkSize,
                            total: content.length,
                            percentage: Math.round(((i + chunkSize) / content.length) * 100)
                        }
                    });
                    // Small delay to prevent overwhelming the client
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }
            // Send final response
            this.sendResponse(id, {
                streaming: true,
                status: 'completed',
                result: response
            });
        }
        catch (error) {
            this.logger.error('Error executing streaming tool', error, { toolName: params.name });
            this.sendErrorResponse(id, -32603, `Streaming tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Send response message
     */
    sendResponse(id, result) {
        if (id === undefined) {
            this.logger.error('Cannot send response without id');
            return;
        }
        const message = {
            jsonrpc: '2.0',
            id,
            result
        };
        this.sendMessage(message);
    }
    /**
     * Send error response
     * Note: Only send error responses when we have a valid id
     * Per MCP spec, id:null is only for parse errors, but Cursor rejects it
     */
    sendErrorResponse(id, code, errorMessage, data) {
        // Don't send error responses with null/undefined id - Cursor rejects them
        if (id === null || id === undefined) {
            this.logger.warn(`Cannot send error response without valid id: ${errorMessage} (code: ${code})`);
            return;
        }
        const response = {
            jsonrpc: '2.0',
            id,
            error: {
                code,
                message: errorMessage,
                data
            }
        };
        this.sendMessage(response);
    }
    /**
     * Send message to STDOUT
     */
    sendMessage(message) {
        try {
            const messageStr = JSON.stringify(message);
            process.stdout.write(messageStr + '\n');
            this.logger.debug('Sent MCP message', {
                method: message.method,
                id: message.id,
                hasError: !!message.error
            });
        }
        catch (error) {
            this.logger.error('Error sending MCP message', error);
        }
    }
    /**
     * Handle STDIN end
     */
    handleEnd() {
        this.logger.info('STDIN ended, stopping MCP handler');
        this.stop();
        process.exit(0);
    }
    /**
     * Handle STDIN error
     */
    handleError(error) {
        this.logger.error('STDIN error', error);
        this.stop();
        process.exit(1);
    }
    /**
     * Clean up request queue
     */
    cleanupRequestQueue() {
        const now = Date.now();
        const expiredRequests = [];
        for (const [id, requestInfo] of this.requestQueue.entries()) {
            if (now - requestInfo.timestamp > this.maxRequestTimeout) {
                expiredRequests.push(id);
                clearTimeout(requestInfo.timeout);
            }
        }
        for (const id of expiredRequests) {
            this.requestQueue.delete(id);
            this.sendErrorResponse(id, -32603, 'Request timeout');
        }
        if (expiredRequests.length > 0) {
            this.logger.debug(`Cleaned up ${expiredRequests.length} expired requests`);
        }
    }
    /**
     * Add request to queue for timeout tracking
     */
    addRequestToQueue(id) {
        const timeout = setTimeout(() => {
            this.requestQueue.delete(id);
            this.sendErrorResponse(id, -32603, 'Request timeout');
        }, this.maxRequestTimeout);
        this.requestQueue.set(id, {
            timestamp: Date.now(),
            timeout
        });
    }
    /**
     * Remove request from queue
     */
    removeRequestFromQueue(id) {
        const requestInfo = this.requestQueue.get(id);
        if (requestInfo) {
            clearTimeout(requestInfo.timeout);
            this.requestQueue.delete(id);
        }
    }
    /**
     * Get handler statistics
     */
    getStats() {
        return {
            running: this.running,
            initialized: this.initialized,
            pendingRequests: this.requestQueue.size,
            maxRequestTimeout: this.maxRequestTimeout
        };
    }
}
//# sourceMappingURL=stdio-handler.js.map