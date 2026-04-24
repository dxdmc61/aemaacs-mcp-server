/**
 * STDIO Protocol Handler for MCP Communication (Write Server)
 * Handles MCP protocol over STDIO for write server with enhanced security
 */

import { Logger } from '@aemaacs-mcp/shared';
import { MCPHandler, MCPRequest, MCPResponse } from './mcp-handler.js';
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

export class STDIOHandler {
  private logger: Logger;
  private mcpHandler: MCPHandler;
  private running: boolean = false;
  private authenticated: boolean = false;

  constructor(client: AEMHttpClient) {
    this.logger = Logger.getInstance();
    this.mcpHandler = new MCPHandler(client);
  }

  /**
   * Start STDIO handler
   */
  public start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.logger.info('Starting MCP STDIO handler for write server');

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
  public stop(): void {
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
  private async handleInput(data: string): Promise<void> {
    try {
      const lines = data.toString().trim().split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          await this.processMessage(line.trim());
        }
      }
    } catch (error) {
      this.logger.error('Error handling STDIO input', error as Error);
    }
  }

  /**
   * Process individual message
   */
  private async processMessage(messageStr: string): Promise<void> {
    try {
      const message: MCPMessage = JSON.parse(messageStr);
      
      this.logger.debug('Received MCP message', { method: message.method, id: message.id });

      // Handle different message types
      if (message.method) {
        await this.handleMethodCall(message);
      } else if (message.result !== undefined || message.error !== undefined) {
        // This is a response to a request we sent - log it
        this.logger.debug('Received response', { id: message.id, hasError: !!message.error });
      }
    } catch (error) {
      this.logger.error('Error processing MCP message', error as Error, { messageStr });
      
      // Send error response only if we can parse the ID
      try {
        const partialMessage = JSON.parse(messageStr);
        if (partialMessage.id !== undefined && partialMessage.id !== null) {
          this.sendErrorResponse(partialMessage.id, -32700, 'Parse error');
        }
        // If no valid id, just log the error - don't send response with null id
      } catch {
        // Can't even parse for ID, just log the error
        this.logger.error('Cannot parse message for ID, skipping error response');
      }
    }
  }

  /**
   * Handle method calls
   */
  private async handleMethodCall(message: MCPMessage): Promise<void> {
    const { method, params, id } = message;

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
          if (!this.authenticated) {
            this.sendErrorResponse(id, -32001, 'Authentication required for write operations');
            return;
          }
          await this.handleToolsList(id);
          break;

        case 'tools/call':
          if (!this.authenticated) {
            this.sendErrorResponse(id, -32001, 'Authentication required for write operations');
            return;
          }
          
          // Additional validation for dangerous operations
          if (this.isDangerousOperation(params?.name)) {
            this.logger.warn('Dangerous operation attempted', { 
              toolName: params?.name,
              arguments: params?.arguments 
            });
            
            // Could add additional confirmation step here
            if (!this.confirmDangerousOperation(params)) {
              this.sendErrorResponse(id, -32003, 'Dangerous operation not confirmed');
              return;
            }
          }
          
          await this.handleToolsCall(params, id);
          break;

        case 'authenticate':
          await this.handleAuthenticate(params, id);
          break;

        case 'ping':
          this.sendResponse(id, { status: 'pong' });
          break;

        default:
          // Only send error for requests (with id), not for notifications
          if (id !== undefined) {
            this.sendErrorResponse(id, -32601, `Method not found: ${method}`);
          } else {
            this.logger.debug(`Ignoring unknown notification: ${method}`);
          }
          break;
      }
    } catch (error) {
      this.logger.error('Error handling method call', error as Error, { method, id });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.sendErrorResponse(id, -32603, `Internal error: ${errorMessage}`);
    }
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(params: any, id?: string | number): Promise<void> {
    this.logger.info('Handling MCP initialize request', { params });

    const response = {
      protocolVersion: '2025-11-25',
      capabilities: {
        tools: {},
        security: {
          authenticationRequired: true,
          dangerousOperationConfirmation: true
        }
      },
      serverInfo: {
        name: 'aem-write-server',
        version: '1.0.0',
        description: 'AEM as a Cloud Service Write Operations MCP Server'
      }
    };

    this.sendResponse(id, response);
  }

  /**
   * Handle authentication
   */
  private async handleAuthenticate(params: any, id?: string | number): Promise<void> {
    this.logger.debug('Handling authentication request');

    // Simple authentication - in production, this should be more robust
    const apiKey = params?.apiKey;
    const expectedKey = process.env.WRITE_SERVER_API_KEY;

    if (!expectedKey) {
      this.logger.warn('No API key configured for write server');
      this.authenticated = true; // Allow if no key is set
    } else if (apiKey === expectedKey) {
      this.authenticated = true;
    } else {
      this.sendErrorResponse(id, -32001, 'Invalid API key');
      return;
    }

    this.sendResponse(id, { authenticated: true });
    this.logger.info('Client authenticated for write operations');
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(id?: string | number): Promise<void> {
    this.logger.debug('Handling tools/list request');

    const tools = this.mcpHandler.getTools();
    this.sendResponse(id, { tools });
  }

  /**
   * Handle tools/call request
   */
  private async handleToolsCall(params: any, id?: string | number): Promise<void> {
    this.logger.debug('Handling tools/call request', { toolName: params?.name });

    if (!params || !params.name) {
      this.sendErrorResponse(id, -32602, 'Invalid params: tool name is required');
      return;
    }

    const request: MCPRequest = {
      method: 'tools/call',
      params: {
        name: params.name,
        arguments: params.arguments || {}
      }
    };

    const response = await this.mcpHandler.executeTool(request);
    
    if (response.isError) {
      this.sendErrorResponse(id, -32603, response.content?.[0]?.text || 'Tool execution failed');
    } else {
      this.sendResponse(id, response);
    }
  }

  /**
   * Check if operation is dangerous
   */
  private isDangerousOperation(toolName: string): boolean {
    const dangerousOperations = [
      'aem_delete_page',
      'aem_delete_package',
      'aem_delete_asset',
      'aem_delete_async_job'
    ];

    return dangerousOperations.includes(toolName);
  }

  /**
   * Confirm dangerous operation
   */
  private confirmDangerousOperation(params: any): boolean {
    // In a real implementation, this could prompt for confirmation
    // For now, check if confirmation flag is set
    return params?.arguments?.confirm === true || 
           process.env.ALLOW_DANGEROUS_OPERATIONS === 'true';
  }

  /**
   * Send response message
   */
  private sendResponse(id: string | number | undefined, result: any): void {
    if (id === undefined) {
      this.logger.error('Cannot send response without id');
      return;
    }
    
    const message: MCPMessage = {
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
  private sendErrorResponse(id: string | number | undefined | null, code: number, errorMessage: string, data?: any): void {
    // Don't send error responses with null/undefined id - Cursor rejects them
    if (id === null || id === undefined) {
      this.logger.warn(`Cannot send error response without valid id: ${errorMessage} (code: ${code})`);
      return;
    }
    
    const response: MCPMessage = {
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
  private sendMessage(message: MCPMessage): void {
    try {
      const messageStr = JSON.stringify(message);
      process.stdout.write(`${messageStr  }\n`);
      
      this.logger.debug('Sent MCP message', { 
        method: message.method, 
        id: message.id,
        hasError: !!message.error 
      });
    } catch (error) {
      this.logger.error('Error sending MCP message', error as Error);
    }
  }

  /**
   * Handle STDIN end
   */
  private handleEnd(): void {
    this.logger.info('STDIN ended, stopping MCP handler');
    this.stop();
    process.exit(0);
  }

  /**
   * Handle STDIN error
   */
  private handleError(error: Error): void {
    this.logger.error('STDIN error', error);
    this.stop();
    process.exit(1);
  }
}
