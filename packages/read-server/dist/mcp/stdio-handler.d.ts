/**
 * STDIO Protocol Handler for MCP Communication
 * Handles MCP protocol over STDIO for read server
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
export interface MCPMessage {
    jsonrpc: '2.0';
    id?: string | number;
    method?: string;
    params?: any;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}
export declare class STDIOHandler {
    private logger;
    private mcpHandler;
    private running;
    private initialized;
    private requestQueue;
    private maxRequestTimeout;
    constructor(client: AEMHttpClient);
    /**
     * Start STDIO handler
     */
    start(): void;
    /**
     * Stop STDIO handler
     */
    stop(): void;
    /**
     * Handle input from STDIN
     */
    private handleInput;
    /**
     * Process individual message
     */
    private processMessage;
    /**
     * Handle method calls
     */
    private handleMethodCall;
    /**
     * Handle initialize request
     */
    private handleInitialize;
    /**
     * Handle tools/list request
     */
    private handleToolsList;
    /**
     * Handle tools/call request
     */
    private handleToolsCall;
    /**
     * Handle streaming tool call
     */
    private handleStreamingToolCall;
    /**
     * Send response message
     */
    private sendResponse;
    /**
     * Send error response
     * Note: Only send error responses when we have a valid id
     * Per MCP spec, id:null is only for parse errors, but Cursor rejects it
     */
    private sendErrorResponse;
    /**
     * Send message to STDOUT
     */
    private sendMessage;
    /**
     * Handle STDIN end
     */
    private handleEnd;
    /**
     * Handle STDIN error
     */
    private handleError;
    /**
     * Clean up request queue
     */
    private cleanupRequestQueue;
    /**
     * Add request to queue for timeout tracking
     */
    private addRequestToQueue;
    /**
     * Remove request from queue
     */
    private removeRequestFromQueue;
    /**
     * Get handler statistics
     */
    getStats(): {
        running: boolean;
        initialized: boolean;
        pendingRequests: number;
        maxRequestTimeout: number;
    };
}
//# sourceMappingURL=stdio-handler.d.ts.map