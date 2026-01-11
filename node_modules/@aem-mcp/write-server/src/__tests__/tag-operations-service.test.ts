/**
 * Unit tests for Tag Operations Service
 */

import { TagOperationsService, CreateTagNamespaceOptions, CreateTagOptions, MoveTagOptions, EditTagOptions, DeleteTagOptions } from '../services/tag-operations-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('TagOperationsService', () => {
  let tagService: TagOperationsService;
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

    tagService = new TagOperationsService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTagNamespace', () => {
    const mockCreateNamespaceResponse = {
      success: true,
      data: {
        success: true,
        message: 'Namespace created successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 200
      }
    };

    it('should create tag namespace successfully', async () => {
      const namespace = 'myproject';
      const options: CreateTagNamespaceOptions = {
        title: 'My Project Tags',
        description: 'Tags for my project',
        properties: {
          'custom:property': 'value'
        }
      };

      mockClient.post.mockResolvedValue(mockCreateNamespaceResponse);

      const result = await tagService.createTagNamespace(namespace, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.namespace).toBe(namespace);
      expect(result.data!.namespacePath).toBe('/etc/tags/myproject');
      expect(result.data!.tagId).toBe(namespace);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/bin/tagcommand',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'createTagNamespace',
            resource: namespace
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('cmd')).toBe('createTagByTitle');
      expect(formData.get('tag')).toBe(namespace);
      expect(formData.get('locale')).toBe('en');
      expect(formData.get('title')).toBe('My Project Tags');
      expect(formData.get('description')).toBe('Tags for my project');
      expect(formData.get('custom:property')).toBe('value');
    });

    it('should use namespace as default title when title not provided', async () => {
      const namespace = 'testnamespace';

      mockClient.post.mockResolvedValue(mockCreateNamespaceResponse);

      const result = await tagService.createTagNamespace(namespace);

      expect(result.success).toBe(true);
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('title')).toBe(namespace);
    });

    it('should throw validation error for missing namespace', async () => {
      await expect(tagService.createTagNamespace('')).rejects.toThrow(AEMException);
      await expect(tagService.createTagNamespace('')).rejects.toThrow('Namespace is required');
    });

    it('should throw validation error for invalid namespace format', async () => {
      const invalidNamespaces = ['My Project', 'project/name', 'project:name', 'PROJECT', '-project', 'project-'];
      
      for (const invalidNamespace of invalidNamespaces) {
        await expect(tagService.createTagNamespace(invalidNamespace)).rejects.toThrow(AEMException);
        await expect(tagService.createTagNamespace(invalidNamespace)).rejects.toThrow('Invalid namespace format');
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

      await expect(tagService.createTagNamespace('testnamespace')).rejects.toThrow(AEMException);
      await expect(tagService.createTagNamespace('testnamespace')).rejects.toThrow('Failed to create tag namespace');
    });
  });

  describe('createTag', () => {
    const mockCreateTagResponse = {
      success: true,
      data: {
        success: true,
        message: 'Tag created successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 150
      }
    };

    it('should create tag successfully', async () => {
      const tagId = 'myproject:category1';
      const options: CreateTagOptions = {
        title: 'Category 1',
        description: 'First category tag',
        parentTagId: 'myproject:categories',
        properties: {
          'priority': 'high'
        }
      };

      mockClient.post.mockResolvedValue(mockCreateTagResponse);

      const result = await tagService.createTag(tagId, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.tagId).toBe(tagId);
      expect(result.data!.tagPath).toBe('/etc/tags/myproject/category1');
      expect(result.data!.title).toBe('Category 1');
      expect(result.data!.description).toBe('First category tag');
      expect(result.data!.parentTagId).toBe('myproject:categories');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/bin/tagcommand',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'createTag',
            resource: tagId
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('cmd')).toBe('createTagByTitle');
      expect(formData.get('tag')).toBe(tagId);
      expect(formData.get('locale')).toBe('en');
      expect(formData.get('title')).toBe('Category 1');
      expect(formData.get('description')).toBe('First category tag');
      expect(formData.get('parentTagID')).toBe('myproject:categories');
      expect(formData.get('priority')).toBe('high');
    });

    it('should use tag name as default title when title not provided', async () => {
      const tagId = 'myproject:category1';

      mockClient.post.mockResolvedValue(mockCreateTagResponse);

      const result = await tagService.createTag(tagId);

      expect(result.success).toBe(true);
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('title')).toBe('category1');
    });

    it('should handle nested tag paths correctly', async () => {
      const tagId = 'myproject:categories/subcategory/item';

      mockClient.post.mockResolvedValue(mockCreateTagResponse);

      const result = await tagService.createTag(tagId);

      expect(result.success).toBe(true);
      expect(result.data!.tagPath).toBe('/etc/tags/myproject/categories/subcategory/item');
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('title')).toBe('item');
    });

    it('should throw validation error for missing tag ID', async () => {
      await expect(tagService.createTag('')).rejects.toThrow(AEMException);
      await expect(tagService.createTag('')).rejects.toThrow('Tag ID is required');
    });

    it('should throw validation error for invalid tag ID format', async () => {
      const invalidTagIds = ['invalidtag', 'namespace', 'namespace:', ':tagname', 'namespace tag:name'];\n      \n      for (const invalidTagId of invalidTagIds) {\n        await expect(tagService.createTag(invalidTagId)).rejects.toThrow(AEMException);\n        await expect(tagService.createTag(invalidTagId)).rejects.toThrow('Invalid tag ID format');\n      }\n    });\n  });\n\n  describe('moveTag', () => {\n    const mockMoveTagResponse = {\n      success: true,\n      data: {\n        success: true,\n        message: 'Tag moved successfully'\n      },\n      metadata: {\n        timestamp: new Date(),\n        requestId: 'test-request-id',\n        duration: 200\n      }\n    };\n\n    it('should move tag to new parent successfully', async () => {\n      const tagId = 'myproject:oldcategory/item';\n      const options: MoveTagOptions = {\n        newParentTagId: 'myproject:newcategory'\n      };\n\n      mockClient.post.mockResolvedValue(mockMoveTagResponse);\n\n      const result = await tagService.moveTag(tagId, options);\n\n      expect(result.success).toBe(true);\n      expect(result.data!.success).toBe(true);\n      expect(result.data!.tagId).toBe(tagId);\n      expect(result.data!.oldPath).toBe('/etc/tags/myproject/oldcategory/item');\n      expect(result.data!.newPath).toBe('/etc/tags/myproject/newcategory/item');\n      expect(result.data!.newTagId).toBe('myproject:newcategory/item');\n\n      expect(mockClient.post).toHaveBeenCalledWith(\n        '/bin/tagcommand',\n        expect.any(Object), // FormData\n        expect.objectContaining({\n          context: {\n            operation: 'moveTag',\n            resource: tagId\n          }\n        })\n      );\n      \n      // Verify form data\n      const formData = mockClient.post.mock.calls[0][1] as FormData;\n      expect(formData.get('cmd')).toBe('moveTag');\n      expect(formData.get('tag')).toBe(tagId);\n      expect(formData.get('parentTagID')).toBe('myproject:newcategory');\n    });\n\n    it('should rename tag successfully', async () => {\n      const tagId = 'myproject:oldname';\n      const options: MoveTagOptions = {\n        newName: 'newname'\n      };\n\n      mockClient.post.mockResolvedValue(mockMoveTagResponse);\n\n      const result = await tagService.moveTag(tagId, options);\n\n      expect(result.success).toBe(true);\n      expect(result.data!.newTagId).toBe('myproject:newname');\n      \n      // Verify form data\n      const formData = mockClient.post.mock.calls[0][1] as FormData;\n      expect(formData.get('name')).toBe('newname');\n    });\n\n    it('should throw validation error for missing tag ID', async () => {\n      await expect(tagService.moveTag('')).rejects.toThrow(AEMException);\n      await expect(tagService.moveTag('')).rejects.toThrow('Tag ID is required');\n    });\n\n    it('should throw validation error when no move options provided', async () => {\n      await expect(tagService.moveTag('myproject:tag', {})).rejects.toThrow(AEMException);\n      await expect(tagService.moveTag('myproject:tag', {})).rejects.toThrow('Either new parent tag ID or new name must be provided');\n    });\n  });\n\n  describe('editTag', () => {\n    const mockEditTagResponse = {\n      success: true,\n      data: {\n        success: true,\n        message: 'Tag edited successfully'\n      },\n      metadata: {\n        timestamp: new Date(),\n        requestId: 'test-request-id',\n        duration: 150\n      }\n    };\n\n    it('should edit tag successfully', async () => {\n      const tagId = 'myproject:category1';\n      const options: EditTagOptions = {\n        title: 'Updated Category 1',\n        description: 'Updated description',\n        properties: {\n          'priority': 'medium',\n          'color': 'blue'\n        },\n        translations: {\n          'de': {\n            title: 'Kategorie 1',\n            description: 'Deutsche Beschreibung'\n          },\n          'fr': {\n            title: 'Catégorie 1'\n          }\n        }\n      };\n\n      mockClient.post.mockResolvedValue(mockEditTagResponse);\n\n      const result = await tagService.editTag(tagId, options);\n\n      expect(result.success).toBe(true);\n      expect(result.data!.success).toBe(true);\n      expect(result.data!.tagId).toBe(tagId);\n      expect(result.data!.tagPath).toBe('/etc/tags/myproject/category1');\n      expect(result.data!.title).toBe('Updated Category 1');\n      expect(result.data!.description).toBe('Updated description');\n\n      expect(mockClient.post).toHaveBeenCalledWith(\n        '/bin/tagcommand',\n        expect.any(Object), // FormData\n        expect.objectContaining({\n          context: {\n            operation: 'editTag',\n            resource: tagId\n          }\n        })\n      );\n      \n      // Verify form data\n      const formData = mockClient.post.mock.calls[0][1] as FormData;\n      expect(formData.get('cmd')).toBe('editTag');\n      expect(formData.get('tag')).toBe(tagId);\n      expect(formData.get('locale')).toBe('en');\n      expect(formData.get('title')).toBe('Updated Category 1');\n      expect(formData.get('description')).toBe('Updated description');\n      expect(formData.get('priority')).toBe('medium');\n      expect(formData.get('color')).toBe('blue');\n      expect(formData.get('title_de')).toBe('Kategorie 1');\n      expect(formData.get('description_de')).toBe('Deutsche Beschreibung');\n      expect(formData.get('title_fr')).toBe('Catégorie 1');\n    });\n\n    it('should handle minimal edit options', async () => {\n      const tagId = 'myproject:category1';\n      const options: EditTagOptions = {\n        title: 'New Title Only'\n      };\n\n      mockClient.post.mockResolvedValue(mockEditTagResponse);\n\n      const result = await tagService.editTag(tagId, options);\n\n      expect(result.success).toBe(true);\n      \n      // Verify form data\n      const formData = mockClient.post.mock.calls[0][1] as FormData;\n      expect(formData.get('title')).toBe('New Title Only');\n      expect(formData.get('description')).toBeNull();\n    });\n\n    it('should throw validation error for missing tag ID', async () => {\n      await expect(tagService.editTag('')).rejects.toThrow(AEMException);\n      await expect(tagService.editTag('')).rejects.toThrow('Tag ID is required');\n    });\n  });\n\n  describe('deleteTag', () => {\n    const mockDeleteTagResponse = {\n      success: true,\n      data: {\n        success: true,\n        message: 'Tag deleted successfully'\n      },\n      metadata: {\n        timestamp: new Date(),\n        requestId: 'test-request-id',\n        duration: 100\n      }\n    };\n\n    it('should delete tag successfully', async () => {\n      const tagId = 'myproject:category1';\n      const options: DeleteTagOptions = {\n        force: true,\n        recursive: false\n      };\n\n      mockClient.post.mockResolvedValue(mockDeleteTagResponse);\n\n      const result = await tagService.deleteTag(tagId, options);\n\n      expect(result.success).toBe(true);\n      expect(result.data!.success).toBe(true);\n      expect(result.data!.tagId).toBe(tagId);\n\n      expect(mockClient.post).toHaveBeenCalledWith(\n        '/bin/tagcommand',\n        expect.any(Object), // FormData\n        expect.objectContaining({\n          context: {\n            operation: 'deleteTag',\n            resource: tagId\n          }\n        })\n      );\n      \n      // Verify form data\n      const formData = mockClient.post.mock.calls[0][1] as FormData;\n      expect(formData.get('cmd')).toBe('deleteTag');\n      expect(formData.get('tag')).toBe(tagId);\n      expect(formData.get('force')).toBe('true');\n      expect(formData.get('recursive')).toBe('false');\n    });\n\n    it('should delete tag with default options', async () => {\n      const tagId = 'myproject:category1';\n\n      mockClient.post.mockResolvedValue(mockDeleteTagResponse);\n\n      const result = await tagService.deleteTag(tagId);\n\n      expect(result.success).toBe(true);\n      \n      // Verify form data\n      const formData = mockClient.post.mock.calls[0][1] as FormData;\n      expect(formData.get('force')).toBeNull();\n      expect(formData.get('recursive')).toBeNull();\n    });\n\n    it('should throw validation error for missing tag ID', async () => {\n      await expect(tagService.deleteTag('')).rejects.toThrow(AEMException);\n      await expect(tagService.deleteTag('')).rejects.toThrow('Tag ID is required');\n    });\n\n    it('should throw error when trying to delete system tags', async () => {\n      const systemTags = ['workflow:approved', 'dam:status', 'wcm:tags', 'granite:hidden', 'cq:template', 'sling:resourceType'];\n      \n      for (const systemTag of systemTags) {\n        await expect(tagService.deleteTag(systemTag)).rejects.toThrow(AEMException);\n        await expect(tagService.deleteTag(systemTag)).rejects.toThrow('Cannot delete system tag');\n      }\n    });\n\n    it('should throw error when trying to delete namespace root', async () => {\n      const namespaceRoots = ['myproject', 'default', 'workflow'];\n      \n      for (const namespaceRoot of namespaceRoots) {\n        await expect(tagService.deleteTag(namespaceRoot)).rejects.toThrow(AEMException);\n        await expect(tagService.deleteTag(namespaceRoot)).rejects.toThrow('Cannot delete system tag');\n      }\n    });\n  });\n\n  describe('validation helpers', () => {\n    it('should validate namespace format correctly', async () => {\n      // Valid namespaces\n      const validNamespaces = ['myproject', 'test-namespace', 'project123', 'a', 'very-long-namespace-name'];\n      \n      for (const validNamespace of validNamespaces) {\n        mockClient.post.mockResolvedValue({ success: true, data: { success: true } });\n        await expect(tagService.createTagNamespace(validNamespace)).resolves.toBeDefined();\n      }\n      \n      // Invalid namespaces\n      const invalidNamespaces = [\n        'My Project',     // spaces\n        'project/name',   // slashes\n        'project:name',   // colons\n        'PROJECT',        // uppercase\n        '-project',       // starts with hyphen\n        'project-',       // ends with hyphen\n        '',               // empty\n        'a'.repeat(51)    // too long\n      ];\n      \n      for (const invalidNamespace of invalidNamespaces) {\n        await expect(tagService.createTagNamespace(invalidNamespace)).rejects.toThrow();\n      }\n    });\n\n    it('should validate tag ID format correctly', async () => {\n      // Valid tag IDs\n      const validTagIds = [\n        'myproject:tag1',\n        'namespace:category/subcategory',\n        'test:item-name',\n        'project123:tag123'\n      ];\n      \n      for (const validTagId of validTagIds) {\n        mockClient.post.mockResolvedValue({ success: true, data: { success: true } });\n        await expect(tagService.createTag(validTagId)).resolves.toBeDefined();\n      }\n      \n      // Invalid tag IDs\n      const invalidTagIds = [\n        'invalidtag',     // no colon\n        'namespace',      // no tag part\n        'namespace:',     // empty tag part\n        ':tagname',       // empty namespace\n        'namespace tag:name', // spaces\n        'a'.repeat(201)   // too long\n      ];\n      \n      for (const invalidTagId of invalidTagIds) {\n        await expect(tagService.createTag(invalidTagId)).rejects.toThrow();\n      }\n    });\n\n    it('should build tag paths correctly', async () => {\n      const testCases = [\n        { tagId: 'myproject:category1', expectedPath: '/etc/tags/myproject/category1' },\n        { tagId: 'namespace:parent/child', expectedPath: '/etc/tags/namespace/parent/child' },\n        { tagId: 'test:deep/nested/structure/item', expectedPath: '/etc/tags/test/deep/nested/structure/item' }\n      ];\n\n      mockClient.post.mockResolvedValue({ success: true, data: { success: true } });\n\n      for (const testCase of testCases) {\n        const result = await tagService.createTag(testCase.tagId);\n        expect(result.data!.tagPath).toBe(testCase.expectedPath);\n      }\n    });\n  });\n\n  describe('error handling', () => {\n    it('should handle network errors gracefully', async () => {\n      const networkError = new Error('ECONNREFUSED');\n      mockClient.post.mockRejectedValue(networkError);\n\n      await expect(tagService.createTagNamespace('testnamespace')).rejects.toThrow(AEMException);\n      await expect(tagService.createTagNamespace('testnamespace')).rejects.toThrow('Unexpected error while creating tag namespace');\n    });\n\n    it('should preserve original AEMException', async () => {\n      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);\n      mockClient.post.mockRejectedValue(originalError);\n\n      await expect(tagService.createTag('myproject:tag')).rejects.toThrow('Original error');\n    });\n\n    it('should handle malformed responses', async () => {\n      const malformedResponse = {\n        success: false,\n        data: null\n      };\n      mockClient.post.mockResolvedValue(malformedResponse);\n\n      await expect(tagService.editTag('myproject:tag')).rejects.toThrow(AEMException);\n      await expect(tagService.editTag('myproject:tag')).rejects.toThrow('Failed to edit tag');\n    });\n  });\n});
