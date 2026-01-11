/**
 * Unit tests for System Operations Service
 */

import { SystemOperationsService, ACLConfig, ACLEntry, JCRPropertyOperation } from '../services/system-operations-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('SystemOperationsService', () => {
  let systemService: SystemOperationsService;
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

    systemService = new SystemOperationsService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('applyACLConfig', () => {
    const mockACLResponse = {
      success: true,
      data: {
        success: true,
        message: 'ACL applied successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 200
      }
    };

    it('should apply ACL configuration successfully', async () => {
      const config: ACLConfig = {
        path: '/content/test',
        entries: [
          {
            principal: 'content-authors',
            privileges: ['jcr:read', 'jcr:write'],
            allow: true,
            restrictions: {
              'rep:glob': '*/jcr:content/*'
            }
          },
          {
            principal: 'everyone',
            privileges: ['jcr:read'],
            allow: true
          },
          {
            principal: 'anonymous',
            privileges: ['jcr:write'],
            allow: false
          }
        ],
        merge: true,
        replaceExisting: false
      };

      mockClient.post.mockResolvedValue(mockACLResponse);

      const result = await systemService.applyACLConfig(config);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe('/content/test');
      expect(result.data!.appliedEntries).toBe(3);
      expect(result.data!.failedEntries).toBe(0);

      // Verify ACL entries were applied
      expect(mockClient.post).toHaveBeenCalledTimes(3);
      
      // Check first ACL entry
      expect(mockClient.post).toHaveBeenNthCalledWith(1,
        '/content/test.modifyAce.html',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'applyACLEntry',
            resource: '/content/test'
          }
        })
      );
      
      // Verify form data for first entry
      const firstFormData = mockClient.post.mock.calls[0][1] as FormData;
      expect(firstFormData.get('principalName')).toBe('content-authors');
      expect(firstFormData.get('privilege[0]')).toBe('jcr:read');
      expect(firstFormData.get('privilege[1]')).toBe('jcr:write');
      expect(firstFormData.get('privilege@Allow')).toBe('true');
      expect(firstFormData.get('restriction_rep:glob')).toBe('*/jcr:content/*');
      expect(firstFormData.get('merge')).toBe('true');
    });

    it('should handle ACL configuration with replaceExisting option', async () => {
      const config: ACLConfig = {
        path: '/content/test',
        entries: [
          {
            principal: 'content-authors',
            privileges: ['jcr:read'],
            allow: true
          }
        ],
        replaceExisting: true
      };

      // Mock clear ACL response
      const mockClearResponse = {
        success: true,
        data: { success: true }
      };

      mockClient.post.mockResolvedValueOnce(mockClearResponse); // Clear ACL
      mockClient.post.mockResolvedValueOnce(mockACLResponse);   // Apply ACL

      const result = await systemService.applyACLConfig(config);

      expect(result.success).toBe(true);
      expect(result.data!.appliedEntries).toBe(1);

      // Verify clear ACL was called first
      expect(mockClient.post).toHaveBeenCalledTimes(2);
      expect(mockClient.post).toHaveBeenNthCalledWith(1,
        '/content/test.deleteAce.html',
        expect.any(Object),
        expect.objectContaining({
          context: {
            operation: 'clearACL',
            resource: '/content/test'
          }
        })
      );
    });

    it('should handle partial failures in ACL entries', async () => {
      const config: ACLConfig = {
        path: '/content/test',
        entries: [
          {
            principal: 'valid-user',
            privileges: ['jcr:read'],
            allow: true
          },
          {
            principal: 'invalid-user',
            privileges: ['jcr:write'],
            allow: true
          }
        ]
      };

      // First entry succeeds, second fails
      mockClient.post.mockResolvedValueOnce(mockACLResponse);
      mockClient.post.mockResolvedValueOnce({
        success: false,
        error: { message: 'Principal not found' }
      });

      const result = await systemService.applyACLConfig(config);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(false); // Overall failure due to partial failure
      expect(result.data!.appliedEntries).toBe(1);
      expect(result.data!.failedEntries).toBe(1);
      expect(result.data!.errors).toHaveLength(1);
      expect(result.data!.errors![0]).toContain('invalid-user');
    });

    it('should throw validation error for missing path', async () => {
      const config: ACLConfig = {
        path: '',
        entries: [
          {
            principal: 'test-user',
            privileges: ['jcr:read'],
            allow: true
          }
        ]
      };

      await expect(systemService.applyACLConfig(config)).rejects.toThrow(AEMException);
      await expect(systemService.applyACLConfig(config)).rejects.toThrow('Path and ACL entries are required');
    });

    it('should throw validation error for empty entries', async () => {
      const config: ACLConfig = {
        path: '/content/test',
        entries: []
      };

      await expect(systemService.applyACLConfig(config)).rejects.toThrow(AEMException);
      await expect(systemService.applyACLConfig(config)).rejects.toThrow('Path and ACL entries are required');
    });

    it('should throw validation error for invalid JCR path', async () => {
      const config: ACLConfig = {
        path: 'invalid-path',
        entries: [
          {
            principal: 'test-user',
            privileges: ['jcr:read'],
            allow: true
          }
        ]
      };

      await expect(systemService.applyACLConfig(config)).rejects.toThrow(AEMException);
      await expect(systemService.applyACLConfig(config)).rejects.toThrow('Invalid JCR path format');
    });
  });

  describe('deleteAsyncJob', () => {
    const mockDeleteJobResponse = {
      success: true,
      data: {
        success: true,
        message: 'Job deleted successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100
      }
    };

    it('should delete async job successfully', async () => {
      const jobId = 'job-123-456';

      mockClient.post.mockResolvedValue(mockDeleteJobResponse);

      const result = await systemService.deleteAsyncJob(jobId);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.jobId).toBe(jobId);
      expect(result.data!.jobStatus).toBe('DELETED');
      expect(result.data!.deletedJobs).toBe(1);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/var/eventing/jobs/${jobId}`,
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'deleteAsyncJob',
            resource: jobId
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get(':operation')).toBe('delete');
    });

    it('should throw validation error for missing job ID', async () => {
      await expect(systemService.deleteAsyncJob('')).rejects.toThrow(AEMException);
      await expect(systemService.deleteAsyncJob('')).rejects.toThrow('Job ID is required');
    });

    it('should handle server errors gracefully', async () => {
      const errorResponse = {
        success: false,
        error: { 
          code: 'SERVER_ERROR', 
          message: 'Job not found',
          recoverable: false
        }
      };
      mockClient.post.mockResolvedValue(errorResponse);

      await expect(systemService.deleteAsyncJob('nonexistent-job')).rejects.toThrow(AEMException);
      await expect(systemService.deleteAsyncJob('nonexistent-job')).rejects.toThrow('Failed to delete async job');
    });
  });

  describe('manipulateJCRProperty', () => {
    const mockPropertyResponse = {
      success: true,
      data: {
        success: true,
        message: 'Property updated successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 150
      }
    };

    const mockCurrentValueResponse = {
      success: true,
      data: {
        'jcr:title': 'Old Title',
        'custom:property': 'old value'
      }
    };

    beforeEach(() => {
      // Mock getting current property value
      mockClient.get.mockResolvedValue(mockCurrentValueResponse);
    });

    it('should set property successfully', async () => {
      const operation: JCRPropertyOperation = {
        path: '/content/test/page',
        property: 'jcr:title',
        value: 'New Title',
        type: 'String',
        operation: 'set'
      };

      mockClient.post.mockResolvedValue(mockPropertyResponse);

      const result = await systemService.manipulateJCRProperty(operation);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe('/content/test/page');
      expect(result.data!.property).toBe('jcr:title');
      expect(result.data!.oldValue).toBe('Old Title');
      expect(result.data!.newValue).toBe('New Title');
      expect(result.data!.propertyType).toBe('String');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/content/test/page',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'manipulateJCRProperty',
            resource: '/content/test/page'
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('jcr:title')).toBe('New Title');
      expect(formData.get('jcr:title@TypeHint')).toBe('String');
    });

    it('should set multiple property values successfully', async () => {
      const operation: JCRPropertyOperation = {
        path: '/content/test/page',
        property: 'cq:tags',
        value: ['tag1', 'tag2', 'tag3'],
        type: 'String',
        multiple: true,
        operation: 'set'
      };

      mockClient.post.mockResolvedValue(mockPropertyResponse);

      const result = await systemService.manipulateJCRProperty(operation);

      expect(result.success).toBe(true);
      
      // Verify form data for multiple values
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('cq:tags[0]')).toBe('tag1');
      expect(formData.get('cq:tags[1]')).toBe('tag2');
      expect(formData.get('cq:tags[2]')).toBe('tag3');
      expect(formData.get('cq:tags@TypeHint')).toBe('String');
    });

    it('should delete property successfully', async () => {
      const operation: JCRPropertyOperation = {
        path: '/content/test/page',
        property: 'custom:property',
        operation: 'delete'
      };

      mockClient.post.mockResolvedValue(mockPropertyResponse);

      const result = await systemService.manipulateJCRProperty(operation);

      expect(result.success).toBe(true);
      expect(result.data!.oldValue).toBe('old value');
      expect(result.data!.newValue).toBeUndefined();
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('custom:property@Delete')).toBe('');
    });

    it('should add values to array property successfully', async () => {
      const operation: JCRPropertyOperation = {
        path: '/content/test/page',
        property: 'cq:tags',
        value: ['new-tag1', 'new-tag2'],
        operation: 'add'
      };

      mockClient.post.mockResolvedValue(mockPropertyResponse);

      const result = await systemService.manipulateJCRProperty(operation);

      expect(result.success).toBe(true);
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('cq:tags[+]')).toBe('new-tag1');
      expect(formData.getAll('cq:tags[+]')).toEqual(['new-tag1', 'new-tag2']);
    });

    it('should remove values from array property successfully', async () => {
      const operation: JCRPropertyOperation = {
        path: '/content/test/page',
        property: 'cq:tags',
        value: ['old-tag1', 'old-tag2'],
        operation: 'remove'
      };

      mockClient.post.mockResolvedValue(mockPropertyResponse);

      const result = await systemService.manipulateJCRProperty(operation);

      expect(result.success).toBe(true);
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('cq:tags[-]')).toBe('old-tag1');
      expect(formData.getAll('cq:tags[-]')).toEqual(['old-tag1', 'old-tag2']);
    });

    it('should handle different property types correctly', async () => {
      const testCases = [
        { value: true, type: 'Boolean', expected: 'true' },
        { value: false, type: 'Boolean', expected: 'false' },
        { value: 42, type: 'Long', expected: '42' },
        { value: 3.14, type: 'Double', expected: '3.14' },
        { value: new Date('2023-01-01T00:00:00.000Z'), type: 'Date', expected: '2023-01-01T00:00:00.000Z' },
        { value: '2023-01-01T00:00:00.000Z', type: 'Date', expected: '2023-01-01T00:00:00.000Z' }
      ];

      for (const testCase of testCases) {
        const operation: JCRPropertyOperation = {
          path: '/content/test/page',
          property: 'test:property',
          value: testCase.value,
          type: testCase.type as any,
          operation: 'set'
        };

        mockClient.post.mockResolvedValue(mockPropertyResponse);

        await systemService.manipulateJCRProperty(operation);
        
        const formData = mockClient.post.mock.calls[mockClient.post.mock.calls.length - 1][1] as FormData;
        expect(formData.get('test:property')).toBe(testCase.expected);
        expect(formData.get('test:property@TypeHint')).toBe(testCase.type);
      }
    });

    it('should throw validation error for missing path', async () => {
      const operation: JCRPropertyOperation = {
        path: '',
        property: 'test:property',
        value: 'test',
        operation: 'set'
      };

      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow(AEMException);
      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow('Path and property name are required');
    });

    it('should throw validation error for missing property name', async () => {
      const operation: JCRPropertyOperation = {
        path: '/content/test',
        property: '',
        value: 'test',
        operation: 'set'
      };

      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow(AEMException);
      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow('Path and property name are required');
    });

    it('should throw validation error for invalid JCR path', async () => {
      const operation: JCRPropertyOperation = {
        path: 'invalid-path',
        property: 'test:property',
        value: 'test',
        operation: 'set'
      };

      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow(AEMException);
      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow('Invalid JCR path format');
    });

    it('should throw validation error for invalid property name', async () => {
      const invalidPropertyNames = ['property/name', 'property[name]', 'property:name|invalid', 'property*name'];
      
      for (const invalidProperty of invalidPropertyNames) {
        const operation: JCRPropertyOperation = {
          path: '/content/test',
          property: invalidProperty,
          value: 'test',
          operation: 'set'
        };

        await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow(AEMException);
        await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow('Invalid property name format');
      }
    });

    it('should throw error when trying to manipulate system properties', async () => {
      const systemProperties = [
        'jcr:primaryType',
        'jcr:mixinTypes',
        'jcr:uuid',
        'jcr:created',
        'jcr:createdBy',
        'sling:resourceType',
        'rep:policy',
        'oak:index'
      ];
      
      for (const systemProperty of systemProperties) {
        const operation: JCRPropertyOperation = {
          path: '/content/test',
          property: systemProperty,
          value: 'test',
          operation: 'set'
        };

        await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow(AEMException);
        await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow('Cannot manipulate system property');
      }
    });

    it('should throw validation error for set operation without value', async () => {
      const operation: JCRPropertyOperation = {
        path: '/content/test',
        property: 'test:property',
        operation: 'set'
      };

      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow(AEMException);
      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow('Value is required for set operation');
    });

    it('should throw validation error for add operation with non-array value', async () => {
      const operation: JCRPropertyOperation = {
        path: '/content/test',
        property: 'test:property',
        value: 'single-value',
        operation: 'add'
      };

      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow(AEMException);
      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow('Value must be an array for add operation');
    });

    it('should throw validation error for remove operation with non-array value', async () => {
      const operation: JCRPropertyOperation = {
        path: '/content/test',
        property: 'test:property',
        value: 'single-value',
        operation: 'remove'
      };

      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow(AEMException);
      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow('Value must be an array for remove operation');
    });

    it('should throw validation error for invalid operation', async () => {
      const operation: JCRPropertyOperation = {
        path: '/content/test',
        property: 'test:property',
        value: 'test',
        operation: 'invalid' as any
      };

      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow(AEMException);
      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow('Invalid operation: invalid');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockClient.post.mockRejectedValue(networkError);

      const config: ACLConfig = {
        path: '/content/test',
        entries: [
          {
            principal: 'test-user',
            privileges: ['jcr:read'],
            allow: true
          }
        ]
      };

      await expect(systemService.applyACLConfig(config)).rejects.toThrow(AEMException);
      await expect(systemService.applyACLConfig(config)).rejects.toThrow('Unexpected error while applying ACL configuration');
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.post.mockRejectedValue(originalError);

      await expect(systemService.deleteAsyncJob('test-job')).rejects.toThrow('Original error');
    });

    it('should handle malformed responses', async () => {
      const malformedResponse = {
        success: false,
        data: null
      };
      mockClient.post.mockResolvedValue(malformedResponse);

      const operation: JCRPropertyOperation = {
        path: '/content/test',
        property: 'test:property',
        value: 'test',
        operation: 'set'
      };

      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow(AEMException);
      await expect(systemService.manipulateJCRProperty(operation)).rejects.toThrow('Failed to manipulate JCR property');
    });
  });

  describe('validation helpers', () => {
    it('should validate JCR paths correctly', async () => {
      // Valid paths should not throw
      const validPaths = [
        '/content',
        '/content/test',
        '/content/test/page',
        '/apps/myproject/components',
        '/etc/designs/mysite'
      ];
      
      const config: ACLConfig = {
        path: '',
        entries: [
          {
            principal: 'test-user',
            privileges: ['jcr:read'],
            allow: true
          }
        ]
      };

      mockClient.post.mockResolvedValue({ success: true, data: { success: true } });

      for (const validPath of validPaths) {
        config.path = validPath;
        await expect(systemService.applyACLConfig(config)).resolves.toBeDefined();
      }
      
      // Invalid paths should throw
      const invalidPaths = [
        'content',           // doesn't start with /
        '/content/',         // ends with /
        '/content//test',    // double slash
        '/content/test<>',   // invalid characters
        '',                  // empty
        'a'.repeat(1001)     // too long
      ];
      
      for (const invalidPath of invalidPaths) {
        config.path = invalidPath;
        await expect(systemService.applyACLConfig(config)).rejects.toThrow();
      }
    });
  });
});
