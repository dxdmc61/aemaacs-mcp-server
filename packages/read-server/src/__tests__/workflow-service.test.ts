/**
 * Unit tests for Workflow Service
 */

import { WorkflowService, WorkflowInstance, WorkflowInstanceDetails, InboxItem, WorkflowModel, WorkflowHistoryItem, ListWorkflowInstancesOptions, ListInboxItemsOptions } from '../services/workflow-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock(  
          stepTitle: 'Create Renditions',
            type: 'PROCESS',
            status: 'ACTIVE',
            startTime: '2024-01-01T10:02:00.000Z',
            assignee: 'system',
            timeoutDate: '2024-01-01T12:00:00.000Z'
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 75,
        cached: false
      }
    };

    it('should get workflow history successfully', async () => {
      mockClient.get
        .mockResolvedValueOnce(mockWorkflowSearchResponse) // Find workflow path
        .mockResolvedValueOnce(mockHistoryResponse); // Get history

      const result = await workflowService.getWorkflowHistory('workflow-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      
      const historyItem1 = result.data![0];
      expect(historyItem1.stepId).toBe('step1');
      expect(historyItem1.stepTitle).toBe('Start Workflow');
      expect(historyItem1.type).toBe('WORKFLOW');
      expect(historyItem1.status).toBe('COMPLETED');
      expect(historyItem1.startTime).toEqual(new Date('2024-01-01T10:00:00.000Z'));
      expect(historyItem1.endTime).toEqual(new Date('2024-01-01T10:01:00.000Z'));

      const historyItem2 = result.data![1];
      expect(historyItem2.stepId).toBe('step2');
      expect(historyItem2.comment).toBe('Metadata processed successfully');

      const historyItem3 = result.data![2];
      expect(historyItem3.status).toBe('ACTIVE');
      expect(historyItem3.assignee).toBe('system');
      expect(historyItem3.timeoutDate).toEqual(new Date('2024-01-01T12:00:00.000Z'));

      expect(mockClient.get).toHaveBeenCalledTimes(2);
      expect(mockClient.get).toHaveBeenNthCalledWith(2,
        '/var/workflow/instances/server0/2024-01-01/workflow-1/history.json',
        undefined,
        expect.any(Object)
      );
    });

    it('should throw validation error for empty workflow ID', async () => {
      await expect(workflowService.getWorkflowHistory('')).rejects.toThrow(AEMException);
      await expect(workflowService.getWorkflowHistory('')).rejects.toThrow('Workflow ID is required');
    });

    it('should throw not found error for non-existent workflow', async () => {
      const notFoundResponse = {
        success: true,
        data: { hits: [] }
      };
      mockClient.get.mockResolvedValue(notFoundResponse);

      await expect(workflowService.getWorkflowHistory('non-existent')).rejects.toThrow(AEMException);
      await expect(workflowService.getWorkflowHistory('non-existent')).rejects.toThrow('Workflow not found');
    });
  });

  describe('error handling', () => {
    it('should handle server errors gracefully', async () => {
      const serverError = new Error('Server error');
      mockClient.get.mockRejectedValue(serverError);

      await expect(workflowService.listWorkflowInstances()).rejects.toThrow(AEMException);
      await expect(workflowService.listWorkflowInstances()).rejects.toThrow('Unexpected error while listing workflow instances');
    });

    it('should handle AEM exceptions properly', async () => {
      const aemException = new AEMException('Custom AEM error', 'CUSTOM_ERROR', false);
      mockClient.get.mockRejectedValue(aemException);

      await expect(workflowService.getWorkflowStatus('test')).rejects.toThrow(AEMException);
      await expect(workflowService.getWorkflowStatus('test')).rejects.toThrow('Custom AEM error');
    });

    it('should handle malformed responses', async () => {
      const malformedResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(malformedResponse);

      await expect(workflowService.listInboxItems()).rejects.toThrow(AEMException);
      await expect(workflowService.listInboxItems()).rejects.toThrow('Failed to list inbox items');
    });
  });

  describe('status mapping', () => {
    it('should map workflow status correctly', async () => {
      const testCases = [
        { input: 'COMPLETED', expected: 'COMPLETED' },
        { input: 'FINISHED', expected: 'COMPLETED' },
        { input: 'ABORTED', expected: 'ABORTED' },
        { input: 'TERMINATED', expected: 'ABORTED' },
        { input: 'SUSPENDED', expected: 'SUSPENDED' },
        { input: 'PAUSED', expected: 'SUSPENDED' },
        { input: 'STALE', expected: 'STALE' },
        { input: 'ABANDONED', expected: 'STALE' },
        { input: 'UNKNOWN', expected: 'RUNNING' },
        { input: '', expected: 'RUNNING' }
      ];

      const mockSearchResponse = {
        success: true,
        data: { hits: [{ path: '/var/workflow/instances/test' }] }
      };

      for (const testCase of testCases) {
        const mockDetailsResponse = {
          success: true,
          data: {
            id: 'test',
            status: testCase.input,
            startTime: '2024-01-01T10:00:00.000Z'
          }
        };

        mockClient.get
          .mockResolvedValueOnce(mockSearchResponse)
          .mockResolvedValueOnce(mockDetailsResponse)
          .mockResolvedValueOnce({ success: false }); // History not found

        const result = await workflowService.getWorkflowStatus('test');
        expect(result.data!.status).toBe(testCase.expected);

        jest.clearAllMocks();
      }
    });

    it('should map priority correctly', async () => {
      const testCases = [
        { input: 'HIGH', expected: 'HIGH' },
        { input: 'LOW', expected: 'LOW' },
        { input: 'MEDIUM', expected: 'MEDIUM' },
        { input: 'UNKNOWN', expected: 'MEDIUM' },
        { input: '', expected: 'MEDIUM' }
      ];

      const mockSearchResponse = {
        success: true,
        data: { hits: [{ path: '/var/workflow/instances/test' }] }
      };

      for (const testCase of testCases) {
        const mockItemResponse = {
          success: true,
          data: {
            id: 'test',
            priority: testCase.input,
            startTime: '2024-01-01T10:00:00.000Z'
          }
        };

        mockClient.get
          .mockResolvedValueOnce(mockSearchResponse)
          .mockResolvedValueOnce(mockItemResponse);

        const result = await workflowService.listInboxItems();
        if (result.data && result.data.length > 0) {
          expect(result.data[0].priority).toBe(testCase.expected);
        }

        jest.clearAllMocks();
      }
    });
  });

  describe('caching behavior', () => {
    it('should use appropriate cache TTL for different operations', async () => {
      const mockResponse = {
        success: true,
        data: { hits: [] },
        metadata: { cached: false }
      };

      mockClient.get.mockResolvedValue(mockResponse);

      // Test workflow instances (1 minute cache)
      await workflowService.listWorkflowInstances();
      expect(mockClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          cacheTtl: 60000
        })
      );

      jest.clearAllMocks();

      // Test workflow models (10 minutes cache)
      await workflowService.getWorkflowModels();
      expect(mockClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          cacheTtl: 600000
        })
      );

      jest.clearAllMocks();

      // Test inbox items (30 seconds cache)
      await workflowService.listInboxItems();
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
        data: { hits: [] }
      };

      mockClient.get.mockResolvedValue(mockResponse);

      await workflowService.listWorkflowInstances();

      expect(mockClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          context: {
            operation: 'listWorkflowInstances',
            resource: '/var/workflow/instances'
          }
        })
      );
    });
  });
});
