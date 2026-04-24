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
    start(): void;
    stop(): void;
    private handleInput;
    private processMessage;
    private handleMethodCall;
    private handleInitialize;
    private handleToolsList;
    private handleToolsCall;
    private handleStreamingToolCall;
    private sendResponse;
    private sendErrorResponse;
    private sendMessage;
    private handleEnd;
    private handleError;
    private cleanupRequestQueue;
    private addRequestToQueue;
    private removeRequestFromQueue;
    getStats(): {
        running: boolean;
        initialized: boolean;
        pendingRequests: number;
        maxRequestTimeout: number;
    };
}
//# sourceMappingURL=stdio-handler.d.ts.map