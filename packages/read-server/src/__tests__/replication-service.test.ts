/**
 * Unit tests for Replication Service
 */

import { ReplicationService, DistributionAgent, PublishAgentLog, ReplicationStatus, ReplicationQueue, GetPublishAgentLogsOptions, GetReplicationQueueOptions } from '../services/replication-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('ReplicationService', () => {
  let replicationService: ReplicationService;
  let mockClient: jest.Mocked<AEMHttpClient>;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      upload: jest.fn(),
      getStats: jest.fn(),
      clearCache: jest.fn(),
      resetCircuitBreaker: jest.fn(),
      close: jest.fn()
    } as unknown as jest.Mocked<AEMHttpClient>;

    replicationService = new ReplicationService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDistributionAgents', () => {
    const mockAgentsResponse = {
      success: true,
      data: {
        'publish-agent': {
          id: 'publish-agent',
          name: 'Publish Agent',
          title: 'Default Publish Agent',
          description: 'Agent for publishing content',
          enabled: true,
          type: 'publish',
          transportUri: 'http://publish:4503/bin/receive',
          logLevel: 'info',
          queueProcessing: true,
          queueSize: '10',
          status: 'idle',
          lastActivity: '2024-01-15T10:30:00.000Z'
        },
        'flush-agent': {
          id: 'flush-agent',
          name: 'Dispatcher Flush Agent',
          title: 'Dispatcher Flush',
          enabled: true,
          type: 'invalidate',
          transportUri: 'http://dispatcher:80/dispatcher/invalidate.cache',
          logLevel: 'warn',
          queueProcessing: true,
          queueSize: '5',
          status: 'running'
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 120,
        cached: false
      }
    };

    it('should get distribution agents successfully', async () => {
      mockClient.get.mockResolvedValue(mockAgentsResponse);

      const result = await replicationService.getDistributionAgents();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      
      const publishAgent = result.data![0];
      expect(publishAgent.id).toBe('publish-agent');
      expect(publishAgent.name).toBe('Publish Agent');
      expect(publishAgent.title).toBe('Default Publish Agent');
      expect(publishAgent.enabled).toBe(true);
      expect(publishAgent.type).toBe('publish');
      expect(publishAgent.queueSize).toBe(10);
      expect(publishAgent.status).toBe('idle');
      expect(publishAgent.lastActivity).toEqual(new Date('2024-01-15T10:30:00.000Z'));

      const flushAgent = result.data![1];
      expect(flushAgent.id).toBe('flush-agent');
      expect(flushAgent.type).toBe('invalidate');
      expect(flushAgent.status).toBe('running');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/libs/sling/distribution/services/agents.json',
        undefined,
        expect.objectContaining({
          cacheTtl: 300000
        })
      );
    });

    it('should handle array format response', async () => {
      const arrayResponse = {
        ...mockAgentsResponse,
        data: [
          {
            id: 'agent1',
            name: 'Agent 1',
            enabled: true,
            type: 'publish',
            queueSize: '0',
            status: 'idle'
          }
        ]
      };

      mockClient.get.mockResolvedValue(arrayResponse);

      const result = await replicationService.getDistributionAgents();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe('agent1');
    });

    it('should handle server errors gracefully', async () => {
      const errorResponse = {
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      };
      mockClient.get.mockResolvedValue(errorResponse);

      await expect(replicationService.getDistributionAgents()).rejects.toThrow(AEMException);
      await expect(replicationService.getDistributionAgents()).rejects.toThrow('Failed to get distribution agents');
    });
  });

  describe('getPublishAgentLogs', () => {
    const mockLogsResponse = {
      success: true,
      data: {
        logs: [
          {
            timestamp: '2024-01-15T10:30:00.000Z',
            level: 'INFO',
            message: 'Content published successfully',
            path: '/content/mysite/en/home',
            action: 'activate',
            status: 'success'
          },
          {
            timestamp: '2024-01-15T10:25:00.000Z',
            level: 'ERROR',
            message: 'Failed to publish content',
            path: '/content/mysite/en/about',
            action: 'activate',
            status: 'error',
            details: {
              errorCode: 'TRANSPORT_ERROR',
              retryCount: 3
            }
          },
          {
            timestamp: '2024-01-15T10:20:00.000Z',
            level: 'WARN',
            message: 'Slow replication detected',
            path: '/content/mysite/en/products',
            action: 'activate',
            status: 'success'
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 80,
        cached: false
      }
    };

    it('should get publish agent logs successfully', async () => {
      mockClient.get.mockResolvedValue(mockLogsResponse);

      const result = await replicationService.getPublishAgentLogs();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      
      // Logs should be sorted by timestamp (newest first)
      const log1 = result.data![0];
      expect(log1.timestamp).toEqual(new Date('2024-01-15T10:30:00.000Z'));
      expect(log1.level).toBe('INFO');
      expect(log1.message).toBe('Content published successfully');
      expect(log1.path).toBe('/content/mysite/en/home');
      expect(log1.action).toBe('activate');
      expect(log1.status).toBe('success');

      const log2 = result.data![1];
      expect(log2.level).toBe('ERROR');
      expect(log2.details).toEqual({
        errorCode: 'TRANSPORT_ERROR',
        retryCount: 3
      });

      const log3 = result.data![2];
      expect(log3.level).toBe('WARN');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/replication/agents.publish/log.json',
        expect.objectContaining({
          'p.limit': 100,
          'p.offset': 0
        }),
        expect.objectContaining({
          cacheTtl: 60000
        })
      );
    });

    it('should get logs with filtering options', async () => {
      mockClient.get.mockResolvedValue(mockLogsResponse);

      const options: GetPublishAgentLogsOptions = {
        agentId: 'publish-agent',
        level: 'ERROR',
        startTime: new Date('2024-01-15T10:00:00.000Z'),
        endTime: new Date('2024-01-15T11:00:00.000Z'),
        limit: 50,
        offset: 10
      };

      await replicationService.getPublishAgentLogs(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/replication/agents.publish/log.json',
        expect.objectContaining({
          'agent': 'publish-agent',
          'level': 'ERROR',
          'startTime': '2024-01-15T10:00:00.000Z',
          'endTime': '2024-01-15T11:00:00.000Z',
          'p.limit': 50,
          'p.offset': 10
        }),
        expect.any(Object)
      );
    });

    it('should handle array format response', async () => {
      const arrayResponse = {
        ...mockLogsResponse,
        data: [
          {
            timestamp: '2024-01-15T10:30:00.000Z',
            level: 'INFO',
            message: 'Test log entry'
          }
        ]
      };

      mockClient.get.mockResolvedValue(arrayResponse);

      const result = await replicationService.getPublishAgentLogs();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].message).toBe('Test log entry');
    });
  });

  describe('getReplicationStatus', () => {
    const mockStatusResponse = {
      success: true,
      data: {
        status: 'published',
        lastPublished: '2024-01-15T10:30:00.000Z',
        lastModified: '2024-01-15T10:25:00.000Z',
        publishedBy: 'admin',
        action: 'activate',
        agents: [
          {
            id: 'publish-agent',
            name: 'Publish Agent',
            status: 'success',
            lastReplication: '2024-01-15T10:30:00.000Z'
          },
          {
            id: 'flush-agent',
            name: 'Flush Agent',
            status: 'error',
            errorMessage: 'Connection timeout',
            retryCount: '2'
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100,
        cached: false
      }
    };

    it('should get replication status successfully', async () => {
      const contentPath = '/content/mysite/en/home';
      mockClient.get.mockResolvedValue(mockStatusResponse);

      const result = await replicationService.getReplicationStatus(contentPath);

      expect(result.success).toBe(true);
      expect(result.data!.path).toBe(contentPath);
      expect(result.data!.status).toBe('published');
      expect(result.data!.lastPublished).toEqual(new Date('2024-01-15T10:30:00.000Z'));
      expect(result.data!.lastModified).toEqual(new Date('2024-01-15T10:25:00.000Z'));
      expect(result.data!.publishedBy).toBe('admin');
      expect(result.data!.replicationAction).toBe('activate');
      expect(result.data!.agents).toHaveLength(2);

      const agent1 = result.data!.agents[0];
      expect(agent1.agentId).toBe('publish-agent');
      expect(agent1.status).toBe('success');
      expect(agent1.lastReplication).toEqual(new Date('2024-01-15T10:30:00.000Z'));

      const agent2 = result.data!.agents[1];
      expect(agent2.agentId).toBe('flush-agent');
      expect(agent2.status).toBe('error');
      expect(agent2.errorMessage).toBe('Connection timeout');
      expect(agent2.retryCount).toBe(2);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/replicate.json',
        { path: contentPath, cmd: 'status' },
        expect.objectContaining({
          cacheTtl: 180000
        })
      );
    });

    it('should throw validation error for empty content path', async () => {
      await expect(replicationService.getReplicationStatus('')).rejects.toThrow(AEMException);
      await expect(replicationService.getReplicationStatus('')).rejects.toThrow('Content path is required');
    });

    it('should handle different status values', async () => {
      const testCases = [
        { input: 'activated', expected: 'published' },
        { input: 'deactivated', expected: 'unpublished' },
        { input: 'modified', expected: 'modified' },
        { input: 'unknown', expected: 'never-published' }
      ];

      for (const testCase of testCases) {
        const response = {
          ...mockStatusResponse,
          data: {
            ...mockStatusResponse.data,
            status: testCase.input
          }
        };

        mockClient.get.mockResolvedValue(response);

        const result = await replicationService.getReplicationStatus('/test/path');
        expect(result.data!.status).toBe(testCase.expected);

        jest.clearAllMocks();
      }
    });
  });

  describe('getReplicationQueue', () => {
    const mockQueueResponse = {
      success: true,
      data: {
        'publish-agent': {
          agentId: 'publish-agent',
          agentName: 'Publish Agent',
          totalItems: '3',
          pendingItems: '2',
          processingItems: '1',
          errorItems: '0',
          blockedItems: '0',
          lastProcessed: '2024-01-15T10:30:00.000Z',
          isProcessing: true,
          items: [
            {
              id: 'item1',
              path: '/content/mysite/en/home',
              action: 'activate',
              agentId: 'publish-agent',
              created: '2024-01-15T10:25:00.000Z',
              status: 'processing',
              attempts: '1',
              priority: '5'
            },
            {
              id: 'item2',
              path: '/content/mysite/en/about',
              action: 'activate',
              agentId: 'publish-agent',
              created: '2024-01-15T10:20:00.000Z',
              status: 'pending',
              attempts: '0',
              priority: '3'
            },
            {
              id: 'item3',
              path: '/content/mysite/en/contact',
              action: 'deactivate',
              agentId: 'publish-agent',
              created: '2024-01-15T10:15:00.000Z',
              status: 'pending',
              attempts: '0',
              priority: '1'
            }
          ]
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 90,
        cached: false
      }
    };

    it('should get replication queue successfully', async () => {
      mockClient.get.mockResolvedValue(mockQueueResponse);

      const result = await replicationService.getReplicationQueue();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      
      const queue = result.data![0];
      expect(queue.agentId).toBe('publish-agent');
      expect(queue.agentName).toBe('Publish Agent');
      expect(queue.totalItems).toBe(3);
      expect(queue.pendingItems).toBe(2);
      expect(queue.processingItems).toBe(1);
      expect(queue.errorItems).toBe(0);
      expect(queue.blockedItems).toBe(0);
      expect(queue.lastProcessed).toEqual(new Date('2024-01-15T10:30:00.000Z'));
      expect(queue.isProcessing).toBe(true);
      expect(queue.items).toHaveLength(3);

      const item1 = queue.items[0];
      expect(item1.id).toBe('item1');
      expect(item1.path).toBe('/content/mysite/en/home');
      expect(item1.action).toBe('activate');
      expect(item1.status).toBe('processing');
      expect(item1.attempts).toBe(1);
      expect(item1.priority).toBe(5);

      const item3 = queue.items[2];
      expect(item3.action).toBe('deactivate');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/replication/queue.json',
        expect.objectContaining({
          'p.limit': 50,
          'p.offset': 0
        }),
        expect.objectContaining({
          cacheTtl: 30000
        })
      );
    });

    it('should get queue with filtering options', async () => {
      mockClient.get.mockResolvedValue(mockQueueResponse);

      const options: GetReplicationQueueOptions = {
        agentId: 'publish-agent',
        status: 'pending',
        limit: 25,
        offset: 5
      };

      await replicationService.getReplicationQueue(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/replication/queue.json',
        expect.objectContaining({
          'agent': 'publish-agent',
          'status': 'pending',
          'p.limit': 25,
          'p.offset': 5
        }),
        expect.any(Object)
      );
    });

    it('should handle array format response', async () => {
      const arrayResponse = {
        ...mockQueueResponse,
        data: [
          {
            agentId: 'agent1',
            totalItems: '1',
            items: []
          }
        ]
      };

      mockClient.get.mockResolvedValue(arrayResponse);

      const result = await replicationService.getReplicationQueue();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].agentId).toBe('agent1');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockClient.get.mockRejectedValue(networkError);

      await expect(replicationService.getDistributionAgents()).rejects.toThrow(AEMException);
      await expect(replicationService.getDistributionAgents()).rejects.toThrow('Unexpected error while getting distribution agents');
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.get.mockRejectedValue(originalError);

      await expect(replicationService.getPublishAgentLogs()).rejects.toThrow('Original error');
    });

    it('should handle malformed responses', async () => {
      const malformedResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(malformedResponse);

      await expect(replicationService.getReplicationQueue()).rejects.toThrow(AEMException);
      await expect(replicationService.getReplicationQueue()).rejects.toThrow('Failed to get replication queue');
    });
  });

  describe('status mapping', () => {
    it('should map log levels correctly', async () => {
      const testCases = [
        { input: 'ERROR', expected: 'ERROR' },
        { input: 'WARN', expected: 'WARN' },
        { input: 'WARNING', expected: 'WARN' },
        { input: 'INFO', expected: 'INFO' },
        { input: 'DEBUG', expected: 'DEBUG' },
        { input: 'UNKNOWN', expected: 'INFO' },
        { input: '', expected: 'INFO' }
      ];

      for (const testCase of testCases) {
        const response = {
          success: true,
          data: {
            logs: [{
              timestamp: '2024-01-15T10:30:00.000Z',
              level: testCase.input,
              message: 'Test message'
            }]
          }
        };

        mockClient.get.mockResolvedValue(response);

        const result = await replicationService.getPublishAgentLogs();
        expect(result.data![0].level).toBe(testCase.expected);

        jest.clearAllMocks();
      }
    });

    it('should map agent types correctly', async () => {
      const testCases = [
        { input: 'publish', expected: 'publish' },
        { input: 'unpublish', expected: 'unpublish' },
        { input: 'deactivate', expected: 'unpublish' },
        { input: 'invalidate', expected: 'invalidate' },
        { input: 'flush', expected: 'invalidate' },
        { input: 'test', expected: 'test' },
        { input: 'unknown', expected: 'publish' }
      ];

      for (const testCase of testCases) {
        const response = {
          success: true,
          data: {
            'test-agent': {
              id: 'test-agent',
              type: testCase.input,
              enabled: true,
              queueSize: '0',
              status: 'idle'
            }
          }
        };

        mockClient.get.mockResolvedValue(response);

        const result = await replicationService.getDistributionAgents();
        expect(result.data![0].type).toBe(testCase.expected);

        jest.clearAllMocks();
      }
    });
  });

  describe('caching behavior', () => {
    it('should use appropriate cache TTL for different operations', async () => {
      const mockResponse = {
        success: true,
        data: {},
        metadata: { cached: false }
      };

      mockClient.get.mockResolvedValue(mockResponse);

      // Test distribution agents (5 minutes cache)
      await replicationService.getDistributionAgents();
      expect(mockClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          cacheTtl: 300000
        })
      );

      jest.clearAllMocks();

      // Test publish agent logs (1 minute cache)
      await replicationService.getPublishAgentLogs();
      expect(mockClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          cacheTtl: 60000
        })
      );

      jest.clearAllMocks();

      // Test replication status (3 minutes cache)
      await replicationService.getReplicationStatus('/test/path');
      expect(mockClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          cacheTtl: 180000
        })
      );

      jest.clearAllMocks();

      // Test replication queue (30 seconds cache)
      await replicationService.getReplicationQueue();
      expect(mockClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          cacheTtl: 30000
        })
      );
    });
  });

  describe('request context', () => {
    it('should include proper context in requests', async () => {
      const mockResponse = {
        success: true,
        data: {}
      };

      mockClient.get.mockResolvedValue(mockResponse);

      await replicationService.getDistributionAgents();

      expect(mockClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          context: {
            operation: 'getDistributionAgents',
            resource: '/libs/sling/distribution/services/agents'
          }
        })
      );
    });
  });
});
