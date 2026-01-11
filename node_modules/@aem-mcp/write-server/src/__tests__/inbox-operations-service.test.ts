/**
 * Unit tests for Inbox Operations Service
 */

import { InboxOperationsService, CompleteInboxTaskOptions, UpdateTaskStatusOptions, CleanupOptions, InboxTaskOperationResult, TaskStatusUpdateResult, CleanupResult } from '../services/inbox-operations-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('InboxOperationsService', () => {
  let inboxService: InboxOperationsService;
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

    inboxService = new InboxOperationsService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('completeInboxTask', () => {
    const mockCompleteResponse = {
      success: true,
      data: {
        success: true,
        message: 'Task completed successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100
      }
    };

    it('should complete inbox task successfully', async () => {
      const taskId = 'task-123';
      const action = 'SUCCESS';
      const options: CompleteInboxTaskOptions = {
        comment: 'Task completed by automated process',
        taskData: {
          'approved': 'true',
          'reviewer': 'admin'
        },
        notifyAssignee: true
      };

      mockClient.post.mockResolvedValue(mockCompleteResponse);

      const result = await inboxService.completeInboxTask(taskId, action, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.taskId).toBe(taskId);
      expect(result.data!.message).toBe('Task completed successfully');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/libs/granite/taskmanager/updatetask',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'completeInboxTask',
            resource: taskId
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('item')).toBe(taskId);
      expect(formData.get('action')).toBe(action);
      expect(formData.get('comment')).toBe('Task completed by automated process');
      expect(formData.get('notifyAssignee')).toBe('true');
      expect(formData.get('taskData.approved')).toBe('true');
      expect(formData.get('taskData.reviewer')).toBe('admin');
    });

    it('should complete task with minimal options', async () => {
      const taskId = 'task-456';
      const action = 'SUCCESS';

      mockClient.post.mockResolvedValue(mockCompleteResponse);

      const result = await inboxService.completeInboxTask(taskId, action);

      expect(result.success).toBe(true);
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('item')).toBe(taskId);
      expect(formData.get('action')).toBe(action);
      expect(formData.get('comment')).toBeNull();
    });

    it('should throw validation error for missing required fields', async () => {
      await expect(inboxService.completeInboxTask('', 'SUCCESS')).rejects.toThrow(AEMException);
      await expect(inboxService.completeInboxTask('task-123', '')).rejects.toThrow(AEMException);
      await expect(inboxService.completeInboxTask('', '')).rejects.toThrow('Task ID and action are required');
    });

    it('should handle server errors gracefully', async () => {
      const errorResponse = {
        success: false,
        error: { 
          code: 'SERVER_ERROR', 
          message: 'Internal server error',
          recoverable: true
        }
      };
      mockClient.post.mockResolvedValue(errorResponse);

      await expect(inboxService.completeInboxTask('task-123', 'SUCCESS')).rejects.toThrow(AEMException);
      await expect(inboxService.completeInboxTask('task-123', 'SUCCESS')).rejects.toThrow('Failed to complete inbox task');
    });
  });

  describe('updateTaskStatus', () => {
    const mockUpdateResponse = {
      success: true,
      data: {
        success: true,
        message: 'Task status updated successfully',
        previousStatus: 'ACTIVE',
        assignee: 'admin'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 80
      }
    };

    it('should update task status successfully', async () => {
      const taskId = 'task-789';
      const status = 'COMPLETED';
      const options: UpdateTaskStatusOptions = {
        comment: 'Status updated by system',
        assignee: 'admin',
        dueDate: new Date('2024-02-01T12:00:00.000Z'),
        priority: 1,
        taskData: {
          'completedBy': 'system',
          'completionReason': 'automated'
        }
      };

      mockClient.post.mockResolvedValue(mockUpdateResponse);

      const result = await inboxService.updateTaskStatus(taskId, status, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.taskId).toBe(taskId);
      expect(result.data!.newStatus).toBe(status);
      expect(result.data!.previousStatus).toBe('ACTIVE');
      expect(result.data!.assignee).toBe('admin');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/libs/granite/taskmanager/updatetask',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'updateTaskStatus',
            resource: taskId
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('item')).toBe(taskId);
      expect(formData.get('status')).toBe(status);
      expect(formData.get('comment')).toBe('Status updated by system');
      expect(formData.get('assignee')).toBe('admin');
      expect(formData.get('dueDate')).toBe('2024-02-01T12:00:00.000Z');
      expect(formData.get('priority')).toBe('1');
      expect(formData.get('taskData.completedBy')).toBe('system');
      expect(formData.get('taskData.completionReason')).toBe('automated');
    });

    it('should throw validation error for missing required fields', async () => {
      await expect(inboxService.updateTaskStatus('', 'COMPLETED')).rejects.toThrow(AEMException);
      await expect(inboxService.updateTaskStatus('task-123', '')).rejects.toThrow(AEMException);
      await expect(inboxService.updateTaskStatus('', '')).rejects.toThrow('Task ID and status are required');
    });
  });

  describe('cleanupPageMoveItems', () => {
    const mockGetItemsResponse = {
      success: true,
      data: {
        items: [
          {
            id: 'page-move-1',
            type: 'PAGE_MOVE',
            path: '/content/mysite/en/page1',
            created: '2024-01-01T10:00:00.000Z',
            status: 'SUCCESS'
          },
          {
            id: 'page-move-2',
            type: 'PAGE_MOVE',
            path: '/content/mysite/en/page2',
            created: '2024-01-01T11:00:00.000Z',
            status: 'SUCCESS'
          }
        ]
      }
    };

    const mockCleanupResponse = {
      success: true,
      data: {
        success: true,
        message: 'Item cleaned up successfully'
      }
    };

    it('should cleanup page move items successfully', async () => {
      const options: CleanupOptions = {
        batchSize: 10,
        maxAge: 7,
        status: 'SUCCESS'
      };

      mockClient.get.mockResolvedValue(mockGetItemsResponse);
      mockClient.post.mockResolvedValue(mockCleanupResponse);

      const result = await inboxService.cleanupPageMoveItems(options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.itemsProcessed).toBe(2);
      expect(result.data!.itemsRemoved).toBe(2);
      expect(result.data!.itemsFailed).toBe(0);
      expect(result.data!.details).toHaveLength(2);

      // Verify get call for items
      expect(mockClient.get).toHaveBeenCalledWith(
        '/libs/granite/taskmanager/content/taskmanager.json',
        expect.objectContaining({
          'type': 'PAGE_MOVE',
          'status': 'SUCCESS',
          'p.limit': '10'
        })
      );

      // Verify cleanup calls
      expect(mockClient.post).toHaveBeenCalledTimes(2);
    });

    it('should handle partial cleanup failures', async () => {
      mockClient.get.mockResolvedValue(mockGetItemsResponse);
      mockClient.post
        .mockResolvedValueOnce(mockCleanupResponse)
        .mockRejectedValueOnce(new Error('Cleanup failed'));

      const result = await inboxService.cleanupPageMoveItems();

      expect(result.success).toBe(true);
      expect(result.data!.itemsProcessed).toBe(2);
      expect(result.data!.itemsRemoved).toBe(1);
      expect(result.data!.itemsFailed).toBe(1);
      expect(result.data!.details[0].success).toBe(true);
      expect(result.data!.details[1].success).toBe(false);
      expect(result.data!.details[1].error).toBe('Cleanup failed');
    });

    it('should handle empty items list', async () => {
      mockClient.get.mockResolvedValue({
        success: true,
        data: { items: [] }
      });

      const result = await inboxService.cleanupPageMoveItems();

      expect(result.success).toBe(true);
      expect(result.data!.itemsProcessed).toBe(0);
      expect(result.data!.itemsRemoved).toBe(0);
      expect(result.data!.itemsFailed).toBe(0);
      expect(result.data!.details).toHaveLength(0);
    });
  });

  describe('cleanupRolloutItems', () => {
    const mockGetItemsResponse = {
      success: true,
      data: {
        items: [
          {
            id: 'rollout-1',
            type: 'ROLLOUT',
            path: '/content/mysite/en/rollout1',
            created: '2024-01-01T10:00:00.000Z',
            status: 'SUCCESS'
          }
        ]
      }
    };

    const mockCleanupResponse = {
      success: true,
      data: {
        success: true,
        message: 'Item cleaned up successfully'
      }
    };

    it('should cleanup rollout items successfully', async () => {
      const options: CleanupOptions = {
        batchSize: 5,
        maxAge: 14,
        status: 'SUCCESS'
      };

      mockClient.get.mockResolvedValue(mockGetItemsResponse);
      mockClient.post.mockResolvedValue(mockCleanupResponse);

      const result = await inboxService.cleanupRolloutItems(options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.itemsProcessed).toBe(1);
      expect(result.data!.itemsRemoved).toBe(1);
      expect(result.data!.itemsFailed).toBe(0);

      // Verify get call for items
      expect(mockClient.get).toHaveBeenCalledWith(
        '/libs/granite/taskmanager/content/taskmanager.json',
        expect.objectContaining({
          'type': 'ROLLOUT',
          'status': 'SUCCESS',
          'p.limit': '5'
        })
      );
    });

    it('should use default options when none provided', async () => {
      mockClient.get.mockResolvedValue({
        success: true,
        data: { items: [] }
      });

      await inboxService.cleanupRolloutItems();

      // Verify default values were used
      expect(mockClient.get).toHaveBeenCalledWith(
        '/libs/granite/taskmanager/content/taskmanager.json',
        expect.objectContaining({
          'type': 'ROLLOUT',
          'status': 'SUCCESS',
          'p.limit': '50'
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockClient.post.mockRejectedValue(networkError);

      await expect(inboxService.completeInboxTask('task-123', 'SUCCESS')).rejects.toThrow(AEMException);
      await expect(inboxService.completeInboxTask('task-123', 'SUCCESS')).rejects.toThrow('Unexpected error while completing inbox task');
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.post.mockRejectedValue(originalError);

      await expect(inboxService.updateTaskStatus('task-123', 'COMPLETED')).rejects.toThrow('Original error');
    });

    it('should handle malformed responses', async () => {
      const malformedResponse = {
        success: false,
        data: null
      };
      mockClient.post.mockResolvedValue(malformedResponse);

      await expect(inboxService.completeInboxTask('task-123', 'SUCCESS')).rejects.toThrow(AEMException);
      await expect(inboxService.completeInboxTask('task-123', 'SUCCESS')).rejects.toThrow('Failed to complete inbox task');
    });

    it('should handle cleanup errors gracefully', async () => {
      const getError = new Error('Failed to get items');
      mockClient.get.mockRejectedValue(getError);

      // Cleanup should still succeed even if getting items fails
      const result = await inboxService.cleanupPageMoveItems();

      expect(result.success).toBe(true);
      expect(result.data!.itemsProcessed).toBe(0);
      expect(result.data!.itemsRemoved).toBe(0);
      expect(result.data!.itemsFailed).toBe(0);
    });
  });

  describe('response parsing', () => {
    it('should parse inbox task operation response correctly', async () => {
      const responseWithWarnings = {
        success: true,
        data: {
          success: true,
          message: 'Task completed with warnings',
          warnings: ['Warning 1', 'Warning 2'],
          errors: []
        }
      };

      mockClient.post.mockResolvedValue(responseWithWarnings);

      const result = await inboxService.completeInboxTask('task-123', 'SUCCESS');

      expect(result.data!.warnings).toEqual(['Warning 1', 'Warning 2']);
      expect(result.data!.errors).toEqual([]);
    });

    it('should parse task status update response correctly', async () => {
      const responseWithDetails = {
        success: true,
        data: {
          success: true,
          message: 'Status updated',
          previousStatus: 'ACTIVE',
          assignee: 'admin'
        }
      };

      mockClient.post.mockResolvedValue(responseWithDetails);

      const result = await inboxService.updateTaskStatus('task-123', 'COMPLETED');

      expect(result.data!.previousStatus).toBe('ACTIVE');
      expect(result.data!.newStatus).toBe('COMPLETED');
      expect(result.data!.assignee).toBe('admin');
    });
  });
});
