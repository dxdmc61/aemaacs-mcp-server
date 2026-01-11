/**
 * Unit tests for Content Fragment Operations Service
 */

import { ContentFragmentOperationsService, CreateContentFragmentOptions, UpdateContentFragmentOptions, DeleteContentFragmentOptions, ContentFragmentOperationResult } from '../services/content-fragment-operations-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('ContentFragmentOperationsService', () => {
  let fragmentService: ContentFragmentOperationsService;
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

    fragmentService = new ContentFragmentOperationsService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createContentFragment', () => {
    const mockCreateResponse = {
      success: true,
      data: {
        success: true,
        path: '/content/dam/mysite/fragments/article-fragment',
        message: 'Content fragment created successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 200
      }
    };

    it('should create content fragment successfully', async () => {
      const parentPath = '/content/dam/mysite/fragments';
      const fragmentName = 'article-fragment';
      const options: CreateContentFragmentOptions = {
        model: '/conf/mysite/settings/dam/cfm/models/article',
        title: 'Sample Article Fragment',
        description: 'A sample article content fragment',
        elements: {
          'title': 'Article Title',
          'content': '<p>Article content goes here</p>',
          'author': 'John Doe',
          'publishDate': '2024-01-15'
        },
        tags: ['mysite:content-type/article', 'mysite:category/news'],
        properties: {
          'customProperty': 'customValue'
        }
      };

      mockClient.post.mockResolvedValue(mockCreateResponse);

      const result = await fragmentService.createContentFragment(parentPath, fragmentName, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe('/content/dam/mysite/fragments/article-fragment');
      expect(result.data!.message).toBe('Content fragment created successfully');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/assets/content/dam/mysite/fragments/article-fragment',
        expect.objectContaining({
          'jcr:primaryType': 'dam:Asset',
          'jcr:content': expect.objectContaining({
            'jcr:primaryType': 'dam:AssetContent',
            'contentFragment': true,
            'cq:model': options.model,
            'jcr:title': options.title,
            'jcr:description': options.description,
            'cq:tags': options.tags,
            'data': expect.objectContaining({
              'jcr:primaryType': 'nt:unstructured',
              'cq:model': options.model
            })
          })
        }),
        expect.objectContaining({
          context: {
            operation: 'createContentFragment',
            resource: '/content/dam/mysite/fragments/article-fragment'
          }
        })
      );
    });

    it('should throw validation error for missing required fields', async () => {
      await expect(fragmentService.createContentFragment('', 'fragment', { model: '/model', title: 'Title' })).rejects.toThrow(AEMException);
      await expect(fragmentService.createContentFragment('/content/dam/path', '', { model: '/model', title: 'Title' })).rejects.toThrow(AEMException);
      await expect(fragmentService.createContentFragment('/content/dam/path', 'fragment', {} as CreateContentFragmentOptions)).rejects.toThrow(AEMException);
    });

    it('should throw validation error for invalid fragment name', async () => {
      const invalidNames = ['fragment<name', 'fragment>name', 'fragment:name', 'fragment"name', 'fragment/name', 'fragment\\name', 'fragment|name', 'fragment?name', 'fragment*name'];
      
      for (const invalidName of invalidNames) {
        await expect(fragmentService.createContentFragment('/content/dam/path', invalidName, { model: '/model', title: 'Title' })).rejects.toThrow(AEMException);
        await expect(fragmentService.createContentFragment('/content/dam/path', invalidName, { model: '/model', title: 'Title' })).rejects.toThrow('Invalid fragment name');
      }
    });

    it('should throw validation error for non-DAM parent path', async () => {
      const invalidPaths = ['/content/mysite', '/apps/mysite', '/etc/mysite'];
      
      for (const invalidPath of invalidPaths) {
        await expect(fragmentService.createContentFragment(invalidPath, 'fragment', { model: '/model', title: 'Title' })).rejects.toThrow(AEMException);
        await expect(fragmentService.createContentFragment(invalidPath, 'fragment', { model: '/model', title: 'Title' })).rejects.toThrow('Content fragments must be created in DAM');
      }
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

      await expect(fragmentService.createContentFragment('/content/dam/path', 'fragment', { model: '/model', title: 'Title' })).rejects.toThrow(AEMException);
      await expect(fragmentService.createContentFragment('/content/dam/path', 'fragment', { model: '/model', title: 'Title' })).rejects.toThrow('Failed to create content fragment');
    });
  });

  describe('updateContentFragment', () => {
    const mockUpdateResponse = {
      success: true,
      data: {
        success: true,
        path: '/content/dam/mysite/fragments/article-fragment',
        message: 'Content fragment updated successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 150
      }
    };

    it('should update content fragment successfully', async () => {
      const fragmentPath = '/content/dam/mysite/fragments/article-fragment';
      const options: UpdateContentFragmentOptions = {
        title: 'Updated Article Fragment',
        description: 'Updated description',
        elements: {
          'title': 'Updated Article Title',
          'content': '<p>Updated article content</p>',
          'author': 'Jane Doe'
        },
        tags: ['mysite:content-type/article', 'mysite:category/updated'],
        properties: {
          'lastReview': '2024-01-20'
        }
      };

      mockClient.put.mockResolvedValue(mockUpdateResponse);

      const result = await fragmentService.updateContentFragment(fragmentPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe('/content/dam/mysite/fragments/article-fragment');
      expect(result.data!.message).toBe('Content fragment updated successfully');

      expect(mockClient.put).toHaveBeenCalledWith(
        '/api/assets/content/dam/mysite/fragments/article-fragment/jcr:content',
        expect.objectContaining({
          'jcr:title': options.title,
          'jcr:description': options.description,
          'cq:tags': options.tags,
          'data': expect.any(Object),
          'lastReview': '2024-01-20'
        }),
        expect.objectContaining({
          context: {
            operation: 'updateContentFragment',
            resource: fragmentPath
          }
        })
      );
    });

    it('should update only specified fields', async () => {
      const fragmentPath = '/content/dam/mysite/fragments/article-fragment';
      const options: UpdateContentFragmentOptions = {
        title: 'Updated Title Only'
      };

      mockClient.put.mockResolvedValue(mockUpdateResponse);

      const result = await fragmentService.updateContentFragment(fragmentPath, options);

      expect(result.success).toBe(true);
      
      const payload = mockClient.put.mock.calls[0][1];
      expect(payload).toEqual({
        'jcr:title': 'Updated Title Only'
      });
    });

    it('should throw validation error for missing fragment path', async () => {
      await expect(fragmentService.updateContentFragment('', { title: 'Title' })).rejects.toThrow(AEMException);
      await expect(fragmentService.updateContentFragment('', { title: 'Title' })).rejects.toThrow('Fragment path is required');
    });

    it('should throw validation error for non-DAM fragment path', async () => {
      const invalidPaths = ['/content/mysite/fragment', '/apps/fragment', '/etc/fragment'];
      
      for (const invalidPath of invalidPaths) {
        await expect(fragmentService.updateContentFragment(invalidPath, { title: 'Title' })).rejects.toThrow(AEMException);
        await expect(fragmentService.updateContentFragment(invalidPath, { title: 'Title' })).rejects.toThrow('Content fragment path must be in DAM');
      }
    });
  });

  describe('deleteContentFragment', () => {
    const mockDeleteResponse = {
      success: true,
      data: {
        success: true,
        message: 'Content fragment deleted successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100
      }
    };

    it('should delete content fragment successfully', async () => {
      const fragmentPath = '/content/dam/mysite/fragments/old-fragment';
      const options: DeleteContentFragmentOptions = {
        force: true,
        checkReferences: true
      };

      mockClient.delete.mockResolvedValue(mockDeleteResponse);

      const result = await fragmentService.deleteContentFragment(fragmentPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.message).toBe('Content fragment deleted successfully');

      expect(mockClient.delete).toHaveBeenCalledWith(
        '/api/assets/content/dam/mysite/fragments/old-fragment',
        expect.objectContaining({
          force: 'true',
          checkReferences: 'true'
        }),
        expect.objectContaining({
          context: {
            operation: 'deleteContentFragment',
            resource: fragmentPath
          }
        })
      );
    });

    it('should throw validation error for empty fragment path', async () => {
      await expect(fragmentService.deleteContentFragment('')).rejects.toThrow(AEMException);
      await expect(fragmentService.deleteContentFragment('')).rejects.toThrow('Fragment path is required');
    });

    it('should throw validation error for non-DAM fragment path', async () => {
      const invalidPaths = ['/content/mysite/fragment', '/apps/fragment', '/etc/fragment'];
      
      for (const invalidPath of invalidPaths) {
        await expect(fragmentService.deleteContentFragment(invalidPath)).rejects.toThrow(AEMException);
        await expect(fragmentService.deleteContentFragment(invalidPath)).rejects.toThrow('Content fragment path must be in DAM');
      }
    });

    it('should prevent deletion of system fragments', async () => {
      const systemFragments = [
        '/content/dam/system/fragment',
        '/content/dam/conf/fragment',
        '/content/dam/we-retail/fragment',
        '/content/dam/wknd/fragment'
      ];

      for (const systemFragment of systemFragments) {
        await expect(fragmentService.deleteContentFragment(systemFragment)).rejects.toThrow(AEMException);
        await expect(fragmentService.deleteContentFragment(systemFragment)).rejects.toThrow('Cannot delete system content fragment');
      }
    });

    it('should allow deletion of regular fragments', async () => {
      const regularFragments = [
        '/content/dam/mysite/fragments/article',
        '/content/dam/mycompany/content/fragment',
        '/content/dam/blog/2024/post-fragment'
      ];

      mockClient.delete.mockResolvedValue(mockDeleteResponse);

      for (const regularFragment of regularFragments) {
        const result = await fragmentService.deleteContentFragment(regularFragment);
        expect(result.success).toBe(true);
        jest.clearAllMocks();
        mockClient.delete.mockResolvedValue(mockDeleteResponse);
      }
    });
  });

  describe('element formatting', () => {
    it('should format different element types correctly', async () => {
      const parentPath = '/content/dam/mysite/fragments';
      const fragmentName = 'test-fragment';
      const options: CreateContentFragmentOptions = {
        model: '/conf/mysite/settings/dam/cfm/models/test',
        title: 'Test Fragment',
        elements: {
          'stringElement': 'Simple text',
          'numberElement': 42,
          'booleanElement': true,
          'arrayElement': ['item1', 'item2', 'item3'],
          'objectElement': { type: 'richtext', content: '<p>Rich content</p>' }
        }
      };

      mockClient.post.mockResolvedValue({
        success: true,
        data: { success: true, path: '/content/dam/mysite/fragments/test-fragment' }
      });

      await fragmentService.createContentFragment(parentPath, fragmentName, options);

      const payload = mockClient.post.mock.calls[0][1];
      const data = payload['jcr:content'].data;

      expect(data.stringElement).toEqual({
        'jcr:primaryType': 'nt:unstructured',
        'value': 'Simple text',
        'dataType': 'string'
      });

      expect(data.numberElement).toEqual({
        'jcr:primaryType': 'nt:unstructured',
        'value': '42',
        'dataType': 'number'
      });

      expect(data.booleanElement).toEqual({
        'jcr:primaryType': 'nt:unstructured',
        'value': 'true',
        'dataType': 'boolean'
      });

      expect(data.arrayElement).toEqual({
        'jcr:primaryType': 'nt:unstructured',
        'value': ['item1', 'item2', 'item3'],
        'dataType': 'array'
      });

      expect(data.objectElement).toEqual({
        'jcr:primaryType': 'nt:unstructured',
        'value': JSON.stringify({ type: 'richtext', content: '<p>Rich content</p>' }),
        'dataType': 'json'
      });
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockClient.post.mockRejectedValue(networkError);

      await expect(fragmentService.createContentFragment('/content/dam/path', 'fragment', { model: '/model', title: 'Title' })).rejects.toThrow(AEMException);
      await expect(fragmentService.createContentFragment('/content/dam/path', 'fragment', { model: '/model', title: 'Title' })).rejects.toThrow('Unexpected error while creating content fragment');
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.put.mockRejectedValue(originalError);

      await expect(fragmentService.updateContentFragment('/content/dam/path/fragment', { title: 'Title' })).rejects.toThrow('Original error');
    });

    it('should handle malformed responses', async () => {
      const malformedResponse = {
        success: false,
        data: null
      };
      mockClient.delete.mockResolvedValue(malformedResponse);

      await expect(fragmentService.deleteContentFragment('/content/dam/path/fragment')).rejects.toThrow(AEMException);
      await expect(fragmentService.deleteContentFragment('/content/dam/path/fragment')).rejects.toThrow('Failed to delete content fragment');
    });
  });

  describe('fragment name validation', () => {
    it('should validate fragment names correctly', async () => {
      const validNames = ['fragment', 'my-fragment', 'fragment_123', 'fragment.json', 'fragment-with-dashes'];
      const invalidNames = ['fragment<name', 'fragment>name', 'fragment:name', 'fragment"name', 'fragment/name', 'fragment\\name', 'fragment|name', 'fragment?name', 'fragment*name', '.hidden', 'fragment.'];

      mockClient.post.mockResolvedValue({
        success: true,
        data: { success: true, message: 'Created' }
      });

      // Valid names should work
      for (const validName of validNames) {
        const result = await fragmentService.createContentFragment('/content/dam/path', validName, { model: '/model', title: 'Title' });
        expect(result.success).toBe(true);
        jest.clearAllMocks();
        mockClient.post.mockResolvedValue({
          success: true,
          data: { success: true, message: 'Created' }
        });
      }

      // Invalid names should throw errors
      for (const invalidName of invalidNames) {
        await expect(fragmentService.createContentFragment('/content/dam/path', invalidName, { model: '/model', title: 'Title' })).rejects.toThrow(AEMException);
      }
    });

    it('should reject reserved names', async () => {
      const reservedNames = ['con', 'prn', 'aux', 'nul', 'com1', 'lpt1'];

      for (const reservedName of reservedNames) {
        await expect(fragmentService.createContentFragment('/content/dam/path', reservedName, { model: '/model', title: 'Title' })).rejects.toThrow(AEMException);
        await expect(fragmentService.createContentFragment('/content/dam/path', reservedName.toUpperCase(), { model: '/model', title: 'Title' })).rejects.toThrow(AEMException);
      }
    });

    it('should reject names that are too long', async () => {
      const longName = 'a'.repeat(151); // Over 150 character limit
      await expect(fragmentService.createContentFragment('/content/dam/path', longName, { model: '/model', title: 'Title' })).rejects.toThrow(AEMException);
    });
  });

  describe('system fragment protection', () => {
    it('should identify system fragments correctly', async () => {
      const systemFragments = [
        '/content/dam/system/fragment',
        '/content/dam/conf/fragment',
        '/content/dam/we-retail/fragment',
        '/content/dam/wknd/fragment'
      ];

      for (const systemFragment of systemFragments) {
        await expect(fragmentService.deleteContentFragment(systemFragment)).rejects.toThrow('Cannot delete system content fragment');
      }
    });

    it('should allow deletion of regular fragments', async () => {
      const regularFragments = [
        '/content/dam/mysite/fragments/article',
        '/content/dam/mycompany/content/fragment',
        '/content/dam/blog/2024/post-fragment'
      ];

      mockClient.delete.mockResolvedValue({
        success: true,
        data: { success: true, message: 'Deleted' }
      });

      for (const regularFragment of regularFragments) {
        const result = await fragmentService.deleteContentFragment(regularFragment);
        expect(result.success).toBe(true);
        jest.clearAllMocks();
        mockClient.delete.mockResolvedValue({
          success: true,
          data: { success: true, message: 'Deleted' }
        });
      }
    });
  });
});
