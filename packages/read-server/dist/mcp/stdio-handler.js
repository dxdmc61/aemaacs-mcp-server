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
        setInterval(() => this.cleanupRequestQueue(), 60000);
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.logger.info('Starting MCP STDIO handler');
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', this.handleInput.bind(this));
        process.stdin.on('end', this.handleEnd.bind(this));
        process.stdin.on('error', this.handleError.bind(this));
    }
    stop() {
        if (!this.running)
            return;
        this.running = false;
        this.logger.info('Stopping MCP STDIO handler');
        process.stdin.removeAllListeners('data');
        process.stdin.removeAllListeners('end');
        process.stdin.removeAllListeners('error');
    }
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
    async processMessage(messageStr) {
        try {
            const message = JSON.parse(messageStr);
            this.logger.debug('Received MCP message', { method: message.method, id: message.id });
            if (message.method) {
                await this.handleMethodCall(message);
            }
            else if (message.result !== undefined || message.error !== undefined) {
                this.logger.debug('Received response', { id: message.id, hasError: !!message.error });
            }
        }
        catch (error) {
            this.logger.error('Error processing MCP message', error, { messageStr });
            try {
                const partialMessage = JSON.parse(messageStr);
                if (partialMessage.id !== undefined && partialMessage.id !== null) {
                    this.sendErrorResponse(partialMessage.id, -32700, 'Parse error');
                }
            }
            catch {
                this.logger.error('Cannot parse message for ID, skipping error response');
            }
        }
    }
    async handleMethodCall(message) {
        const { method, params, id } = message;
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
            if (id !== undefined) {
                this.removeRequestFromQueue(id);
            }
        }
    }
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
    async handleToolsList(id) {
        this.logger.debug('Handling tools/list request');
        const tools = this.mcpHandler.getTools();
        this.sendResponse(id, { tools });
    }
    async handleToolsCall(params, id) {
        this.logger.debug('Handling tools/call request', { toolName: params?.name });
        if (!params || !params.name) {
            this.sendErrorResponse(id, -32602, 'Invalid params: tool name is required');
            return;
        }
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
            this.sendResponse(id, {
                streaming: true,
                status: 'started'
            });
            const response = await this.mcpHandler.executeTool(request);
            if (response.isError) {
                this.sendErrorResponse(id, -32603, response.content?.[0]?.text || 'Streaming tool execution failed');
                return;
            }
            if (response.content && response.content.length > 0) {
                const content = response.content[0]?.text || '';
                const chunkSize = 1024;
                for (let i = 0; i < content.length; i += chunkSize) {
                    const chunk = content.slice(i, i + chunkSize);
                    this.sendResponse(id, {
                        streaming: true,
                        status: 'progress',
                        chunk,
                        progress: {
                            current: i + chunkSize,
                            total: content.length,
                            percentage: Math.round(((i + chunkSize) / content.length) * 100)
                        }
                    });
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }
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
    sendErrorResponse(id, code, errorMessage, data) {
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
    sendMessage(message) {
        try {
            const messageStr = JSON.stringify(message);
            process.stdout.write(`${messageStr}\n`);
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
    handleEnd() {
        this.logger.info('STDIN ended, stopping MCP handler');
        this.stop();
        process.exit(0);
    }
    handleError(error) {
        this.logger.error('STDIN error', error);
        this.stop();
        process.exit(1);
    }
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
    removeRequestFromQueue(id) {
        const requestInfo = this.requestQueue.get(id);
        if (requestInfo) {
            clearTimeout(requestInfo.timeout);
            this.requestQueue.delete(id);
        }
    }
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