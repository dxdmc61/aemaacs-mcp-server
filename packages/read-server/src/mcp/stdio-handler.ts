/**
 * STDIO Protocol Handler for MCP Communication
 * Handles MCP protocol over STDIO for read server
 */

import { Logger } from '@aemaacs-mcp/shared';
import { MCPHandler, MCPRequest } from './mcp-handler.js';
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
  private running = false;
  private initialized = false;
  private requestQueue: Map<string | number, { timestamp: number; timeout: ReturnType<typeof setTimeout> }> = new Map();
  private maxRequestTimeout = 30000; // 30 seconds

  constructor(client: AEMHttpClient) {
    this.logger = Logger.getInstance();
    this.mcpHandler = new MCPHandler(client);

    setInterval(() => this.cleanupRequestQueue(), 60000);
  }

  public start(): void {
    if (this.running) return;

    this.running = true;
    this.logger.info('Starting MCP STDIO handler');

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', this.handleInput.bind(this));
    process.stdin.on('end', this.handleEnd.bind(this));
    process.stdin.on('error', this.handleError.bind(this));
  }

  public stop(): void {
    if (!this.running) return;

    this.running = false;
    this.logger.info('Stopping MCP STDIO handler');

    process.stdin.removeAllListeners('data');
    process.stdin.removeAllListeners('end');
    process.stdin.removeAllListeners('error');
  }

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

  private async processMessage(messageStr: string): Promise<void> {
    try {
      const message: MCPMessage = JSON.parse(messageStr);

      this.logger.debug('Received MCP message', { method: message.method, id: message.id });

      if (message.method) {
        await this.handleMethodCall(message);
      } else if (message.result !== undefined || message.error !== undefined) {
        this.logger.debug('Received response', { id: message.id, hasError: !!message.error });
      }
    } catch (error) {
      this.logger.error('Error processing MCP message', error as Error, { messageStr });

      try {
        const partialMessage = JSON.parse(messageStr);
        if (partialMessage.id !== undefined && partialMessage.id !== null) {
          this.sendErrorResponse(partialMessage.id, -32700, 'Parse error');
        }
      } catch {
        this.logger.error('Cannot parse message for ID, skipping error response');
      }
    }
  }

  private async handleMethodCall(message: MCPMessage): Promise<void> {
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
          } else {
            this.logger.debug(`Ignoring unknown notification: ${method}`);
          }
          break;
      }
    } catch (error) {
      this.logger.error('Error handling method call', error as Error, { method, id });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.sendErrorResponse(id, -32603, `Internal error: ${errorMessage}`);
    } finally {
      if (id !== undefined) {
        this.removeRequestFromQueue(id);
      }
    }
  }

  private async handleInitialize(params: any, id?: string | number): Promise<void> {
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

  private async handleToolsList(id?: string | number): Promise<void> {
    this.logger.debug('Handling tools/list request');

    const tools = this.mcpHandler.getTools();
    this.sendResponse(id, { tools });
  }

  private async handleToolsCall(params: any, id?: string | number): Promise<void> {
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

    const request: MCPRequest = {
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
      } else {
        this.sendResponse(id, response);
      }
    } catch (error) {
      this.logger.error('Error executing tool', error as Error, { toolName: params.name });
      this.sendErrorResponse(id, -32603, `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleStreamingToolCall(params: any, id?: string | number): Promise<void> {
    this.logger.debug('Handling streaming tool call', { toolName: params?.name });

    const request: MCPRequest = {
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
    } catch (error) {
      this.logger.error('Error executing streaming tool', error as Error, { toolName: params.name });
      this.sendErrorResponse(id, -32603, `Streaming tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

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

  private sendErrorResponse(id: string | number | undefined | null, code: number, errorMessage: string, data?: any): void {
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

  private sendMessage(message: MCPMessage): void {
    try {
      const messageStr = JSON.stringify(message);
      process.stdout.write(`${messageStr}\n`);

      this.logger.debug('Sent MCP message', {
        method: message.method,
        id: message.id,
        hasError: !!message.error
      });
    } catch (error) {
      this.logger.error('Error sending MCP message', error as Error);
    }
  }

  private handleEnd(): void {
    this.logger.info('STDIN ended, stopping MCP handler');
    this.stop();
    process.exit(0);
  }

  private handleError(error: Error): void {
    this.logger.error('STDIN error', error);
    this.stop();
    process.exit(1);
  }

  private cleanupRequestQueue(): void {
    const now = Date.now();
    const expiredRequests: (string | number)[] = [];

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

  private addRequestToQueue(id: string | number): void {
    const timeout = setTimeout(() => {
      this.requestQueue.delete(id);
      this.sendErrorResponse(id, -32603, 'Request timeout');
    }, this.maxRequestTimeout);

    this.requestQueue.set(id, {
      timestamp: Date.now(),
      timeout
    });
  }

  private removeRequestFromQueue(id: string | number): void {
    const requestInfo = this.requestQueue.get(id);
    if (requestInfo) {
      clearTimeout(requestInfo.timeout);
      this.requestQueue.delete(id);
    }
  }

  public getStats() {
    return {
      running: this.running,
      initialized: this.initialized,
      pendingRequests: this.requestQueue.size,
      maxRequestTimeout: this.maxRequestTimeout
    };
  }
}
