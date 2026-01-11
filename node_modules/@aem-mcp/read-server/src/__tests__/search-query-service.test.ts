/**
 * Unit tests for Search and Query Service
 */

import { SearchQueryService, SearchOptions, JCRQueryOptions, EnhancedSearchOptions, AssetSearchOptions, UserSearchOptions, GroupSearchOptions } from '../services/search-query-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('SearchQueryService', () => {
  let searchQueryService: SearchQueryService;
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

    searchQueryService = new SearchQueryService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchContent', () => {
    const mockSearchResponse = {
      success: true,
      data: {
        total: 2,
        hits: [
          {
            path: '/content/mysite/en/page1',
            name: 'page1',
            title: 'Page 1',
            'sling:resourceType': 'mysite/components/page',
            'jcr:lastModified': '2024-01-01T00:00:00.000Z',
            score: 0.95,
            excerpt: 'This is page 1 content...'
          },
          {
            path: '/content/mysite/en/page2',
            name: 'page2',
            title: 'Page 2',
            'sling:resourceType': 'mysite/components/page',
            'jcr:lastModified': '2024-01-02T00:00:00.000Z',
            score: 0.87,
            excerpt: 'This is page 2 content...'
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 150,
        cached: false
      }
    };

    it('should search content successfully', async () => {
      mockClient.get.mockResolvedValue(mockSearchResponse);

      const options: SearchOptions = {
        path: '/content/mysite',
        type: 'cq:Page',
        fulltext: 'test content',
        limit: 10
      };

      const result = await searchQueryService.searchContent(options);

      expect(result.success).toBe(true);
      expect(result.data!.total).toBe(2);
      expect(result.data!.results).toHaveLength(2);
      expect(result.data!.results[0].path).toBe('/content/mysite/en/page1');
      expect(result.data!.results[0].title).toBe('Page 1');
      expect(result.data!.results[0].score).toBe(0.95);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        {
          'p.limit': 10,
          'p.offset': 0,
          'path': '/content/mysite',
          'type': 'cq:Page',
          'fulltext': 'test content'
        },
        expect.objectContaining({
          cache: true,
          cacheTtl: 300000,
          context: {
            operation: 'searchContent',
            resource: '/bin/querybuilder.json'
          }
        })
      );
    });

    it('should search with property filters', async () => {
      mockClient.get.mockResolvedValue(mockSearchResponse);

      const options: SearchOptions = {
        property: 'jcr:title',
        propertyValue: 'Test Page',
        orderBy: 'jcr:lastModified',
        orderDirection: 'desc'
      };

      await searchQueryService.searchContent(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        {
          'p.limit': 20,
          'p.offset': 0,
          'property': 'jcr:title',
          'property.value': 'Test Page',
          'orderby': 'jcr:lastModified',
          'orderby.sort': 'desc'
        },
        expect.any(Object)
      );
    });

    it('should handle empty search results', async () => {
      const emptyResponse = {
        ...mockSearchResponse,
        data: {
          total: 0,
          hits: []
        }
      };
      mockClient.get.mockResolvedValue(emptyResponse);

      const result = await searchQueryService.searchContent();

      expect(result.success).toBe(true);
      expect(result.data!.total).toBe(0);
      expect(result.data!.results).toHaveLength(0);
    });

    it('should throw AEMException on client error', async () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Search service unavailable',
          recoverable: true
        }
      };
      mockClient.get.mockResolvedValue(errorResponse);

      await expect(searchQueryService.searchContent()).rejects.toThrow(AEMException);
    });
  });

  describe('executeJCRQuery', () => {
    const mockJCRQueryResponse = {
      success: true,
      data: {
        hits: [
          {
            path: '/content/mysite/en/page1',
            score: 1.0,
            'jcr:title': 'Page 1',
            'jcr:primaryType': 'cq:Page'
          },
          {
            path: '/content/mysite/en/page2',
            score: 0.8,
            'jcr:title': 'Page 2',
            'jcr:primaryType': 'cq:Page'
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 200,
        cached: false
      }
    };

    it('should execute JCR query successfully', async () => {
      mockClient.get.mockResolvedValue(mockJCRQueryResponse);

      const queryOptions: JCRQueryOptions = {
        type: 'xpath',
        statement: '//element(*, cq:Page)[jcr:contains(., "test")]',
        limit: 50
      };

      const result = await searchQueryService.executeJCRQuery(queryOptions);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].path).toBe('/content/mysite/en/page1');
      expect(result.data![0].score).toBe(1.0);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        {
          'query': '//element(*, cq:Page)[jcr:contains(., "test")]',
          'type': 'xpath',
          'p.limit': 50,
          'p.offset': 0
        },
        expect.objectContaining({
          cache: true,
          cacheTtl: 180000,
          context: {
            operation: 'executeJCRQuery',
            resource: '/bin/querybuilder.json'
          }
        })
      );
    });

    it('should validate and reject dangerous queries', async () => {
      const dangerousQuery: JCRQueryOptions = {
        type: 'sql2',
        statement: 'DELETE FROM [nt:base] WHERE [jcr:path] = "/content/test"'
      };

      await expect(searchQueryService.executeJCRQuery(dangerousQuery)).rejects.toThrow(AEMException);
      await expect(searchQueryService.executeJCRQuery(dangerousQuery)).rejects.toThrow('Query contains potentially dangerous operation: delete');
    });

    it('should validate query type', async () => {
      const invalidQuery: JCRQueryOptions = {
        type: 'invalid' as any,
        statement: 'SELECT * FROM [cq:Page]'
      };

      await expect(searchQueryService.executeJCRQuery(invalidQuery)).rejects.toThrow(AEMException);
      await expect(searchQueryService.executeJCRQuery(invalidQuery)).rejects.toThrow('Invalid query type: invalid');
    });

    it('should reject overly long queries', async () => {
      const longQuery: JCRQueryOptions = {
        type: 'sql2',
        statement: 'A'.repeat(10001)
      };

      await expect(searchQueryService.executeJCRQuery(longQuery)).rejects.toThrow(AEMException);
      await expect(searchQueryService.executeJCRQuery(longQuery)).rejects.toThrow('Query statement is too long');
    });
  });

  describe('enhancedPageSearch', () => {
    const mockSearchResponse = {
      success: true,
      data: {
        total: 1,
        hits: [
          {
            path: '/content/mysite/en/page1',
            name: 'page1',
            title: 'Page 1',
            'sling:resourceType': 'mysite/components/page'
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

    it('should perform enhanced search with primary strategy', async () => {
      mockClient.get.mockResolvedValue(mockSearchResponse);

      const options: EnhancedSearchOptions = {
        path: '/content/mysite',
        fulltext: 'test content',
        fuzzy: true
      };

      const result = await searchQueryService.enhancedPageSearch(options);

      expect(result.success).toBe(true);
      expect(result.data!.results).toHaveLength(1);

      // Should call primary search first
      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        expect.objectContaining({
          'type': 'cq:Page',
          'fulltext': 'test content'
        }),
        expect.any(Object)
      );
    });

    it('should fallback to fuzzy search when primary fails', async () => {
      // First call (primary) returns empty results
      const emptyResponse = {
        ...mockSearchResponse,
        data: { total: 0, hits: [] }
      };
      
      // Second call (fuzzy) returns results
      mockClient.get
        .mockResolvedValueOnce(emptyResponse)
        .mockResolvedValueOnce(mockSearchResponse);

      const options: EnhancedSearchOptions = {
        path: '/content/mysite',
        fulltext: 'test content',
        fuzzy: true
      };

      const result = await searchQueryService.enhancedPageSearch(options);

      expect(result.success).toBe(true);
      expect(result.data!.results).toHaveLength(1);

      // Should call both primary and fuzzy search
      expect(mockClient.get).toHaveBeenCalledTimes(2);
      expect(mockClient.get).toHaveBeenNthCalledWith(2,
        '/bin/querybuilder.json',
        expect.objectContaining({
          'fulltext': 'test content~' // Fuzzy search with ~
        }),
        expect.any(Object)
      );
    });

    it('should fallback to broader path search', async () => {
      // First two calls return empty results
      const emptyResponse = {
        ...mockSearchResponse,
        data: { total: 0, hits: [] }
      };
      
      // Third call (broader path) returns results
      mockClient.get
        .mockResolvedValueOnce(emptyResponse)
        .mockResolvedValueOnce(emptyResponse)
        .mockResolvedValueOnce(mockSearchResponse);

      const options: EnhancedSearchOptions = {
        path: '/content/mysite/en/subpage',
        fulltext: 'test content',
        fuzzy: true
      };

      const result = await searchQueryService.enhancedPageSearch(options);

      expect(result.success).toBe(true);
      expect(result.data!.results).toHaveLength(1);

      // Should call primary, fuzzy, and broader path search
      expect(mockClient.get).toHaveBeenCalledTimes(3);
      expect(mockClient.get).toHaveBeenNthCalledWith(3,
        '/bin/querybuilder.json',
        expect.objectContaining({
          'path': '/content/mysite/en' // Broader path
        }),
        expect.any(Object)
      );
    });

    it('should return empty results when all fallbacks fail', async () => {
      const emptyResponse = {
        ...mockSearchResponse,
        data: { total: 0, hits: [] }
      };
      mockClient.get.mockResolvedValue(emptyResponse);

      const options: EnhancedSearchOptions = {
        path: '/content/mysite/en/subpage',
        fulltext: 'test content',
        fuzzy: true
      };

      const result = await searchQueryService.enhancedPageSearch(options);

      expect(result.success).toBe(true);
      expect(result.data!.total).toBe(0);
      expect(result.data!.results).toHaveLength(0);
    });
  });

  describe('searchAssets', () => {
    const mockAssetSearchResponse = {
      success: true,
      data: {
        total: 2,
        hits: [
          {
            path: '/content/dam/mysite/image1.jpg',
            name: 'image1.jpg',
            'jcr:primaryType': 'dam:Asset',
            'jcr:lastModified': '2024-01-01T00:00:00.000Z',
            'jcr:content': {
              metadata: {
                'dc:format': 'image/jpeg',
                'dc:title': 'Image 1',
                'dam:size': '1024000',
                'tiff:ImageWidth': '1920',
                'tiff:ImageLength': '1080'
              }
            }
          },
          {
            path: '/content/dam/mysite/document.pdf',
            name: 'document.pdf',
            'jcr:primaryType': 'dam:Asset',
            'jcr:lastModified': '2024-01-02T00:00:00.000Z',
            'jcr:content': {
              metadata: {
                'dc:format': 'application/pdf',
                'dc:title': 'Document',
                'dam:size': '2048000'
              }
            }
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

    it('should search assets successfully', async () => {
      mockClient.get.mockResolvedValue(mockAssetSearchResponse);

      const options: AssetSearchOptions = {
        path: '/content/dam/mysite',
        mimeType: 'image/jpeg',
        limit: 25
      };

      const result = await searchQueryService.searchAssets(options);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].path).toBe('/content/dam/mysite/image1.jpg');
      expect(result.data![0].mimeType).toBe('image/jpeg');
      expect(result.data![0].size).toBe(1024000);
      expect(result.data![0].metadata.width).toBe(1920);
      expect(result.data![0].metadata.height).toBe(1080);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        {
          'path': '/content/dam/mysite',
          'type': 'dam:Asset',
          'p.limit': 25,
          'p.offset': 0,
          'property': 'jcr:content/metadata/dc:format',
          'property.value': 'image/jpeg'
        },
        expect.objectContaining({
          cache: true,
          cacheTtl: 300000,
          context: {
            operation: 'searchAssets',
            resource: '/bin/querybuilder.json'
          }
        })
      );
    });

    it('should search assets with tags and metadata filters', async () => {
      mockClient.get.mockResolvedValue(mockAssetSearchResponse);

      const options: AssetSearchOptions = {
        tags: ['mysite:category/images', 'mysite:type/hero'],
        metadata: {
          'dc:creator': 'John Doe',
          'dam:scene7ID': 'hero-image-001'
        }
      };

      await searchQueryService.searchAssets(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        expect.objectContaining({
          'tagid': ['mysite:category/images', 'mysite:type/hero'],
          '1_property': 'jcr:content/metadata/dc:creator',
          '1_property.value': 'John Doe',
          '2_property': 'jcr:content/metadata/dam:scene7ID',
          '2_property.value': 'hero-image-001'
        }),
        expect.any(Object)
      );
    });

    it('should search assets with date range', async () => {
      mockClient.get.mockResolvedValue(mockAssetSearchResponse);

      const options: AssetSearchOptions = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-01-31')
        }
      };

      await searchQueryService.searchAssets(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        expect.objectContaining({
          'daterange.property': 'jcr:content/jcr:lastModified',
          'daterange.lowerBound': '2024-01-01T00:00:00.000Z',
          'daterange.upperBound': '2024-01-31T00:00:00.000Z'
        }),
        expect.any(Object)
      );
    });
  });

  describe('searchUsers', () => {
    const mockUserSearchResponse = {
      success: true,
      data: {
        total: 2,
        hits: [
          {
            path: '/home/users/j/john-doe',
            name: 'john-doe',
            'profile/givenName': 'John',
            'profile/familyName': 'Doe',
            'profile/email': 'john.doe@example.com',
            'rep:groups': ['authors', 'contributors']
          },
          {
            path: '/home/users/j/jane-smith',
            name: 'jane-smith',
            'profile/givenName': 'Jane',
            'profile/familyName': 'Smith',
            'profile/email': 'jane.smith@example.com',
            'rep:groups': ['administrators']
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

    it('should search users successfully', async () => {
      mockClient.get.mockResolvedValue(mockUserSearchResponse);

      const options: UserSearchOptions = {
        query: 'john',
        group: 'authors',
        active: true,
        limit: 25
      };

      const result = await searchQueryService.searchUsers(options);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].id).toBe('john-doe');
      expect(result.data![0].profile.givenName).toBe('John');
      expect(result.data![0].profile.email).toBe('john.doe@example.com');
      expect(result.data![0].groups).toEqual(['authors', 'contributors']);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        {
          'path': '/home/users',
          'type': 'rep:User',
          'p.limit': 25,
          'p.offset': 0,
          'fulltext': 'john',
          'property': 'rep:disabled',
          'property.value': false
        },
        expect.objectContaining({
          cache: true,
          cacheTtl: 600000,
          context: {
            operation: 'searchUsers',
            resource: '/bin/querybuilder.json'
          }
        })
      );
    });
  });

  describe('searchGroups', () => {
    const mockGroupSearchResponse = {
      success: true,
      data: {
        total: 2,
        hits: [
          {
            path: '/home/groups/a/authors',
            name: 'authors',
            'jcr:title': 'Authors',
            'jcr:description': 'Content authors group',
            'rep:members': ['john-doe', 'jane-smith']
          },
          {
            path: '/home/groups/a/administrators',
            name: 'administrators',
            'jcr:title': 'Administrators',
            'jcr:description': 'System administrators group',
            'rep:members': ['admin']
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 60,
        cached: false
      }
    };

    it('should search groups successfully', async () => {
      mockClient.get.mockResolvedValue(mockGroupSearchResponse);

      const options: GroupSearchOptions = {
        query: 'authors',
        limit: 25
      };

      const result = await searchQueryService.searchGroups(options);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].id).toBe('authors');
      expect(result.data![0].title).toBe('Authors');
      expect(result.data![0].description).toBe('Content authors group');
      expect(result.data![0].members).toEqual(['john-doe', 'jane-smith']);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        {
          'path': '/home/groups',
          'type': 'rep:Group',
          'p.limit': 25,
          'p.offset': 0,
          'fulltext': 'authors'
        },
        expect.objectContaining({
          cache: true,
          cacheTtl: 600000,
          context: {
            operation: 'searchGroups',
            resource: '/bin/querybuilder.json'
          }
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(searchQueryService.searchContent()).rejects.toThrow(AEMException);
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.get.mockRejectedValue(originalError);

      await expect(searchQueryService.searchContent()).rejects.toThrow('Original error');
    });
  });
});
