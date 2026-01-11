/**
 * HTTP REST API Handler for Read Server
 * Provides JSON-RPC 2.0 compliant endpoints for AEM read operations
 */
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Logger } from '@aemaacs-mcp/shared';
import { MCPHandler } from '../mcp/mcp-handler.js';
export class HTTPHandler {
    constructor(client, config) {
        this.app = express();
        this.logger = Logger.getInstance();
        this.mcpHandler = new MCPHandler(client);
        this.config = config;
        this.setupMiddleware();
        this.setupRoutes();
    }
    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // CORS
        if (this.config.server.cors.enabled) {
            this.app.use(cors({
                origin: this.config.server.cors.origins.includes('*')
                    ? true
                    : this.config.server.cors.origins,
                credentials: true
            }));
        }
        // Rate limiting
        if (this.config.server.rateLimit.enabled) {
            const limiter = rateLimit({
                windowMs: this.config.server.rateLimit.windowMs,
                max: this.config.server.rateLimit.maxRequests,
                message: {
                    jsonrpc: '2.0',
                    error: {
                        code: -32000,
                        message: 'Rate limit exceeded'
                    },
                    id: null
                },
                standardHeaders: true,
                legacyHeaders: false
            });
            this.app.use(limiter);
        }
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        // Request logging
        this.app.use((req, res, next) => {
            this.logger.debug('HTTP request received', {
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent')
            });
            next();
        });
        // Security headers
        this.app.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            next();
        });
        // Authentication middleware
        if (this.config.security.requireAuth) {
            this.app.use(this.authMiddleware.bind(this));
        }
    }
    /**
     * Setup Express routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        });
        // API info endpoint
        this.app.get('/api/info', (req, res) => {
            res.json({
                name: 'AEM Read Server',
                version: '1.0.0',
                description: 'AEM as a Cloud Service Read Operations API',
                endpoints: {
                    jsonrpc: '/api/jsonrpc',
                    tools: '/api/tools',
                    health: '/health'
                }
            });
        });
        // Tools list endpoint
        this.app.get('/api/tools', (req, res) => {
            try {
                const tools = this.mcpHandler.getTools();
                res.json({ tools });
            }
            catch (error) {
                this.logger.error('Error getting tools list', error);
                res.status(500).json({
                    error: 'Internal server error'
                });
            }
        });
        // Main JSON-RPC endpoint
        this.app.post('/api/jsonrpc', this.handleJSONRPC.bind(this));
        // Individual tool endpoints (REST-style)
        this.app.post('/api/tools/:toolName', this.handleToolCall.bind(this));
        // Error handling middleware
        this.app.use(this.errorHandler.bind(this));
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                jsonrpc: '2.0',
                error: {
                    code: -32601,
                    message: 'Endpoint not found'
                },
                id: null
            });
        });
    }
    /**
     * Authentication middleware
     */
    authMiddleware(req, res, next) {
        // Skip auth for health check
        if (req.path === '/health') {
            return next();
        }
        const apiKey = req.header('X-API-Key') || req.query.apiKey;
        const clientIP = req.ip || req.connection.remoteAddress;
        // Check API key
        if (this.config.security.apiKeys && this.config.security.apiKeys.length > 0) {
            if (!apiKey || !this.config.security.apiKeys.includes(apiKey)) {
                res.status(401).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32001,
                        message: 'Invalid or missing API key'
                    },
                    id: null
                });
                return;
            }
        }
        // Check allowed IPs
        if (this.config.security.allowedIPs && this.config.security.allowedIPs.length > 0) {
            const isAllowed = this.config.security.allowedIPs.some((allowedIP) => {
                if (allowedIP.includes('/')) {
                    // CIDR notation - simplified check
                    return clientIP?.startsWith(allowedIP.split('/')[0]);
                }
                return clientIP === allowedIP;
            });
            if (!isAllowed) {
                res.status(403).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32002,
                        message: 'IP address not allowed'
                    },
                    id: null
                });
                return;
            }
        }
        next();
    }
    /**
     * Handle JSON-RPC requests
     */
    async handleJSONRPC(req, res) {
        try {
            const request = req.body;
            // Validate JSON-RPC format
            if (!request || request.jsonrpc !== '2.0' || !request.method) {
                res.status(400).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32600,
                        message: 'Invalid JSON-RPC request'
                    },
                    id: request?.id || null
                });
                return;
            }
            let response;
            switch (request.method) {
                case 'tools.list':
                    response = await this.handleToolsList(request);
                    break;
                case 'tools.call':
                    response = await this.handleToolsCall(request);
                    break;
                default:
                    response = {
                        jsonrpc: '2.0',
                        error: {
                            code: -32601,
                            message: `Method not found: ${request.method}`
                        },
                        id: request.id || null
                    };
            }
            res.json(response);
        }
        catch (error) {
            this.logger.error('Error handling JSON-RPC request', error);
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal error'
                },
                id: null
            });
        }
    }
    /**
     * Handle tools.list JSON-RPC method
     */
    async handleToolsList(request) {
        try {
            const tools = this.mcpHandler.getTools();
            return {
                jsonrpc: '2.0',
                result: { tools },
                id: request.id
            };
        }
        catch (error) {
            return {
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Failed to get tools list'
                },
                id: request.id
            };
        }
    }
    /**
     * Handle tools.call JSON-RPC method
     */
    async handleToolsCall(request) {
        try {
            if (!request.params || !request.params.name) {
                return {
                    jsonrpc: '2.0',
                    error: {
                        code: -32602,
                        message: 'Invalid params: tool name is required'
                    },
                    id: request.id
                };
            }
            const mcpRequest = {
                method: 'tools/call',
                params: {
                    name: request.params.name,
                    arguments: request.params.arguments || {}
                }
            };
            const mcpResponse = await this.mcpHandler.executeTool(mcpRequest);
            if (mcpResponse.isError) {
                return {
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: mcpResponse.content?.[0]?.text || 'Tool execution failed'
                    },
                    id: request.id
                };
            }
            // Parse the result from MCP response
            let result;
            try {
                result = JSON.parse(mcpResponse.content?.[0]?.text || '{}');
            }
            catch {
                result = { content: mcpResponse.content };
            }
            return {
                jsonrpc: '2.0',
                result,
                id: request.id
            };
        }
        catch (error) {
            return {
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
                },
                id: request.id
            };
        }
    }
    /**
     * Handle individual tool calls (REST-style)
     */
    async handleToolCall(req, res) {
        try {
            const toolName = req.params.toolName;
            const toolArgs = req.body || {};
            const mcpRequest = {
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: toolArgs
                }
            };
            const mcpResponse = await this.mcpHandler.executeTool(mcpRequest);
            if (mcpResponse.isError) {
                res.status(400).json({
                    error: mcpResponse.content?.[0]?.text || 'Tool execution failed'
                });
                return;
            }
            // Parse and return the result
            try {
                const result = JSON.parse(mcpResponse.content?.[0]?.text || '{}');
                res.json(result);
            }
            catch {
                res.json({ content: mcpResponse.content });
            }
        }
        catch (error) {
            this.logger.error('Error handling tool call', error, { toolName: req.params.toolName });
            res.status(500).json({
                error: `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }
    /**
     * Error handling middleware
     */
    errorHandler(error, req, res, next) {
        this.logger.error('HTTP error', error, {
            method: req.method,
            url: req.url
        });
        if (res.headersSent) {
            return next(error);
        }
        res.status(500).json({
            jsonrpc: '2.0',
            error: {
                code: -32603,
                message: 'Internal server error'
            },
            id: null
        });
    }
    /**
     * Start HTTP server
     */
    start() {
        return new Promise((resolve, reject) => {
            try {
                const server = this.app.listen(this.config.server.port, this.config.server.host, () => {
                    this.logger.info('HTTP server started', {
                        host: this.config.server.host,
                        port: this.config.server.port
                    });
                    resolve();
                });
                server.on('error', (error) => {
                    this.logger.error('HTTP server error', error);
                    reject(error);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
}
//# sourceMappingURL=http-handler.js.map