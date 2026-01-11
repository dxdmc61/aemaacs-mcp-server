/**
 * Unit tests for Content Discovery Service
 */

import { ContentDiscoveryService, ListPagesOptions, ListChildrenOptions, NodeContentOptions } from '../services/content-discovery-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('ContentDiscoveryService', () => {
  let contentDiscoveryService: ContentDiscoveryService;
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

    contentDiscoveryService = new ContentDiscoveryService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listPages', () => {
    const mockPageListResponse = {
      success: true,
      data: {
        pages: [
          {
            path: '/content/mysite/en/page1',
            'jcr:title': 'Page 1',
            'jcr:primaryType': 'cq:Page',
            'cq:template': '/conf/mysite/settings/wcm/templates/content-page',
            'cq:lastModified': '2024-01-01T00:00:00.000Z',
            'cq:lastReplicated': '2024-01-02T00:00:00.000Z',
            'sling:resourceType': 'mysite/components/page'
          },
          {
            path: '/content/mysite/en/page2',
            'jcr:title': 'Page 2',
            'jcr:primaryType': 'cq:Page',
            'cq:template': '/conf/mysite/settings/wcm/templates/content-page',
            'cq:lastModified': '2024-01-03T00:00:00.000Z',
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

    it('should list pages successfully', async () => {
      mockClient.get.mockResolvedValue(mockPageListResponse);

      const rootPath = '/content/mysite/en';
      const result = await contentDiscoveryService.listPages(rootPath);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].path).toBe('/content/mysite/en/page1');
      expect(result.data![0].title).toBe('Page 1');
      expect(result.data![0].published).toBe(true);
      expect(result.data![1].path).toBe('/content/mysite/en/page2');
      expect(result.data![1].published).toBe(false);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/wcm/contentsync/content.json',
        { path: rootPath, depth: 1 },
        expect.objectContaining({
          cache: true,
          cacheTtl: 60000,
          context: {
            operation: 'listPages',
            resource: rootPath
          }
        })
      );
    });

    it('should list pages with depth control', async () => {
      mockClient.get.mockResolvedValue(mockPageListResponse);

      const options: ListPagesOptions = {
        depth: 2
      };

      await contentDiscoveryService.listPages('/content/mysite/en', options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/wcm/contentsync/content.json',
        { path: '/content/mysite/en', depth: 2 },
        expect.any(Object)
      );
    });

    it('should list pages with filtering', async () => {
      mockClient.get.mockResolvedValue(mockPageListResponse);

      const options: ListPagesOptions = {
        filter: 'template=/conf/mysite/settings/wcm/templates/content-page'
      };

      await contentDiscoveryService.listPages('/content/mysite/en', options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/wcm/contentsync/content.json',
        { 
          path: '/content/mysite/en', 
          depth: 1,
          filter: 'template=/conf/mysite/settings/wcm/templates/content-page'
        },
        expect.any(Object)
      );
    });

    it('should sort pages by title', async () => {
      const unsortedResponse = {
        ...mockPageListResponse,
        data: {
          pages: [
            { ...mockPageListResponse.data.pages[1], 'jcr:title': 'Z Page' },
            { ...mockPageListResponse.data.pages[0], 'jcr:title': 'A Page' }
          ]
        }
      };
      mockClient.get.mockResolvedValue(unsortedResponse);

      const result = await contentDiscoveryService.listPages('/content/mysite/en', { 
        orderBy: 'title', 
        orderDirection: 'asc' 
      });

      expect(result.data![0].title).toBe('A Page');
      expect(result.data![1].title).toBe('Z Page');
    });

    it('should apply pagination', async () => {
      const manyPagesResponse = {
        ...mockPageListResponse,
        data: {
          pages: Array.from({ length: 10 }, (_, i) => ({
            ...mockPageListResponse.data.pages[0],
            path: `/content/mysite/en/page${i}`,
            'jcr:title': `Page ${i}`
          }))
        }
      };
      mockClient.get.mockResolvedValue(manyPagesResponse);

      const result = await contentDiscoveryService.listPages('/content/mysite/en', { 
        limit: 3, 
        offset: 2 
      });

      expect(result.data).toHaveLength(3);
      expect(result.data![0].path).toBe('/content/mysite/en/page2');
      expect(result.data![2].path).toBe('/content/mysite/en/page4');
    });

    it('should throw validation error for empty root path', async () => {
      await expect(contentDiscoveryService.listPages('')).rejects.toThrow(AEMException);
      await expect(contentDiscoveryService.listPages('')).rejects.toThrow('Root path is required');
    });

    it('should handle empty page list', async () => {
      const emptyResponse = {
        ...mockPageListResponse,
        data: { pages: [] }
      };
      mockClient.get.mockResolvedValue(emptyResponse);

      const result = await contentDiscoveryService.listPages('/content/mysite/en');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('listChildren', () => {
    const mockNodeListResponse = {
      success: true,
      data: {
        hits: [
          {
            path: '/content/mysite/en/jcr:content/root/container/text',
            'jcr:primaryType': 'nt:unstructured',
            'sling:resourceType': 'mysite/components/text',
            text: '<p>Hello World</p>'
          },
          {
            path: '/content/mysite/en/jcr:content/root/container/image',
            'jcr:primaryType': 'nt:unstructured',
            'sling:resourceType': 'mysite/components/image',
            fileReference: '/content/dam/mysite/image.jpg'
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

    it('should list children nodes successfully', async () => {
      mockClient.get.mockResolvedValue(mockNodeListResponse);

      const nodePath = '/content/mysite/en/jcr:content/root/container';
      const result = await contentDiscoveryService.listChildren(nodePath);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].path).toBe('/content/mysite/en/jcr:content/root/container/text');
      expect(result.data![0].primaryType).toBe('nt:unstructured');
      expect(result.data![1].path).toBe('/content/mysite/en/jcr:content/root/container/image');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/wcm/contentfinder/content.json',
        { path: nodePath, depth: 1 },
        expect.objectContaining({
          cache: true,
          cacheTtl: 60000,
          context: {
            operation: 'listChildren',
            resource: nodePath
          }
        })
      );
    });

    it('should list children with primary type filter', async () => {
      mockClient.get.mockResolvedValue(mockNodeListResponse);

      const options: ListChildrenOptions = {
        primaryType: 'nt:unstructured'
      };

      await contentDiscoveryService.listChildren('/content/mysite/en/jcr:content', options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/wcm/contentfinder/content.json',
        { 
          path: '/content/mysite/en/jcr:content', 
          depth: 1,
          primaryType: 'nt:unstructured'
        },
        expect.any(Object)
      );
    });

    it('should list children with multiple primary types', async () => {
      mockClient.get.mockResolvedValue(mockNodeListResponse);

      const options: ListChildrenOptions = {
        primaryType: ['nt:unstructured', 'cq:Page']
      };

      await contentDiscoveryService.listChildren('/content/mysite/en/jcr:content', options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/wcm/contentfinder/content.json',
        { 
          path: '/content/mysite/en/jcr:content', 
          depth: 1,
          primaryType: 'nt:unstructured,cq:Page'
        },
        expect.any(Object)
      );
    });

    it('should list children with specific properties', async () => {
      mockClient.get.mockResolvedValue(mockNodeListResponse);

      const options: ListChildrenOptions = {
        properties: ['jcr:title', 'sling:resourceType']
      };

      await contentDiscoveryService.listChildren('/content/mysite/en/jcr:content', options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/wcm/contentfinder/content.json',
        { 
          path: '/content/mysite/en/jcr:content', 
          depth: 1,
          properties: 'jcr:title,sling:resourceType'
        },
        expect.any(Object)
      );
    });

    it('should throw validation error for empty node path', async () => {
      await expect(contentDiscoveryService.listChildren('')).rejects.toThrow(AEMException);
      await expect(contentDiscoveryService.listChildren('')).rejects.toThrow('Node path is required');
    });
  });

  describe('getPageContent', () => {
    const mockPageContentResponse = {
      success: true,
      data: {
        path: '/content/mysite/en/page1',
        'jcr:primaryType': 'cq:Page',
        'jcr:content': {
          'jcr:title': 'Page 1',
          'cq:template': '/conf/mysite/settings/wcm/templates/content-page',
          'sling:resourceType': 'mysite/components/page',
          'cq:lastModified': '2024-01-01T00:00:00.000Z',
          'root': {
            'sling:resourceType': 'mysite/components/container',
            'text': {
              'sling:resourceType': 'mysite/components/text',
              'text': '<p>Hello World</p>'
            },
            'image': {
              'sling:resourceType': 'mysite/components/image',
              'fileReference': '/content/dam/mysite/image.jpg'
            }
          }
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 150,
        cached: false
      }
    };

    it('should get page content successfully', async () => {
      mockClient.get.mockResolvedValue(mockPageContentResponse);

      const pagePath = '/content/mysite/en/page1';
      const result = await contentDiscoveryService.getPageContent(pagePath);

      expect(result.success).toBe(true);
      expect(result.data!.path).toBe(pagePath);
      expect(result.data!.title).toBe('Page 1');
      expect(result.data!.components).toHaveLength(1); // Root component
      expect(result.data!.components[0].path).toBe(`${pagePath}/jcr:content`);
      expect(result.data!.components[0].children).toBeDefined();
      expect(result.data!.components[0].children!.length).toBeGreaterThan(0);

      expect(mockClient.get).toHaveBeenCalledWith(
        `${pagePath}.infinity.json`,
        undefined,
        expect.objectContaining({
          cache: true,
          cacheTtl: 60000,
          context: {
            operation: 'getPageContent',
            resource: pagePath
          }
        })
      );
    });

    it('should throw validation error for empty page path', async () => {
      await expect(contentDiscoveryService.getPageContent('')).rejects.toThrow(AEMException);
      await expect(contentDiscoveryService.getPageContent('')).rejects.toThrow('Page path is required');
    });

    it('should throw not found error for non-existent page', async () => {
      const notFoundResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(notFoundResponse);

      const pagePath = '/content/mysite/en/non-existent';
      await expect(contentDiscoveryService.getPageContent(pagePath)).rejects.toThrow(AEMException);
    });
  });

  describe('getPageProperties', () => {
    const mockPagePropertiesResponse = {
      success: true,
      data: {
        'jcr:title': 'Page 1',
        'jcr:description': 'This is page 1',
        'cq:template': '/conf/mysite/settings/wcm/templates/content-page',
        'sling:resourceType': 'mysite/components/page',
        'jcr:created': '2023-12-01T00:00:00.000Z',
        'cq:lastModified': '2024-01-01T00:00:00.000Z',
        'cq:lastReplicated': '2024-01-02T00:00:00.000Z',
        'pageTitle': 'Page 1 | My Site',
        'navTitle': 'Page 1'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 75,
        cached: false
      }
    };

    it('should get page properties successfully', async () => {
      mockClient.get.mockResolvedValue(mockPagePropertiesResponse);

      const pagePath = '/content/mysite/en/page1';
      const result = await contentDiscoveryService.getPageProperties(pagePath);

      expect(result.success).toBe(true);
      expect(result.data!.path).toBe(pagePath);
      expect(result.data!.name).toBe('page1');
      expect(result.data!.title).toBe('Page 1');
      expect(result.data!.template).toBe('/conf/mysite/settings/wcm/templates/content-page');
      expect(result.data!.created).toEqual(new Date('2023-12-01T00:00:00.000Z'));
      expect(result.data!.lastModified).toEqual(new Date('2024-01-01T00:00:00.000Z'));
      expect(result.data!.lastPublished).toEqual(new Date('2024-01-02T00:00:00.000Z'));
      expect(result.data!.properties['pageTitle']).toBe('Page 1 | My Site');

      expect(mockClient.get).toHaveBeenCalledWith(
        `${pagePath}/jcr:content.json`,
        undefined,
        expect.objectContaining({
          cache: true,
          cacheTtl: 300000,
          context: {
            operation: 'getPageProperties',
            resource: pagePath
          }
        })
      );
    });

    it('should throw validation error for empty page path', async () => {
      await expect(contentDiscoveryService.getPageProperties('')).rejects.toThrow(AEMException);
      await expect(contentDiscoveryService.getPageProperties('')).rejects.toThrow('Page path is required');
    });

    it('should throw not found error for non-existent page', async () => {
      const notFoundResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(notFoundResponse);

      const pagePath = '/content/mysite/en/non-existent';
      await expect(contentDiscoveryService.getPageProperties(pagePath)).rejects.toThrow(AEMException);
    });
  });

  describe('getNodeContent', () => {
    const mockNodeContentResponse = {
      success: true,
      data: {
        path: '/content/mysite/en/jcr:content/root/container',
        'jcr:primaryType': 'nt:unstructured',
        'sling:resourceType': 'mysite/components/container',
        'text': {
          'jcr:primaryType': 'nt:unstructured',
          'sling:resourceType': 'mysite/components/text',
          'text': '<p>Hello World</p>'
        },
        'image': {
          'jcr:primaryType': 'nt:unstructured',
          'sling:resourceType': 'mysite/components/image',
          'fileReference': '/content/dam/mysite/image.jpg'
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100,
        cached: false
      }
    };

    it('should get node content successfully', async () => {
      mockClient.get.mockResolvedValue(mockNodeContentResponse);

      const nodePath = '/content/mysite/en/jcr:content/root/container';
      const result = await contentDiscoveryService.getNodeContent(nodePath);

      expect(result.success).toBe(true);
      expect(result.data!.path).toBe(nodePath);
      expect(result.data!.primaryType).toBe('nt:unstructured');
      expect(result.data!.children).toBeDefined();
      expect(result.data!.children!.length).toBe(2);
      expect(result.data!.children![0].name).toBe('text');
      expect(result.data!.children![1].name).toBe('image');

      expect(mockClient.get).toHaveBeenCalledWith(
        `${nodePath}.1.json`,
        undefined,
        expect.objectContaining({
          cache: true,
          cacheTtl: 60000,
          context: {
            operation: 'getNodeContent',
            resource: nodePath
          }
        })
      );
    });

    it('should get node content with custom depth', async () => {
      mockClient.get.mockResolvedValue(mockNodeContentResponse);

      const options: NodeContentOptions = {
        depth: 3
      };

      await contentDiscoveryService.getNodeContent('/content/mysite/en/jcr:content', options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/content/mysite/en/jcr:content.3.json',
        undefined,
        expect.any(Object)
      );
    });

    it('should get node content with no depth', async () => {
      mockClient.get.mockResolvedValue(mockNodeContentResponse);

      const options: NodeContentOptions = {
        depth: 0
      };

      await contentDiscoveryService.getNodeContent('/content/mysite/en/jcr:content', options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/content/mysite/en/jcr:content.json',
        undefined,
        expect.any(Object)
      );
    });

    it('should throw validation error for empty node path', async () => {
      await expect(contentDiscoveryService.getNodeContent('')).rejects.toThrow(AEMException);
      await expect(contentDiscoveryService.getNodeContent('')).rejects.toThrow('Node path is required');
    });

    it('should throw not found error for non-existent node', async () => {
      const notFoundResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(notFoundResponse);

      const nodePath = '/content/mysite/en/jcr:content/non-existent';
      await expect(contentDiscoveryService.getNodeContent(nodePath)).rejects.toThrow(AEMException);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(contentDiscoveryService.listPages('/content/mysite/en')).rejects.toThrow(AEMException);
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.get.mockRejectedValue(originalError);

      await expect(contentDiscoveryService.listPages('/content/mysite/en')).rejects.toThrow('Original error');
    });
  });
});
