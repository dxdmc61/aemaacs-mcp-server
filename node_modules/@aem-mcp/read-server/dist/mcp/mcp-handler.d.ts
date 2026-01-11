/**
 * MCP Protocol Handler for Read Server
 * Handles MCP tool discovery, schema generation, and tool execution
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}
export interface MCPRequest {
    method: string;
    params: {
        name: string;
        arguments?: Record<string, any>;
    };
}
export interface MCPResponse {
    content?: Array<{
        type: 'text' | 'resource';
        text?: string;
        resource?: {
            uri: string;
            mimeType?: string;
        };
    }>;
    isError?: boolean;
}
export declare class MCPHandler {
    private logger;
    private client;
    private services;
    constructor(client: AEMHttpClient);
    /**
     * Get list of available MCP tools
     */
    getTools(): MCPTool[];
    /**
     * Execute MCP tool
     */
    executeTool(request: MCPRequest): Promise<MCPResponse>;
    /**
     * Handle MCP request
     */
    handleRequest(request: MCPRequest): Promise<MCPResponse>;
}
//# sourceMappingURL=mcp-handler.d.ts.map