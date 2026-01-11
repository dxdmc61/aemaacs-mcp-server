/**
 * Unit tests for Workflow Operations Service
 */

import { WorkflowOperationsService, StartWorkflowOptions, StartPublishWorkflowOptions, ProcessAssetsOptions, CompleteWorkflowTaskOptions, WorkflowInstance, ProcessResult, TaskResult } from '../services/workflow-operations-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('WorkflowOperationsService', () => {
  let workflowService: WorkflowOperationsService;
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

    workflowService = new WorkflowOperationsService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startWorkflow', () => {
    const mockWorkflowResponse = {
      success: true,
      data: {
        id: 'workflow-123',
        title: 'Custom Workflow',
        model: '/etc/workflow/models/custom-workflow/jcr:content/model',
        payload: '/content/mysite/en/page',
        payloadType: 'JCR_PATH',
        initiator: 'admin',
        status: 'RUNNING',
        startTime: '2024-01-15T10:30:00.000Z'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 200
      }
    };

    it('should start workflow successfully', async () => {
      const modelPath = '/etc/workflow/models/custom-workflow/jcr:content/model';
      const payloadPath = '/content/mysite/en/page';
      const options: StartWorkflowOptions = {
        workflowTitle: 'Custom Workflow Title',
        startComment: 'Initiated by test',
        workflowData: {
          'priority': 'high',
          'assignee': 'admin'
        }
      };

      mockClient.post.mockResolvedValue(mockWorkflowResponse);

      const result = await workflowService.startWorkflow(modelPath, payloadPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.id).toBe('workflow-123');
      expect(result.data!.title).toBe('Custom Workflow');
      expect(result.data!.model).toBe(modelPath);
      expect(result.data!.payload).toBe(payloadPath);
      expect(result.data!.status).toBe('RUNNING');
      expect(result.data!.startTime).toEqual(new Date('2024-01-15T10:30:00.000Z'));

      expect(mockClient.post).toHaveBeenCalledWith(
        '/etc/workflow/instances',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'startWorkflow',
            resource: payloadPath
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('model')).toBe(modelPath);
      expect(formData.get('payload')).toBe(payloadPath);
      expect(formData.get('payloadType')).toBe('JCR_PATH');
      expect(formData.get('workflowTitle')).toBe('Custom Workflow Title');
      expect(formData.get('startComment')).toBe('Initiated by test');
      expect(formData.get('workflowData.priority')).toBe('high');
      expect(formData.get('workflowData.assignee')).toBe('admin');
    });

    it('should throw validation error for missing required fields', async () => {
      await expect(workflowService.startWorkflow('', '/content/path')).rejects.toThrow(AEMException);
      await expect(workflowService.startWorkflow('/model/path', '')).rejects.toThrow(AEMException);
      await expect(workflowService.startWorkflow('', '')).rejects.toThrow('Workflow model path and payload path are required');
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

      await expect(workflowService.startWorkflow('/model/path', '/content/path')).rejects.toThrow(AEMException);
      await expect(workflowService.startWorkflow('/model/path', '/content/path')).rejects.toThrow('Failed to start workflow for');
    });
  });

  describe('startPublishWorkflow', () => {
    const mockPublishWorkflowResponse = {
      success: true,
      data: {
        id: 'publish-workflow-456',
        title: 'Publish Content Tree - /content/mysite/en',
        model: '/etc/workflow/models/publish-content-tree/jcr:content/model',
        payload: '/content/mysite/en',
        payloadType: 'JCR_PATH',
        initiator: 'admin',
        status: 'RUNNING',
        startTime: '2024-01-15T10:30:00.000Z'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 250
      }
    };

    it('should start publish workflow successfully', async () => {
      const contentPath = '/content/mysite/en';
      const options: StartPublishWorkflowOptions = {
        workflowTitle: 'Custom Publish Workflow',
        startComment: 'Publishing content tree',
        replicateAsTree: true,
        activateTree: true,
        ignoreDeactivated: false
      };

      mockClient.post.mockResolvedValue(mockPublishWorkflowResponse);

      const result = await workflowService.startPublishWorkflow(contentPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.id).toBe('publish-workflow-456');
      expect(result.data!.title).toBe('Publish Content Tree - /content/mysite/en');
      expect(result.data!.payload).toBe(contentPath);
      expect(result.data!.status).toBe('RUNNING');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/etc/workflow/instances',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'startPublishWorkflow',
            resource: contentPath
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('model')).toBe('/etc/workflow/models/publish-content-tree/jcr:content/model');
      expect(formData.get('payload')).toBe(contentPath);
      expect(formData.get('workflowTitle')).toBe('Custom Publish Workflow');
      expect(formData.get('startComment')).toBe('Publishing content tree');
      expect(formData.get('workflowData.replicateAsTree')).toBe('true');
      expect(formData.get('workflowData.activateTree')).toBe('true');
      expect(formData.get('workflowData.ignoreDeactivated')).toBe('false');
    });

    it('should use default workflow title if not provided', async () => {
      const contentPath = '/content/mysite/en';

      mockClient.post.mockResolvedValue(mockPublishWorkflowResponse);

      await workflowService.startPublishWorkflow(contentPath);

      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('workflowTitle')).toBe('Publish Content Tree - /content/mysite/en');
    });

    it('should throw validation error for missing content path', async () => {
      await expect(workflowService.startPublishWorkflow('')).rejects.toThrow(AEMException);
      await expect(workflowService.startPublishWorkflow('')).rejects.toThrow('Content path is required');
    });
  });

  describe('processAssets', () => {
    const mockProcessResponse = {
      success: true,
      data: {
        success: true,
        jobId: 'asset-job-789',
        status: 'INITIATED',
        totalItems: 25,
        processedItems: 0
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100
      }
    };

    it('should process assets successfully', async () => {
      const folderPath = '/content/dam/mysite/images';
      const options: ProcessAssetsOptions = {
        profile: 'dam-update-asset',
        async: true,
        batchSize: 10
      };

      mockClient.post.mockResolvedValue(mockProcessResponse);

      const result = await workflowService.processAssets(folderPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.jobId).toBe('asset-job-789');
      expect(result.data!.status).toBe('INITIATED');
      expect(result.data!.totalItems).toBe(25);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/bin/asynccommand',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'processAssets',
            resource: folderPath
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('folderPath')).toBe(folderPath);
      expect(formData.get('profile')).toBe('dam-update-asset');
      expect(formData.get('async')).toBe('true');
      expect(formData.get('batchSize')).toBe('10');
    });

    it('should use default values when options not provided', async () => {
      const folderPath = '/content/dam/mysite/images';

      mockClient.post.mockResolvedValue(mockProcessResponse);

      await workflowService.processAssets(folderPath);

      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('profile')).toBe('dam-update-asset');
      expect(formData.get('async')).toBe('true');
    });

    it('should throw validation error for missing folder path', async () => {
      await expect(workflowService.processAssets('')).rejects.toThrow(AEMException);
      await expect(workflowService.processAssets('')).rejects.toThrow('Folder path is required');
    });

    it('should throw validation error for non-DAM folder path', async () => {
      const invalidPaths = ['/content/mysite', '/apps/mysite', '/etc/mysite'];
      
      for (const invalidPath of invalidPaths) {
        await expect(workflowService.processAssets(invalidPath)).rejects.toThrow(AEMException);
        await expect(workflowService.processAssets(invalidPath)).rejects.toThrow('Asset processing folder path must be in DAM');
      }
    });

    it('should wait for completion when wait option is true', async () => {
      const folderPath = '/content/dam/mysite/images';
      const options: ProcessAssetsOptions = {
        async: true,
        wait: true
      };

      // Mock the initial process call
      mockClient.post.mockResolvedValue(mockProcessResponse);
      
      // Mock the status check calls - first showing processing, then complete
      mockClient.get
        .mockResolvedValueOnce({
          success: true,
          data: { status: 'RUNNING' }
        })
        .mockResolvedValueOnce({
          success: true,
          data: { status: 'COMPLETED' }
        });

      const result = await workflowService.processAssets(folderPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('COMPLETED');
      
      // Verify we called get to check status
      expect(mockClient.get).toHaveBeenCalledWith('/bin/asynccommand?optype=GETSTATUS&jobid=asset-job-789');
    });
  });

  describe('completeWorkflowTask', () => {
    const mockTaskResponse = {
      success: true,
      data: {
        success: true,
        message: 'Task completed successfully',
        nextTasks: [
          {
            id: 'next-task-123',
            workflowId: 'workflow-123',
            title: 'Review Task',
            status: 'ACTIVE',
            priority: 1
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 80
      }
    };

    it('should complete workflow task successfully', async () => {
      const taskId = 'task-123';
      const action = 'COMPLETE';
      const options: CompleteWorkflowTaskOptions = {
        comment: 'Task completed successfully',
        workflowData: {
          'approved': 'true',
          'reviewer': 'admin'
        }
      };

      mockClient.post.mockResolvedValue(mockTaskResponse);

      const result = await workflowService.completeWorkflowTask(taskId, action, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.taskId).toBe(taskId);
      expect(result.data!.action).toBe(action);
      expect(result.data!.message).toBe('Task completed successfully');
      expect(result.data!.nextTasks).toHaveLength(1);
      expect(result.data!.nextTasks![0].id).toBe('next-task-123');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/libs/granite/taskmanager/updatetask',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'completeWorkflowTask',
            resource: taskId
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('item')).toBe(taskId);
      expect(formData.get('action')).toBe(action);
      expect(formData.get('comment')).toBe('Task completed successfully');
      expect(formData.get('workflowData.approved')).toBe('true');
      expect(formData.get('workflowData.reviewer')).toBe('admin');
    });

    it('should throw validation error for missing required fields', async () => {
      await expect(workflowService.completeWorkflowTask('', 'COMPLETE')).rejects.toThrow(AEMException);
      await expect(workflowService.completeWorkflowTask('task-123', '')).rejects.toThrow(AEMException);
      await expect(workflowService.completeWorkflowTask('', '')).rejects.toThrow('Task ID and action are required');
    });
  });

  describe('status mapping', () => {
    it('should map workflow statuses correctly', async () => {
      const testCases = [
        { input: 'RUNNING', expected: 'RUNNING' },
        { input: 'COMPLETED', expected: 'COMPLETED' },
        { input: 'FINISHED', expected: 'COMPLETED' },
        { input: 'ABORTED', expected: 'ABORTED' },
        { input: 'CANCELLED', expected: 'ABORTED' },
        { input: 'SUSPENDED', expected: 'SUSPENDED' },
        { input: 'PAUSED', expected: 'SUSPENDED' },
        { input: 'UNKNOWN', expected: 'RUNNING' },
        { input: '', expected: 'RUNNING' }
      ];

      for (const testCase of testCases) {
        const mockResponse = {
          success: true,
          data: {
            id: 'workflow-123',
            status: testCase.input
          }
        };

        mockClient.post.mockResolvedValue(mockResponse);

        const result = await workflowService.startWorkflow('/model', '/payload');
        expect(result.data!.status).toBe(testCase.expected);
        
        jest.clearAllMocks();
      }
    });

    it('should map process statuses correctly', async () => {
      const testCases = [
        { input: 'INITIATED', expected: 'INITIATED' },
        { input: 'RUNNING', expected: 'RUNNING' },
        { input: 'PROCESSING', expected: 'RUNNING' },
        { input: 'COMPLETED', expected: 'COMPLETED' },
        { input: 'FINISHED', expected: 'COMPLETED' },
        { input: 'FAILED', expected: 'FAILED' },
        { input: 'ERROR', expected: 'FAILED' },
        { input: 'UNKNOWN', expected: 'INITIATED' },
        { input: '', expected: 'INITIATED' }
      ];

      for (const testCase of testCases) {
        const mockResponse = {
          success: true,
          data: {
            jobId: 'job-123',
            status: testCase.input
          }
        };

        mockClient.post.mockResolvedValue(mockResponse);

        const result = await workflowService.processAssets('/content/dam/folder');
        expect(result.data!.status).toBe(testCase.expected);
        
        jest.clearAllMocks();
      }
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockClient.post.mockRejectedValue(networkError);

      await expect(workflowService.startWorkflow('/model', '/payload')).rejects.toThrow(AEMException);
      await expect(workflowService.startWorkflow('/model', '/payload')).rejects.toThrow('Unexpected error while starting workflow');
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.post.mockRejectedValue(originalError);

      await expect(workflowService.startPublishWorkflow('/content/path')).rejects.toThrow('Original error');
    });

    it('should handle malformed responses', async () => {
      const malformedResponse = {
        success: false,
        data: null
      };
      mockClient.post.mockResolvedValue(malformedResponse);

      await expect(workflowService.processAssets('/content/dam/folder')).rejects.toThrow(AEMException);
      await expect(workflowService.processAssets('/content/dam/folder')).rejects.toThrow('Failed to process assets in');
    });
  });
});
