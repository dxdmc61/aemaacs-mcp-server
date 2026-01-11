/**
 * HTTP REST API Handler for Write Server
 * Provides JSON-RPC 2.0 compliant endpoints for AEM write operations with enhanced security
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Logger } from '@aemaacs-mcp/shared';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { WriteServerConfig } from '@aemaacs-mcp/shared';
import { MCPHandler, MCPRequest } from '../mcp/mcp-handler.js';

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

export class HTTPHandler {
  private app: express.Application;
  private logger: Logger;
  private mcpHandler: MCPHandler;
  private config: WriteServerConfig;

  constructor(client: AEMHttpClient, config: WriteServerConfig) {
    this.app = express();
    this.logger = Logger.getInstance();
    this.mcpHandler = new MCPHandler(client);
    this.config = config;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware with enhanced security
   */
  private setupMiddleware(): void {
    // Security headers (applied first)
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Content-Security-Policy', "default-src 'self'");
      next();
    });

    // CORS (more restrictive for write operations)
    if (this.config.server.cors.enabled) {
      this.app.use(cors({
        origin: this.config.server.cors.origins.length > 0 
          ? this.config.server.cors.origins 
          : false,
        credentials: true,
        methods: ['POST', 'GET', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
      }));
    }

    // Rate limiting (more restrictive for write operations)
    if (this.config.server.rateLimit.enabled) {
      const limiter = rateLimit({
        windowMs: this.config.server.rateLimit.windowMs,
        max: this.config.server.rateLimit.maxRequests,
        message: {
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Rate limit exceeded for write operations'
          },
          id: null
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
          // Use API key or IP for rate limiting
          return req.header('X-API-Key') || req.ip || 'unknown';
        }
      });
      this.app.use(limiter);
    }

    // Body parsing with size limits
    this.app.use(express.json({ 
      limit: '50mb',
      verify: (req, res, buf) => {
        // Store raw body for signature verification if needed
        (req as any).rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Request logging with security context
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info('HTTP write request received', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        hasApiKey: !!req.header('X-API-Key')
      });
      next();
    });

    // Authentication middleware (required for write operations)
    this.app.use(this.authMiddleware.bind(this));

    // Dangerous operation detection middleware
    this.app.use(this.dangerousOperationMiddleware.bind(this));
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Health check endpoint (no auth required)
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        mode: 'write',
        security: {
          authRequired: this.config.security.requireAuth,
          dangerousOpsAllowed: this.config.validation.allowDangerousOperations
        }
      });
    });

    // API info endpoint
    this.app.get('/api/info', (req: Request, res: Response) => {
      res.json({
        name: 'AEM Write Server',
        version: '1.0.0',
        description: 'AEM as a Cloud Service Write Operations API',
        security: {
          authenticationRequired: true,
          dangerousOperationConfirmation: !this.config.validation.allowDangerousOperations
        },
        endpoints: {
          jsonrpc: '/api/jsonrpc',
          tools: '/api/tools',
          health: '/health'
        }
      });
    });

    // Tools list endpoint
    this.app.get('/api/tools', (req: Request, res: Response) => {
      try {
        const tools = this.mcpHandler.getTools();
        res.json({ 
          tools,
          security: {
            dangerousOperations: tools.filter(t => this.isDangerousTool(t.name)),
            requiresConfirmation: !this.config.validation.allowDangerousOperations
          }
        });
      } catch (error) {
        this.logger.error('Error getting tools list', error as Error);
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
    this.app.use((req: Request, res: Response) => {
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
   * Enhanced authentication middleware for write operations
   */
  private authMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Skip auth for health check and options requests
    if (req.path === '/health' || req.method === 'OPTIONS') {
      return next();
    }

    if (!this.config.security.requireAuth) {
      this.logger.warn('Authentication disabled for write server - this is dangerous!');
      return next();
    }

    const apiKey = req.header('X-API-Key') || req.header('Authorization')?.replace('Bearer ', '');
    const clientIP = req.ip || req.connection.remoteAddress;

    // Check API key (required for write operations)
    if (!this.config.security.apiKeys || this.config.security.apiKeys.length === 0) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Server misconfiguration: No API keys configured'
        },
        id: null
      });
      return;
    }

    if (!apiKey || !this.config.security.apiKeys.includes(apiKey)) {
      this.logger.warn('Unauthorized write attempt', { ip: clientIP, hasApiKey: !!apiKey });
      res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Invalid or missing API key for write operations'
        },
        id: null
      });
      return;
    }

    // Check allowed IPs
    if (this.config.security.allowedIPs && this.config.security.allowedIPs.length > 0) {
      const isAllowed = this.config.security.allowedIPs.some((allowedIP: string) => {
        if (allowedIP.includes('/')) {
          // CIDR notation - simplified check
          return clientIP?.startsWith(allowedIP.split('/')[0]);
        }
        return clientIP === allowedIP;
      });

      if (!isAllowed) {
        this.logger.warn('IP not allowed for write operations', { ip: clientIP });
        res.status(403).json({
          jsonrpc: '2.0',
          error: {
            code: -32002,
            message: 'IP address not allowed for write operations'
          },
          id: null
        });
        return;
      }
    }

    // Store authentication info for later use
    (req as any).authenticated = true;
    (req as any).apiKey = apiKey;
    next();
  }

  /**
   * Dangerous operation detection middleware
   */
  private dangerousOperationMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Skip for non-POST requests
    if (req.method !== 'POST') {
      return next();
    }

    const toolName = req.params.toolName || req.body?.params?.name;
    
    if (toolName && this.isDangerousTool(toolName)) {
      this.logger.warn('Dangerous operation attempted', {
        toolName,
        ip: req.ip,
        apiKey: (req as any).apiKey
      });

      // Check if dangerous operations are allowed
      if (!this.config.validation.allowDangerousOperations) {
        // Check for confirmation
        const confirmed = req.body?.params?.arguments?.confirm === true ||
                         req.body?.confirm === true ||
                         req.query.confirm === 'true';

        if (!confirmed) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32003,
              message: `Dangerous operation '${toolName}' requires confirmation. Add 'confirm: true' to proceed.`,
              data: {
                toolName,
                requiresConfirmation: true
              }
            },
            id: req.body?.id || null
          });
          return;
        }
      }
    }

    next();
  }

  /**
   * Handle JSON-RPC requests
   */
  private async handleJSONRPC(req: Request, res: Response): Promise<void> {
    try {
      const request: JSONRPCRequest = req.body;

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

      let response: JSONRPCResponse;

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

    } catch (error) {
      this.logger.error('Error handling JSON-RPC request', error as Error);
      
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
  private async handleToolsList(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const tools = this.mcpHandler.getTools();
      
      return {
        jsonrpc: '2.0',
        result: { 
          tools,
          security: {
            dangerousOperations: tools.filter(t => this.isDangerousTool(t.name)),
            requiresConfirmation: !this.config.validation.allowDangerousOperations
          }
        },
        id: request.id
      };
    } catch (error) {
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
  private async handleToolsCall(request: JSONRPCRequest): Promise<JSONRPCResponse> {
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

      const mcpRequest: MCPRequest = {
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
      } catch {
        result = { content: mcpResponse.content };
      }

      return {
        jsonrpc: '2.0',
        result,
        id: request.id
      };

    } catch (error) {
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
  private async handleToolCall(req: Request, res: Response): Promise<void> {
    try {
      const toolName = req.params.toolName;
      const toolArgs = req.body || {};

      const mcpRequest: MCPRequest = {
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
      } catch {
        res.json({ content: mcpResponse.content });
      }

    } catch (error) {
      this.logger.error('Error handling tool call', error as Error, { toolName: req.params.toolName });
      
      res.status(500).json({
        error: `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Check if tool is dangerous
   */
  private isDangerousTool(toolName: string): boolean {
    const dangerousTools = [
      'aem_delete_page',
      'aem_delete_package',
      'aem_delete_asset',
      'aem_delete_async_job'
    ];

    return dangerousTools.includes(toolName);
  }

  /**
   * Error handling middleware
   */
  private errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
    this.logger.error('HTTP error in write server', error, {
      method: req.method,
      url: req.url,
      ip: req.ip
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
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const server = this.app.listen(this.config.server.port, this.config.server.host, () => {
          this.logger.info('HTTP write server started', {
            host: this.config.server.host,
            port: this.config.server.port,
            security: {
              authRequired: this.config.security.requireAuth,
              dangerousOpsAllowed: this.config.validation.allowDangerousOperations
            }
          });
          resolve();
        });

        server.on('error', (error) => {
          this.logger.error('HTTP write server error', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }
}
