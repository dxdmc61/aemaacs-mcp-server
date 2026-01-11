/**
 * Unit tests for Replication Operations Service
 */

import { ReplicationOperationsService, PublishOptions, UnpublishOptions, WorkflowOptions, QueueOptions } from '../services/replication-operations-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('ReplicationOperationsService', () => {
  let replicationService: ReplicationOperationsService;
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

    replicationService = new ReplicationOperationsService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('publishContent', () => {
    const mockPublishResponse = {
      success: true,
      data: {
        success: true,
        results: [
          { success: true, path: '/content/test/page1' },
          { success: true, path: '/content/test/page2' },
          { skipped: true, path: '/content/test/page3' }
        ],
        message: 'Content published successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 500
      }
    };

    it('should publish content successfully', async () => {
      const contentPath = '/content/test';
      const options: PublishOptions = {
        deep: true,
        onlyModified: false,
        force: true,
        synchronous: true
      };

      mockClient.post.mockResolvedValue(mockPublishResponse);

      const result = await replicationService.publishContent(contentPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe(contentPath);
      expect(result.data!.action).toBe('publish');
      expect(result.data!.status).toBe('published');
      expect(result.data!.publishedPaths).toEqual(['/content/test/page1', '/content/test/page2']);
      expect(result.data!.skippedPaths).toEqual(['/content/test/page3']);
      expect(result.data!.failedPaths).toEqual([]);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/bin/replicate.json',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'publishContent',
            resource: contentPath
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('path')).toBe(contentPath);
      expect(formData.get('cmd')).toBe('activate');
      expect(formData.get('deep')).toBe('true');
      expect(formData.get('onlyModified')).toBe('false');
      expect(formData.get('force')).toBe('true');
      expect(formData.get('synchronous')).toBe('true');
    });

    it('should handle simple publish response without results array', async () => {
      const contentPath = '/content/test/page';
      const simpleResponse = {
        success: true,
        data: {
          success: true,
          message: 'Page published successfully'
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'test-request-id',
          duration: 200
        }
      };

      mockClient.post.mockResolvedValue(simpleResponse);

      const result = await replicationService.publishContent(contentPath);

      expect(result.success).toBe(true);
      expect(result.data!.publishedPaths).toEqual([contentPath]);
      expect(result.data!.skippedPaths).toEqual([]);
      expect(result.data!.failedPaths).toEqual([]);
    });

    it('should throw validation error for missing content path', async () => {
      await expect(replicationService.publishContent('')).rejects.toThrow(AEMException);
      await expect(replicationService.publishContent('')).rejects.toThrow('Content path is required');
    });

    it('should handle server errors gracefully', async () => {
      const errorResponse = {
        success: false,
        error: { 
          code: 'SERVER_ERROR', 
          message: 'Replication failed',
          recoverable: true
        }
      };
      mockClient.post.mockResolvedValue(errorResponse);

      await expect(replicationService.publishContent('/content/test')).rejects.toThrow(AEMException);
      await expect(replicationService.publishContent('/content/test')).rejects.toThrow('Failed to publish content');
    });
  });

  describe('unpublishContent', () => {
    const mockUnpublishResponse = {
      success: true,
      data: {
        success: true,
        results: [
          { success: true, path: '/content/test/page1' },
          { success: false, path: '/content/test/page2', error: 'Not found' }
        ],
        message: 'Content unpublished successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 300
      }
    };

    it('should unpublish content successfully', async () => {
      const contentPath = '/content/test';
      const options: UnpublishOptions = {
        deep: true,
        force: false,
        synchronous: true
      };

      mockClient.post.mockResolvedValue(mockUnpublishResponse);

      const result = await replicationService.unpublishContent(contentPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe(contentPath);
      expect(result.data!.action).toBe('unpublish');
      expect(result.data!.status).toBe('unpublished');
      expect(result.data!.publishedPaths).toEqual(['/content/test/page1']);
      expect(result.data!.failedPaths).toEqual(['/content/test/page2']);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/bin/replicate.json',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'unpublishContent',
            resource: contentPath
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('path')).toBe(contentPath);
      expect(formData.get('cmd')).toBe('deactivate');
      expect(formData.get('deep')).toBe('true');
      expect(formData.get('force')).toBe('false');
      expect(formData.get('synchronous')).toBe('true');
    });

    it('should throw validation error for missing content path', async () => {
      await expect(replicationService.unpublishContent('')).rejects.toThrow(AEMException);
      await expect(replicationService.unpublishContent('')).rejects.toThrow('Content path is required');
    });
  });

  describe('activatePage', () => {
    const mockActivateResponse = {
      success: true,
      data: {
        success: true,
        message: 'Page activated successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 150
      }
    };

    it('should activate page successfully', async () => {
      const pagePath = '/content/test/page';
      const options: PublishOptions = {
        deep: false,
        force: true
      };

      mockClient.post.mockResolvedValue(mockActivateResponse);

      const result = await replicationService.activatePage(pagePath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe(pagePath);
      expect(result.data!.action).toBe('activate');
      expect(result.data!.status).toBe('activated');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/etc/replication/agents.author/publish/jcr:content.queue.json',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'activatePage',
            resource: pagePath
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('path')).toBe(pagePath);
      expect(formData.get('cmd')).toBe('activate');
      expect(formData.get('deep')).toBe('false');
      expect(formData.get('force')).toBe('true');
    });

    it('should throw validation error for missing page path', async () => {
      await expect(replicationService.activatePage('')).rejects.toThrow(AEMException);
      await expect(replicationService.activatePage('')).rejects.toThrow('Page path is required');
    });
  });

  describe('deactivatePage', () => {
    const mockDeactivateResponse = {
      success: true,
      data: {
        success: true,
        message: 'Page deactivated successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 150
      }
    };

    it('should deactivate page successfully', async () => {
      const pagePath = '/content/test/page';
      const options: UnpublishOptions = {
        deep: true,
        force: false
      };

      mockClient.post.mockResolvedValue(mockDeactivateResponse);

      const result = await replicationService.deactivatePage(pagePath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe(pagePath);
      expect(result.data!.action).toBe('deactivate');
      expect(result.data!.status).toBe('deactivated');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/etc/replication/agents.author/publish/jcr:content.queue.json',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'deactivatePage',
            resource: pagePath
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('path')).toBe(pagePath);
      expect(formData.get('cmd')).toBe('deactivate');
      expect(formData.get('deep')).toBe('true');
      expect(formData.get('force')).toBe('false');
    });

    it('should throw validation error for missing page path', async () => {
      await expect(replicationService.deactivatePage('')).rejects.toThrow(AEMException);
      await expect(replicationService.deactivatePage('')).rejects.toThrow('Page path is required');
    });
  });

  describe('triggerPublishWorkflow', () => {
    const mockWorkflowResponse = {
      success: true,
      data: {
        success: true,
        id: 'workflow-123',
        workflowId: 'workflow-123',
        message: 'Workflow started successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 200
      }
    };

    it('should trigger publish workflow successfully', async () => {
      const contentPath = '/content/test/page';
      const options: WorkflowOptions = {
        model: '/var/workflow/models/custom_publish',
        title: 'Custom Publish Workflow',
        comment: 'Publishing test content',
        initiator: 'admin'
      };

      mockClient.post.mockResolvedValue(mockWorkflowResponse);

      const result = await replicationService.triggerPublishWorkflow(contentPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe(contentPath);
      expect(result.data!.action).toBe('workflow');
      expect(result.data!.workflowId).toBe('workflow-123');
      expect(result.data!.workflowModel).toBe('/var/workflow/models/custom_publish');
      expect(result.data!.workflowStatus).toBe('RUNNING');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/etc/workflow/instances',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'triggerPublishWorkflow',
            resource: contentPath
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('model')).toBe('/var/workflow/models/custom_publish');
      expect(formData.get('payloadType')).toBe('JCR_PATH');
      expect(formData.get('payload')).toBe(contentPath);
      expect(formData.get('workflowTitle')).toBe('Custom Publish Workflow');
      expect(formData.get('workflowComment')).toBe('Publishing test content');
      expect(formData.get('initiator')).toBe('admin');
    });

    it('should use default workflow model when not specified', async () => {
      const contentPath = '/content/test/page';

      mockClient.post.mockResolvedValue(mockWorkflowResponse);

      const result = await replicationService.triggerPublishWorkflow(contentPath);

      expect(result.success).toBe(true);
      expect(result.data!.workflowModel).toBe('/var/workflow/models/publish_to_publish');
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('model')).toBe('/var/workflow/models/publish_to_publish');
      expect(formData.get('payload')).toBe(contentPath);
    });

    it('should throw validation error for missing content path', async () => {
      await expect(replicationService.triggerPublishWorkflow('')).rejects.toThrow(AEMException);
      await expect(replicationService.triggerPublishWorkflow('')).rejects.toThrow('Content path is required');
    });
  });

  describe('triggerCustomWorkflow', () => {
    const mockWorkflowResponse = {
      success: true,
      data: {
        success: true,
        id: 'custom-workflow-456',
        message: 'Custom workflow started successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 250
      }
    };

    it('should trigger custom workflow successfully', async () => {
      const workflowModel = '/var/workflow/models/custom_processing';
      const payload = '/content/dam/assets/image.jpg';
      const options: Omit<WorkflowOptions, 'model' | 'payload'> = {
        payloadType: 'JCR_PATH',
        title: 'Asset Processing Workflow',
        comment: 'Processing uploaded asset'
      };

      mockClient.post.mockResolvedValue(mockWorkflowResponse);

      const result = await replicationService.triggerCustomWorkflow(workflowModel, payload, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe(payload);
      expect(result.data!.action).toBe('workflow');
      expect(result.data!.workflowId).toBe('custom-workflow-456');
      expect(result.data!.workflowModel).toBe(workflowModel);
      expect(result.data!.workflowStatus).toBe('RUNNING');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/etc/workflow/instances',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'triggerCustomWorkflow',
            resource: payload
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('model')).toBe(workflowModel);
      expect(formData.get('payloadType')).toBe('JCR_PATH');
      expect(formData.get('payload')).toBe(payload);
      expect(formData.get('workflowTitle')).toBe('Asset Processing Workflow');
      expect(formData.get('workflowComment')).toBe('Processing uploaded asset');
    });

    it('should throw validation error for missing parameters', async () => {
      await expect(replicationService.triggerCustomWorkflow('', '/content/test')).rejects.toThrow(AEMException);
      await expect(replicationService.triggerCustomWorkflow('/var/workflow/models/test', '')).rejects.toThrow(AEMException);
      await expect(replicationService.triggerCustomWorkflow('', '')).rejects.toThrow('Workflow model and payload are required');
    });
  });

  describe('clearReplicationQueue', () => {
    const mockClearQueueResponse = {
      success: true,
      data: {
        success: true,
        itemsCleared: 5,
        count: 5,
        message: 'Queue cleared successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100
      }
    };

    it('should clear replication queue successfully', async () => {
      const agentName = 'publish';
      const options: QueueOptions = {
        force: true
      };

      mockClient.post.mockResolvedValue(mockClearQueueResponse);

      const result = await replicationService.clearReplicationQueue(agentName, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.action).toBe('clear');
      expect(result.data!.queueId).toBe(agentName);
      expect(result.data!.itemsCleared).toBe(5);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/etc/replication/agents.author/publish/jcr:content.queue.json',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'clearReplicationQueue',
            resource: agentName
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('cmd')).toBe('clear');
      expect(formData.get('force')).toBe('true');
    });

    it('should use default agent name when not specified', async () => {
      mockClient.post.mockResolvedValue(mockClearQueueResponse);

      const result = await replicationService.clearReplicationQueue();

      expect(result.success).toBe(true);
      expect(result.data!.queueId).toBe('publish');
      
      expect(mockClient.post).toHaveBeenCalledWith(
        '/etc/replication/agents.author/publish/jcr:content.queue.json',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('deleteQueueItem', () => {
    const mockDeleteItemResponse = {
      success: true,
      data: {
        success: true,
        message: 'Queue item deleted successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 50
      }
    };

    it('should delete queue item successfully', async () => {
      const agentName = 'publish';
      const itemId = 'item-123';
      const options: QueueOptions = {
        force: false
      };

      mockClient.post.mockResolvedValue(mockDeleteItemResponse);

      const result = await replicationService.deleteQueueItem(agentName, itemId, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.action).toBe('delete');
      expect(result.data!.queueId).toBe(agentName);
      expect(result.data!.itemsDeleted).toBe(1);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/etc/replication/agents.author/publish/jcr:content.queue.json',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'deleteQueueItem',
            resource: `${agentName}/${itemId}`
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('cmd')).toBe('delete');
      expect(formData.get('id')).toBe(itemId);
      expect(formData.get('force')).toBe('false');
    });

    it('should throw validation error for missing parameters', async () => {
      await expect(replicationService.deleteQueueItem('', 'item-123')).rejects.toThrow(AEMException);
      await expect(replicationService.deleteQueueItem('publish', '')).rejects.toThrow(AEMException);
      await expect(replicationService.deleteQueueItem('', '')).rejects.toThrow('Agent name and item ID are required');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockClient.post.mockRejectedValue(networkError);

      await expect(replicationService.publishContent('/content/test')).rejects.toThrow(AEMException);
      await expect(replicationService.publishContent('/content/test')).rejects.toThrow('Unexpected error while publishing content');
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.post.mockRejectedValue(originalError);

      await expect(replicationService.unpublishContent('/content/test')).rejects.toThrow('Original error');
    });

    it('should handle malformed responses', async () => {
      const malformedResponse = {
        success: false,
        data: null
      };
      mockClient.post.mockResolvedValue(malformedResponse);

      await expect(replicationService.activatePage('/content/test')).rejects.toThrow(AEMException);
      await expect(replicationService.activatePage('/content/test')).rejects.toThrow('Failed to activate page');
    });
  });

  describe('response parsing', () => {
    it('should correctly parse complex publish response with mixed results', async () => {
      const complexResponse = {
        success: true,
        data: {
          success: true,
          results: [
            { success: true, path: '/content/test/page1' },
            { success: true, path: '/content/test/page2' },
            { skipped: true, path: '/content/test/page3', reason: 'Already published' },
            { success: false, path: '/content/test/page4', error: 'Permission denied' },
            { success: false, path: '/content/test/page5', error: 'Invalid content' }
          ],
          message: 'Batch publish completed with some failures'
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'test-request-id',
          duration: 1000
        }
      };

      mockClient.post.mockResolvedValue(complexResponse);

      const result = await replicationService.publishContent('/content/test');

      expect(result.success).toBe(true);
      expect(result.data!.publishedPaths).toEqual(['/content/test/page1', '/content/test/page2']);
      expect(result.data!.skippedPaths).toEqual(['/content/test/page3']);
      expect(result.data!.failedPaths).toEqual(['/content/test/page4', '/content/test/page5']);
    });
  });
});
