/**
 * Unit tests for Component Operations Service
 */

import { ComponentOperationsService, CreateComponentOptions, UpdateComponentOptions, DeleteComponentOptions, BulkUpdateOptions, ComponentUpdate, ValidationOptions, ComponentOperationResult, BulkUpdateResult, ValidationResult } from '../services/component-operations-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('ComponentOperationsService', () => {
  let componentService: ComponentOperationsService;
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

    componentService = new ComponentOperationsService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createComponent', () => {
    const mockCreateResponse = {
      success: true,
      data: {
        success: true,
        path: '/content/mysite/en/home/jcr:content/root/container/new_component',
        message: 'Component created successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 150
      }
    };

    it('should create component successfully', async () => {
      const pagePath = '/content/mysite/en/home';
      const containerPath = 'root/container';
      const options: CreateComponentOptions = {
        resourceType: 'mysite/components/content/text',
        name: 'new_component',
        properties: {
          'text': '<p>Hello World</p>',
          'textIsRich': 'true'
        }
      };

      mockClient.post.mockResolvedValue(mockCreateResponse);

      const result = await componentService.createComponent(pagePath, containerPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe('/content/mysite/en/home/jcr:content/root/container/new_component');
      expect(result.data!.message).toBe('Component created successfully');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/content/mysite/en/home/jcr:content/root/container/new_component',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'createComponent',
            resource: '/content/mysite/en/home/jcr:content/root/container/new_component'
          }
        })
      );
    });

    it('should generate component name if not provided', async () => {
      const pagePath = '/content/mysite/en/home';
      const containerPath = 'root/container';
      const options: CreateComponentOptions = {
        resourceType: 'mysite/components/content/text',
        properties: {
          'text': '<p>Hello World</p>'
        }
      };

      mockClient.post.mockResolvedValue(mockCreateResponse);

      const result = await componentService.createComponent(pagePath, containerPath, options);

      expect(result.success).toBe(true);
      expect(mockClient.post).toHaveBeenCalled();
      
      // Check that the path contains the resource type name
      const postPath = mockClient.post.mock.calls[0][0];
      expect(postPath).toContain('text_');
    });

    it('should handle component ordering', async () => {
      const pagePath = '/content/mysite/en/home';
      const containerPath = 'root/container';
      
      // Test insertBefore
      const beforeOptions: CreateComponentOptions = {
        resourceType: 'mysite/components/content/text',
        name: 'before_component',
        insertBefore: 'existing_component'
      };

      mockClient.post.mockResolvedValue(mockCreateResponse);

      await componentService.createComponent(pagePath, containerPath, beforeOptions);
      
      expect(mockClient.post.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          ':order': 'before existing_component'
        })
      );

      jest.clearAllMocks();
      mockClient.post.mockResolvedValue(mockCreateResponse);

      // Test insertAfter
      const afterOptions: CreateComponentOptions = {
        resourceType: 'mysite/components/content/text',
        name: 'after_component',
        insertAfter: 'existing_component'
      };

      await componentService.createComponent(pagePath, containerPath, afterOptions);
      
      expect(mockClient.post.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          ':order': 'after existing_component'
        })
      );
    });

    it('should throw validation error for missing required fields', async () => {
      await expect(componentService.createComponent('', 'container', { resourceType: 'type' })).rejects.toThrow(AEMException);
      await expect(componentService.createComponent('/page', '', { resourceType: 'type' })).rejects.toThrow(AEMException);
      await expect(componentService.createComponent('/page', 'container', {} as CreateComponentOptions)).rejects.toThrow(AEMException);
    });
  });

  describe('updateComponent', () => {
    const mockUpdateResponse = {
      success: true,
      data: {
        success: true,
        path: '/content/mysite/en/home/jcr:content/root/container/component',
        message: 'Component updated successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100
      }
    };

    it('should update component successfully', async () => {
      const componentPath = '/content/mysite/en/home/jcr:content/root/container/component';
      const properties = {
        'text': '<p>Updated text</p>',
        'textIsRich': 'true',
        'customProperty': 'customValue'
      };
      const options: UpdateComponentOptions = {
        merge: true,
        replaceProperties: false
      };

      mockClient.post.mockResolvedValue(mockUpdateResponse);

      const result = await componentService.updateComponent(componentPath, properties, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe(componentPath);
      expect(result.data!.message).toBe('Component updated successfully');

      expect(mockClient.post).toHaveBeenCalledWith(
        componentPath,
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'updateComponent',
            resource: componentPath
          }
        })
      );
    });

    it('should handle array properties correctly', async () => {
      const componentPath = '/content/mysite/en/home/jcr:content/root/container/component';
      const properties = {
        'items': ['item1', 'item2', 'item3'],
        'multiValueProperty': ['value1', 'value2']
      };

      mockClient.post.mockResolvedValue(mockUpdateResponse);

      const result = await componentService.updateComponent(componentPath, properties);

      expect(result.success).toBe(true);
      expect(mockClient.post).toHaveBeenCalled();
    });

    it('should validate component before update when requested', async () => {
      const componentPath = '/content/mysite/en/home/jcr:content/root/container/component';
      const properties = {
        'text': '<p>Updated text</p>'
      };
      const options: UpdateComponentOptions = {
        validateBeforeUpdate: true
      };

      // Mock validation to fail
      jest.spyOn(componentService as any, 'validateComponent').mockResolvedValue({
        valid: false,
        errors: ['Validation error'],
        warnings: []
      });

      await expect(componentService.updateComponent(componentPath, properties, options)).rejects.toThrow(AEMException);
      await expect(componentService.updateComponent(componentPath, properties, options)).rejects.toThrow('Component validation failed');

      // Mock validation to succeed
      (componentService as any).validateComponent.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      });

      mockClient.post.mockResolvedValue(mockUpdateResponse);
      const result = await componentService.updateComponent(componentPath, properties, options);
      expect(result.success).toBe(true);
    });

    it('should throw validation error for missing required fields', async () => {
      await expect(componentService.updateComponent('', { prop: 'value' })).rejects.toThrow(AEMException);
      await expect(componentService.updateComponent('/path', {})).rejects.toThrow(AEMException);
      await expect(componentService.updateComponent('', {})).rejects.toThrow('Component path and properties are required');
    });
  });

  describe('deleteComponent', () => {
    const mockDeleteResponse = {
      success: true,
      data: {
        success: true,
        message: 'Component deleted successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 80
      }
    };

    it('should delete component successfully', async () => {
      const componentPath = '/content/mysite/en/home/jcr:content/root/container/component';
      const options: DeleteComponentOptions = {
        force: true,
        checkReferences: true
      };

      mockClient.post.mockResolvedValue(mockDeleteResponse);

      const result = await componentService.deleteComponent(componentPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.message).toBe('Component deleted successfully');

      expect(mockClient.post).toHaveBeenCalledWith(
        componentPath,
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'deleteComponent',
            resource: componentPath
          }
        })
      );
    });

    it('should throw validation error for empty component path', async () => {
      await expect(componentService.deleteComponent('')).rejects.toThrow(AEMException);
      await expect(componentService.deleteComponent('')).rejects.toThrow('Component path is required');
    });

    it('should prevent deletion of critical components', async () => {
      const criticalComponents = [
        '/content/mysite/en/home/jcr:content/root',
        '/content/mysite/en/home/jcr:content/header',
        '/content/mysite/en/home/jcr:content/footer',
        '/content/mysite/en/home/jcr:content/navigation'
      ];

      for (const criticalComponent of criticalComponents) {
        await expect(componentService.deleteComponent(criticalComponent)).rejects.toThrow(AEMException);
        await expect(componentService.deleteComponent(criticalComponent)).rejects.toThrow('Cannot delete critical component');
      }
    });

    it('should allow deletion of regular components', async () => {
      const regularComponents = [
        '/content/mysite/en/home/jcr:content/root/container/text',
        '/content/mysite/en/home/jcr:content/root/container/image',
        '/content/mysite/en/home/jcr:content/root/container/button'
      ];

      mockClient.post.mockResolvedValue(mockDeleteResponse);

      for (const regularComponent of regularComponents) {
        const result = await componentService.deleteComponent(regularComponent);
        expect(result.success).toBe(true);
        jest.clearAllMocks();
        mockClient.post.mockResolvedValue(mockDeleteResponse);
      }
    });
  });

  describe('bulkUpdateComponents', () => {
    it('should update multiple components in bulk successfully', async () => {
      const updates: ComponentUpdate[] = [
        {
          componentPath: '/content/mysite/en/home/jcr:content/root/container/component1',
          properties: { 'text': 'Updated text 1' }
        },
        {
          componentPath: '/content/mysite/en/home/jcr:content/root/container/component2',
          properties: { 'text': 'Updated text 2' }
        },
        {
          componentPath: '/content/mysite/en/home/jcr:content/root/container/component3',
          properties: { 'text': 'Updated text 3' }
        }
      ];

      const mockUpdateResponse = {
        success: true,
        data: {
          success: true,
          message: 'Component updated successfully'
        }
      };

      mockClient.post.mockResolvedValue(mockUpdateResponse);

      const result = await componentService.bulkUpdateComponents(updates);

      expect(result.success).toBe(true);
      expect(result.data!.totalComponents).toBe(3);
      expect(result.data!.successfulUpdates).toBe(3);
      expect(result.data!.failedUpdates).toBe(0);
      expect(result.data!.results).toHaveLength(3);

      expect(mockClient.post).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in bulk update', async () => {
      const updates: ComponentUpdate[] = [
        {
          componentPath: '/content/mysite/en/home/jcr:content/root/container/component1',
          properties: { 'text': 'Updated text 1' }
        },
        {
          componentPath: '/content/mysite/en/home/jcr:content/root/container/component2',
          properties: { 'text': 'Updated text 2' }
        }
      ];

      mockClient.post
        .mockResolvedValueOnce({
          success: true,
          data: { success: true, message: 'Success' }
        })
        .mockRejectedValueOnce(new AEMException('Update failed', 'SERVER_ERROR', false));

      const options: BulkUpdateOptions = {
        continueOnError: true
      };

      const result = await componentService.bulkUpdateComponents(updates, options);

      expect(result.success).toBe(true);
      expect(result.data!.totalComponents).toBe(2);
      expect(result.data!.successfulUpdates).toBe(1);
      expect(result.data!.failedUpdates).toBe(1);
      expect(result.data!.results[0].success).toBe(true);
      expect(result.data!.results[1].success).toBe(false);
      expect(result.data!.results[1].error).toBe('Update failed');
    });

    it('should perform rollback on failure when requested', async () => {
      const updates: ComponentUpdate[] = [
        {
          componentPath: '/content/mysite/en/home/jcr:content/root/container/component1',
          properties: { 'text': 'Updated text 1' }
        },
        {
          componentPath: '/content/mysite/en/home/jcr:content/root/container/component2',
          properties: { 'text': 'Updated text 2' }
        }
      ];

      // Mock getComponentState and restoreComponentState
      jest.spyOn(componentService as any, 'getComponentState').mockResolvedValue({ 'text': 'Original text' });
      const restoreSpy = jest.spyOn(componentService as any, 'restoreComponentState').mockResolvedValue(undefined);

      mockClient.post
        .mockResolvedValueOnce({
          success: true,
          data: { success: true, message: 'Success' }
        })
        .mockRejectedValueOnce(new AEMException('Update failed', 'SERVER_ERROR', false));

      const options: BulkUpdateOptions = {
        rollbackOnFailure: true
      };

      await expect(componentService.bulkUpdateComponents(updates, options)).rejects.toThrow(AEMException);
      expect(restoreSpy).toHaveBeenCalled();
    });

    it('should throw validation error for empty updates array', async () => {
      await expect(componentService.bulkUpdateComponents([])).rejects.toThrow(AEMException);
      await expect(componentService.bulkUpdateComponents([])).rejects.toThrow('At least one component update is required');
    });
  });

  describe('validateComponent', () => {
    it('should validate component successfully', async () => {
      const componentPath = '/content/mysite/en/home/jcr:content/root/container/component';
      const properties = {
        'sling:resourceType': 'mysite/components/content/text',
        'text': '<p>Valid text</p>'
      };
      const options: ValidationOptions = {
        checkResourceType: true,
        validateProperties: true
      };

      const result = await componentService.validateComponent(componentPath, properties, options);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid component path', async () => {
      const invalidPaths = [
        '',
        '/invalid/path/without/jcr:content'
      ];

      for (const path of invalidPaths) {
        const result = await componentService.validateComponent(path, { 'prop': 'value' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid component path format');
      }
    });

    it('should detect invalid resource types', async () => {
      const componentPath = '/content/mysite/en/home/jcr:content/root/container/component';
      const invalidResourceTypes = [
        '/invalid/starts/with/slash',
        'invalid/ends/with/slash/',
        '',
        'no-slash'
      ];

      for (const resourceType of invalidResourceTypes) {
        const result = await componentService.validateComponent(
          componentPath, 
          { 'sling:resourceType': resourceType },
          { checkResourceType: true }
        );
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`Invalid resource type: ${resourceType}`);
      }
    });

    it('should detect potentially unsafe content', async () => {
      const componentPath = '/content/mysite/en/home/jcr:content/root/container/component';
      const properties = {
        'text': '<script>alert("XSS")</script>'
      };

      const result = await componentService.validateComponent(
        componentPath, 
        properties,
        { validateProperties: true }
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Potentially unsafe content in property: text');
    });

    it('should warn about reserved property names', async () => {
      const componentPath = '/content/mysite/en/home/jcr:content/root/container/component';
      const properties = {
        'jcr:primaryType': 'nt:unstructured',
        'jcr:created': new Date().toISOString()
      };

      const result = await componentService.validateComponent(
        componentPath, 
        properties,
        { validateProperties: true }
      );

      expect(result.warnings).toContain('Using reserved property name: jcr:primaryType');
      expect(result.warnings).toContain('Using reserved property name: jcr:created');
    });

    it('should provide suggestions in strict mode', async () => {
      const componentPath = '/content/mysite/en/home/jcr:content/root/container/component';
      const properties = {
        'text': 'Some text'
      };

      const result = await componentService.validateComponent(
        componentPath, 
        properties,
        { strict: true }
      );

      expect(result.warnings).toContain('Missing jcr:primaryType property');
      expect(result.suggestions).toContain('Consider adding jcr:primaryType=nt:unstructured');
    });
  });

  describe('updateImagePath', () => {
    const mockUpdateResponse = {
      success: true,
      data: {
        success: true,
        message: 'Component updated successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 70
      }
    };

    it('should update image path successfully', async () => {
      const componentPath = '/content/mysite/en/home/jcr:content/root/container/image';
      const newImagePath = '/content/dam/mysite/images/new-image.jpg';

      mockClient.post.mockResolvedValue(mockUpdateResponse);

      const result = await componentService.updateImagePath(componentPath, newImagePath);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);

      expect(mockClient.post).toHaveBeenCalledWith(
        componentPath,
        expect.objectContaining({
          'fileReference': newImagePath,
          'alt': 'new-image'
        }),
        expect.any(Object)
      );
    });

    it('should update image path with custom property name', async () => {
      const componentPath = '/content/mysite/en/home/jcr:content/root/container/image';
      const newImagePath = '/content/dam/mysite/images/new-image.jpg';
      const imageProperty = 'customImageReference';

      mockClient.post.mockResolvedValue(mockUpdateResponse);

      const result = await componentService.updateImagePath(componentPath, newImagePath, imageProperty);

      expect(result.success).toBe(true);
      expect(mockClient.post).toHaveBeenCalledWith(
        componentPath,
        expect.objectContaining({
          [imageProperty]: newImagePath
        }),
        expect.any(Object)
      );
    });

    it('should throw validation error for invalid image path', async () => {
      const componentPath = '/content/mysite/en/home/jcr:content/root/container/image';
      const invalidImagePaths = [
        '',
        '/invalid/path/not/in/dam',
        '/content/not-dam/image.jpg'
      ];

      for (const invalidPath of invalidImagePaths) {
        await expect(componentService.updateImagePath(componentPath, invalidPath)).rejects.toThrow(AEMException);
        await expect(componentService.updateImagePath(componentPath, invalidPath)).rejects.toThrow('Image path must be a DAM asset path');
      }
    });

    it('should generate alt text from filename', async () => {
      const componentPath = '/content/mysite/en/home/jcr:content/root/container/image';
      const testCases = [
        { path: '/content/dam/mysite/images/test-image.jpg', expected: 'test image' },
        { path: '/content/dam/mysite/images/sample_photo.png', expected: 'sample photo' },
        { path: '/content/dam/mysite/images/product_123.jpeg', expected: 'product 123' }
      ];

      mockClient.post.mockResolvedValue(mockUpdateResponse);

      for (const testCase of testCases) {
        await componentService.updateImagePath(componentPath, testCase.path);
        
        expect(mockClient.post).toHaveBeenCalledWith(
          componentPath,
          expect.objectContaining({
            'fileReference': testCase.path,
            'alt': testCase.expected
          }),
          expect.any(Object)
        );
        
        jest.clearAllMocks();
        mockClient.post.mockResolvedValue(mockUpdateResponse);
      }
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockClient.post.mockRejectedValue(networkError);

      await expect(componentService.createComponent('/page', 'container', { resourceType: 'type' })).rejects.toThrow(AEMException);
      await expect(componentService.createComponent('/page', 'container', { resourceType: 'type' })).rejects.toThrow('Unexpected error while creating component');
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.post.mockRejectedValue(originalError);

      await expect(componentService.updateComponent('/path', { prop: 'value' })).rejects.toThrow('Original error');
    });

    it('should handle malformed responses', async () => {
      const malformedResponse = {
        success: false,
        data: null
      };
      mockClient.post.mockResolvedValue(malformedResponse);

      await expect(componentService.deleteComponent('/path')).rejects.toThrow(AEMException);
      await expect(componentService.deleteComponent('/path')).rejects.toThrow('Failed to delete component');
    });
  });
});
