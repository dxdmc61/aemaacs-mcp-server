/**
 * HTTP REST API Handler for Read Server
 * Provides JSON-RPC 2.0 compliant endpoints for AEM read operations
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { ReadServerConfig } from '@aemaacs-mcp/shared';
export interface JSONRPCRequest {
    jsonrpc: '2.0';
    method: string;
    params?: any;
    id?: string | number;
}
export interface JSONRPCResponse {
    jsonrpc: '2.0';
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
    id?: string | number | null;
}
export declare class HTTPHandler {
    private app;
    private logger;
    private mcpHandler;
    private config;
    constructor(client: AEMHttpClient, config: ReadServerConfig);
    /**
     * Setup Express middleware
     */
    private setupMiddleware;
    /**
     * Setup Express routes
     */
    private setupRoutes;
    /**
     * Authentication middleware
     */
    private authMiddleware;
    /**
     * Handle JSON-RPC requests
     */
    private handleJSONRPC;
    /**
     * Handle tools.list JSON-RPC method
     */
    private handleToolsList;
    /**
     * Handle tools.call JSON-RPC method
     */
    private handleToolsCall;
    /**
     * Handle individual tool calls (REST-style)
     */
    private handleToolCall;
    /**
     * Error handling middleware
     */
    private errorHandler;
    /**
     * Start HTTP server
     */
    start(): Promise<void>;
}
//# sourceMappingURL=http-handler.d.ts.map