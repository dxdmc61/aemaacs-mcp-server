/**
 * HTTP REST API Handler for Write Server
 * Provides JSON-RPC 2.0 compliant endpoints for AEM write operations with enhanced security
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { WriteServerConfig } from '@aemaacs-mcp/shared';
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
    constructor(client: AEMHttpClient, config: WriteServerConfig);
    /**
     * Setup Express middleware with enhanced security
     */
    private setupMiddleware;
    /**
     * Setup Express routes
     */
    private setupRoutes;
    /**
     * Enhanced authentication middleware for write operations
     */
    private authMiddleware;
    /**
     * Dangerous operation detection middleware
     */
    private dangerousOperationMiddleware;
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
     * Check if tool is dangerous
     */
    private isDangerousTool;
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