/**
 * Unit tests for Tag Management Service
 */

import { TagManagementService, TagNamespace, TagDetails, TaggedContentResponse, TagHierarchy, ListTagsOptions, ListTaggedContentOptions } from '../services/tag-management-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('TagManagementService', () => {
  let tagService: TagManagementService;
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

    tagService = new TagManagementService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listTagNamespaces', () => {
    const mockNamespacesResponse = {
      success: true,
      data: {
        'jcr:primaryType': 'cq:Folder',
        'mysite': {
          'jcr:primaryType': 'cq:Tag',
          'jcr:title': 'My Site Tags',
          'jcr:description': 'Tags for My Site',
          'jcr:created': '2024-01-01T00:00:00.000Z',
          'jcr:lastModified': '2024-01-02T00:00:00.000Z',
          'category': {
            'jcr:primaryType': 'cq:Tag',
            'jcr:title': 'Categories'
          },
          'topic': {
            'jcr:primaryType': 'cq:Tag',
            'jcr:title': 'Topics'
          }
        },
        'workflow': {
          'jcr:primaryType': 'cq:Tag',
          'jcr:title': 'Workflow Tags',
          'status': {
            'jcr:primaryType': 'cq:Tag',
            'jcr:title': 'Status'
          }
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100,
        cached: false
      }
    };

    it('should list tag namespaces successfully', async () => {
      mockClient.get.mockResolvedValue(mockNamespacesResponse);

      const result = await tagService.listTagNamespaces();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      
      const mysiteNamespace = result.data![0];
      expect(mysiteNamespace.id).toBe('mysite');
      expect(mysiteNamespace.title).toBe('My Site Tags');
      expect(mysiteNamespace.description).toBe('Tags for My Site');
      expect(mysiteNamespace.path).toBe('/content/cq:tags/mysite');
      expect(mysiteNamespace.tagCount).toBe(2); // category and topic

      const workflowNamespace = result.data![1];
      expect(workflowNamespace.id).toBe('workflow');
      expect(workflowNamespace.tagCount).toBe(1); // status

      expect(mockClient.get).toHaveBeenCalledWith(
        '/content/cq:tags.1.json',
        undefined,
        expect.objectContaining({
          cache: true,
          cacheTtl: 600000,
          context: {
            operation: 'listTagNamespaces',
            resource: '/content/cq:tags'
          }
        })
      );
    });

    it('should handle empty namespaces', async () => {
      const emptyResponse = {
        ...mockNamespacesResponse,
        data: {
          'jcr:primaryType': 'cq:Folder'
        }
      };
      mockClient.get.mockResolvedValue(emptyResponse);

      const result = await tagService.listTagNamespaces();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('listTags', () => {
    const mockTagsResponse = {
      success: true,
      data: {
        'jcr:primaryType': 'cq:Tag',
        'jcr:title': 'My Site Tags',
        'category': {
          'jcr:primaryType': 'cq:Tag',
          'jcr:title': 'Categories',
          'jcr:description': 'Content categories',
          'jcr:created': '2024-01-01T00:00:00.000Z',
          'news': {
            'jcr:primaryType': 'cq:Tag',
            'jcr:title': 'News'
          },
          'events': {
            'jcr:primaryType': 'cq:Tag',
            'jcr:title': 'Events'
          }
        },
        'topic': {
          'jcr:primaryType': 'cq:Tag',
          'jcr:title': 'Topics',
          'technology': {
            'jcr:primaryType': 'cq:Tag',
            'jcr:title': 'Technology'
          }
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 80,
        cached: false
      }
    };

    it('should list tags successfully', async () => {
      mockClient.get.mockResolvedValue(mockTagsResponse);

      const result = await tagService.listTags();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      
      const categoryTag = result.data![0];
      expect(categoryTag.id).toBe('category');
      expect(categoryTag.title).toBe('Categories');
      expect(categoryTag.description).toBe('Content categories');
      expect(categoryTag.childCount).toBe(2);
      expect(categoryTag.children).toHaveLength(2);

      const topicTag = result.data![1];
      expect(topicTag.id).toBe('topic');
      expect(topicTag.childCount).toBe(1);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/content/cq:tags.1.json',
        undefined,
        expect.objectContaining({
          cache: true,
          cacheTtl: 300000,
          context: {
            operation: 'listTags',
            resource: '/content/cq:tags'
          }
        })
      );
    });

    it('should list tags with namespace filter', async () => {
      mockClient.get.mockResolvedValue(mockTagsResponse);

      const options: ListTagsOptions = {
        namespace: 'mysite',
        includeChildren: true,
        maxDepth: 3
      };

      await tagService.listTags(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/content/cq:tags/mysite.3.json',
        undefined,
        expect.any(Object)
      );
    });

    it('should list tags with parent tag filter', async () => {
      mockClient.get.mockResolvedValue(mockTagsResponse);

      const options: ListTagsOptions = {
        parentTag: 'mysite/category',
        orderBy: 'title',
        orderDirection: 'desc'
      };

      await tagService.listTags(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/content/cq:tags/mysite/category.1.json',
        undefined,
        expect.any(Object)
      );
    });

    it('should apply sorting and pagination', async () => {
      const unsortedResponse = {
        ...mockTagsResponse,
        data: {
          'jcr:primaryType': 'cq:Tag',
          'zebra': {
            'jcr:primaryType': 'cq:Tag',
            'jcr:title': 'Zebra'
          },
          'alpha': {
            'jcr:primaryType': 'cq:Tag',
            'jcr:title': 'Alpha'
          },
          'beta': {
            'jcr:primaryType': 'cq:Tag',
            'jcr:title': 'Beta'
          }
        }
      };
      mockClient.get.mockResolvedValue(unsortedResponse);

      const options: ListTagsOptions = {
        orderBy: 'title',
        orderDirection: 'asc',
        limit: 2,
        offset: 1
      };

      const result = await tagService.listTags(options);

      expect(result.data).toHaveLength(2);
      expect(result.data![0].title).toBe('Beta');
      expect(result.data![1].title).toBe('Zebra');
    });
  });

  describe('getTagDetails', () => {
    const mockTagDetailsResponse = {
      success: true,
      data: {
        'jcr:primaryType': 'cq:Tag',
        'jcr:title': 'Technology',
        'jcr:description': 'Technology related content',
        'jcr:created': '2024-01-01T00:00:00.000Z',
        'jcr:lastModified': '2024-01-02T00:00:00.000Z',
        'jcr:title.de': 'Technologie',
        'jcr:description.de': 'Technologie-bezogene Inhalte',
        'jcr:title.fr': 'Technologie',
        'jcr:description.fr': 'Contenu lié à la technologie',
        'ai': {
          'jcr:primaryType': 'cq:Tag',
          'jcr:title': 'Artificial Intelligence'
        },
        'cloud': {
          'jcr:primaryType': 'cq:Tag',
          'jcr:title': 'Cloud Computing'
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 60,
        cached: false
      }
    };

    it('should get tag details successfully', async () => {
      mockClient.get.mockResolvedValue(mockTagDetailsResponse);

      const result = await tagService.getTagDetails('mysite/topic/technology');

      expect(result.success).toBe(true);
      expect(result.data!.id).toBe('mysite/topic/technology');
      expect(result.data!.title).toBe('Technology');
      expect(result.data!.description).toBe('Technology related content');
      expect(result.data!.childCount).toBe(2);
      expect(result.data!.children).toHaveLength(2);
      
      // Check translations
      expect(result.data!.translations).toBeDefined();
      expect(result.data!.translations!['de']).toEqual({
        title: 'Technologie',
        description: 'Technologie-bezogene Inhalte',
        locale: 'de'
      });
      expect(result.data!.translations!['fr']).toEqual({
        title: 'Technologie',
        description: 'Contenu lié à la technologie',
        locale: 'fr'
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/content/cq:tags/mysite/topic/technology.json',
        undefined,
        expect.objectContaining({
          cache: true,
          cacheTtl: 300000,
          context: {
            operation: 'getTagDetails',
            resource: '/content/cq:tags/mysite/topic/technology'
          }
        })
      );
    });

    it('should throw validation error for empty tag ID', async () => {
      await expect(tagService.getTagDetails('')).rejects.toThrow(AEMException);
      await expect(tagService.getTagDetails('')).rejects.toThrow('Tag ID is required');
    });

    it('should throw not found error for non-existent tag', async () => {
      const notFoundResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(notFoundResponse);

      await expect(tagService.getTagDetails('non-existent/tag')).rejects.toThrow(AEMException);
    });
  });

  describe('getTaggedContent', () => {
    const mockTaggedContentResponse = {
      success: true,
      data: {
        hits: [
          {
            path: '/content/mysite/en/news/article1',
            'jcr:title': 'Tech News Article 1',
            'sling:resourceType': 'mysite/components/page',
            'cq:tags': ['mysite/topic/technology', 'mysite/category/news'],
            'jcr:lastModified': '2024-01-01T00:00:00.000Z'
          },
          {
            path: '/content/mysite/en/blog/post1',
            'jcr:title': 'Technology Blog Post',
            'sling:resourceType': 'mysite/components/page',
            'cq:tags': ['mysite/topic/technology'],
            'jcr:lastModified': '2024-01-02T00:00:00.000Z'
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 120,
        cached: false
      }
    };

    it('should get tagged content successfully', async () => {
      mockClient.get.mockResolvedValue(mockTaggedContentResponse);

      const result = await tagService.getTaggedContent('mysite/topic/technology');

      expect(result.success).toBe(true);
      expect(result.data!.tagId).toBe('mysite/topic/technology');
      expect(result.data!.totalContent).toBe(2);
      expect(result.data!.content).toHaveLength(2);
      
      const article1 = result.data!.content[0];
      expect(article1.path).toBe('/content/mysite/en/news/article1');
      expect(article1.title).toBe('Tech News Article 1');
      expect(article1.tags).toEqual(['mysite/topic/technology', 'mysite/category/news']);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        expect.objectContaining({
          'tagid': 'mysite/topic/technology',
          'p.limit': 50,
          'p.offset': 0
        }),
        expect.objectContaining({
          cache: true,
          cacheTtl: 180000,
          context: {
            operation: 'getTaggedContent',
            resource: '/content/cq:tags/mysite/topic/technology'
          }
        })
      );
    });

    it('should get tagged content with options', async () => {
      mockClient.get.mockResolvedValue(mockTaggedContentResponse);

      const options: ListTaggedContentOptions = {
        contentType: 'cq:Page',
        path: '/content/mysite/en',
        includeSubpaths: true,
        orderBy: 'modified',
        orderDirection: 'desc',
        limit: 10,
        offset: 5
      };

      await tagService.getTaggedContent('mysite/topic/technology', options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        expect.objectContaining({
          'tagid': 'mysite/topic/technology',
          'type': 'cq:Page',
          'path': '/content/mysite/en',
          'path.flat': 'false',
          'orderby': '@jcr:lastModified',
          'orderby.sort': 'desc',
          'p.limit': 10,
          'p.offset': 5
        }),
        expect.any(Object)
      );
    });

    it('should handle empty tagged content', async () => {
      const emptyResponse = {
        ...mockTaggedContentResponse,
        data: { hits: [] }
      };
      mockClient.get.mockResolvedValue(emptyResponse);

      const result = await tagService.getTaggedContent('unused/tag');

      expect(result.success).toBe(true);
      expect(result.data!.totalContent).toBe(0);
      expect(result.data!.content).toHaveLength(0);
    });
  });

  describe('getTagHierarchy', () => {
    const mockHierarchyResponse = {
      success: true,
      data: {
        'jcr:primaryType': 'cq:Tag',
        'jcr:title': 'My Site Tags',
        'category': {
          'jcr:primaryType': 'cq:Tag',
          'jcr:title': 'Categories',
          'news': {
            'jcr:primaryType': 'cq:Tag',
            'jcr:title': 'News',
            'breaking': {
              'jcr:primaryType': 'cq:Tag',
              'jcr:title': 'Breaking News'
            }
          },
          'events': {
            'jcr:primaryType': 'cq:Tag',
            'jcr:title': 'Events'
          }
        },
        'topic': {
          'jcr:primaryType': 'cq:Tag',
          'jcr:title': 'Topics',
          'technology': {
            'jcr:primaryType': 'cq:Tag',
            'jcr:title': 'Technology'
          }
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 200,
        cached: false
      }
    };

    it('should get tag hierarchy successfully', async () => {
      mockClient.get.mockResolvedValue(mockHierarchyResponse);

      const result = await tagService.getTagHierarchy('mysite');

      expect(result.success).toBe(true);
      expect(result.data!.rootNamespace).toBe('mysite');
      expect(result.data!.totalTags).toBe(6); // category, news, breaking, events, topic, technology
      expect(result.data!.maxDepth).toBe(2); // breaking news is at level 2
      expect(result.data!.tags).toHaveLength(2); // category and topic at root level

      const categoryTag = result.data!.tags[0];
      expect(categoryTag.id).toBe('mysite/category');
      expect(categoryTag.level).toBe(0);
      expect(categoryTag.hasChildren).toBe(true);
      expect(categoryTag.childCount).toBe(3); // news (with breaking) + events = 3 total
      expect(categoryTag.children).toHaveLength(2); // news and events

      const newsTag = categoryTag.children![0];
      expect(newsTag.id).toBe('mysite/category/news');
      expect(newsTag.level).toBe(1);
      expect(newsTag.hasChildren).toBe(true);
      expect(newsTag.children).toHaveLength(1);

      const breakingTag = newsTag.children![0];
      expect(breakingTag.id).toBe('mysite/category/news/breaking');
      expect(breakingTag.level).toBe(2);
      expect(breakingTag.hasChildren).toBe(false);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/content/cq:tags/mysite.infinity.json',
        undefined,
        expect.objectContaining({
          cache: true,
          cacheTtl: 600000,
          context: {
            operation: 'getTagHierarchy',
            resource: '/content/cq:tags/mysite'
          }
        })
      );
    });

    it('should throw validation error for empty namespace', async () => {
      await expect(tagService.getTagHierarchy('')).rejects.toThrow(AEMException);
      await expect(tagService.getTagHierarchy('')).rejects.toThrow('Namespace is required');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(tagService.listTagNamespaces()).rejects.toThrow(AEMException);
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.get.mockRejectedValue(originalError);

      await expect(tagService.listTags()).rejects.toThrow('Original error');
    });

    it('should handle malformed response data', async () => {
      const malformedResponse = {
        success: true,
        data: 'invalid-data'
      };
      mockClient.get.mockResolvedValue(malformedResponse);

      const result = await tagService.listTagNamespaces();
      expect(result.data).toHaveLength(0);
    });
  });
});
