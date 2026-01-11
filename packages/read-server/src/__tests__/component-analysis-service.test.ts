/**
 * Unit tests for Component Analysis Service
 */

import { ComponentAnalysisService } from '../services/component-analysis-service.js';
import { ContentDiscoveryService, PageContent } from '../services/content-discovery-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client and Content Discovery Service
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');
jest.mock('../services/content-discovery-service.js');

describe('ComponentAnalysisService', () => {
  let componentAnalysisService: ComponentAnalysisService;
  let mockClient: jest.Mocked<AEMHttpClient>;
  let mockContentDiscoveryService: jest.Mocked<ContentDiscoveryService>;

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

    mockContentDiscoveryService = {
      listPages: jest.fn(),
      listChildren: jest.fn(),
      getPageContent: jest.fn(),
      getPageProperties: jest.fn(),
      getNodeContent: jest.fn()
    } as unknown as jest.Mocked<ContentDiscoveryService>;

    componentAnalysisService = new ComponentAnalysisService(mockClient, mockContentDiscoveryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scanPageComponents', () => {
    const mockPageContent: AEMResponse<PageContent> = {
      success: true,
      data: {
        path: '/content/mysite/en/page1',
        name: 'page1',
        primaryType: 'cq:Page',
        title: 'Page 1',
        template: '/conf/mysite/settings/wcm/templates/content-page',
        resourceType: 'mysite/components/page',
        published: true,
        properties: {},
        components: [
          {
            path: '/content/mysite/en/page1/jcr:content',
            resourceType: 'mysite/components/page',
            properties: {
              'jcr:title': 'Page 1',
              'sling:resourceType': 'mysite/components/page'
            },
            children: [
              {
                path: '/content/mysite/en/page1/jcr:content/root/container/text',
                resourceType: 'mysite/components/text',
                properties: {
                  'sling:resourceType': 'mysite/components/text',
                  'text': '<p>Hello World</p>'
                }
              },
              {
                path: '/content/mysite/en/page1/jcr:content/root/container/image',
                resourceType: 'mysite/components/image',
                properties: {
                  'sling:resourceType': 'mysite/components/image',
                  'fileReference': '/content/dam/mysite/image.jpg'
                }
              }
            ]
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

    it('should scan page components successfully', async () => {
      mockContentDiscoveryService.getPageContent.mockResolvedValue(mockPageContent);

      const pagePath = '/content/mysite/en/page1';
      const result = await componentAnalysisService.scanPageComponents(pagePath);

      expect(result.success).toBe(true);
      expect(result.data!.pagePath).toBe(pagePath);
      expect(result.data!.pageTitle).toBe('Page 1');
      expect(result.data!.template).toBe('/conf/mysite/settings/wcm/templates/content-page');
      expect(result.data!.componentCount).toBe(3); // Root + 2 child components
      expect(result.data!.components).toHaveLength(3);
      expect(result.data!.components[0].path).toBe('/content/mysite/en/page1/jcr:content');
      expect(result.data!.components[1].path).toBe('/content/mysite/en/page1/jcr:content/root/container/text');
      expect(result.data!.components[2].path).toBe('/content/mysite/en/page1/jcr:content/root/container/image');

      expect(mockContentDiscoveryService.getPageContent).toHaveBeenCalledWith(pagePath);
    });

    it('should throw validation error for empty page path', async () => {
      await expect(componentAnalysisService.scanPageComponents('')).rejects.toThrow(AEMException);
      await expect(componentAnalysisService.scanPageComponents('')).rejects.toThrow('Page path is required');
    });

    it('should throw error when page content retrieval fails', async () => {
      const errorResponse: AEMResponse<PageContent> = {
        success: false,
        error: {
          code: 'NOT_FOUND_ERROR',
          message: 'Page not found',
          recoverable: false
        }
      };
      mockContentDiscoveryService.getPageContent.mockResolvedValue(errorResponse);

      const pagePath = '/content/mysite/en/non-existent';
      await expect(componentAnalysisService.scanPageComponents(pagePath)).rejects.toThrow(AEMException);
    });
  });

  describe('getPageTextContent', () => {
    const mockPageContent: AEMResponse<PageContent> = {
      success: true,
      data: {
        path: '/content/mysite/en/page1',
        name: 'page1',
        primaryType: 'cq:Page',
        title: 'Page 1',
        template: '/conf/mysite/settings/wcm/templates/content-page',
        resourceType: 'mysite/components/page',
        published: true,
        properties: {},
        components: [
          {
            path: '/content/mysite/en/page1/jcr:content',
            resourceType: 'mysite/components/page',
            properties: {
              'jcr:title': 'Page 1',
              'sling:resourceType': 'mysite/components/page'
            },
            children: [
              {
                path: '/content/mysite/en/page1/jcr:content/root/container/title',
                resourceType: 'mysite/components/title',
                properties: {
                  'sling:resourceType': 'mysite/components/title',
                  'jcr:title': 'Welcome to My Site'
                }
              },
              {
                path: '/content/mysite/en/page1/jcr:content/root/container/text',
                resourceType: 'mysite/components/text',
                properties: {
                  'sling:resourceType': 'mysite/components/text',
                  'text': '<p>Hello World</p><p>This is a test page.</p>'
                }
              }
            ]
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

    it('should get page text content successfully', async () => {
      mockContentDiscoveryService.getPageContent.mockResolvedValue(mockPageContent);

      const pagePath = '/content/mysite/en/page1';
      const result = await componentAnalysisService.getPageTextContent(pagePath);

      expect(result.success).toBe(true);
      expect(result.data!.pagePath).toBe(pagePath);
      expect(result.data!.pageTitle).toBe('Page 1');
      expect(result.data!.textItems).toHaveLength(2);
      expect(result.data!.textItems[0].path).toBe('/content/mysite/en/page1/jcr:content/root/container/title');
      expect(result.data!.textItems[0].text).toBe('Welcome to My Site');
      expect(result.data!.textItems[1].path).toBe('/content/mysite/en/page1/jcr:content/root/container/text');
      expect(result.data!.textItems[1].text).toBe('Hello World This is a test page.');
      expect(result.data!.totalTextLength).toBeGreaterThan(0);

      expect(mockContentDiscoveryService.getPageContent).toHaveBeenCalledWith(pagePath);
    });

    it('should throw validation error for empty page path', async () => {
      await expect(componentAnalysisService.getPageTextContent('')).rejects.toThrow(AEMException);
      await expect(componentAnalysisService.getPageTextContent('')).rejects.toThrow('Page path is required');
    });
  });

  describe('getAllTextContent', () => {
    const mockPageContent1: AEMResponse<PageContent> = {
      success: true,
      data: {
        path: '/content/mysite/en/page1',
        name: 'page1',
        primaryType: 'cq:Page',
        title: 'Page 1',
        template: '/conf/mysite/settings/wcm/templates/content-page',
        resourceType: 'mysite/components/page',
        published: true,
        properties: {},
        components: [
          {
            path: '/content/mysite/en/page1/jcr:content',
            resourceType: 'mysite/components/page',
            properties: {
              'jcr:title': 'Page 1',
              'sling:resourceType': 'mysite/components/page'
            },
            children: [
              {
                path: '/content/mysite/en/page1/jcr:content/root/container/text',
                resourceType: 'mysite/components/text',
                properties: {
                  'sling:resourceType': 'mysite/components/text',
                  'text': '<p>Page 1 content</p>'
                }
              }
            ]
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id-1',
        duration: 100,
        cached: false
      }
    };

    const mockPageContent2: AEMResponse<PageContent> = {
      success: true,
      data: {
        path: '/content/mysite/en/page2',
        name: 'page2',
        primaryType: 'cq:Page',
        title: 'Page 2',
        template: '/conf/mysite/settings/wcm/templates/content-page',
        resourceType: 'mysite/components/page',
        published: true,
        properties: {},
        components: [
          {
            path: '/content/mysite/en/page2/jcr:content',
            resourceType: 'mysite/components/page',
            properties: {
              'jcr:title': 'Page 2',
              'sling:resourceType': 'mysite/components/page'
            },
            children: [
              {
                path: '/content/mysite/en/page2/jcr:content/root/container/text',
                resourceType: 'mysite/components/text',
                properties: {
                  'sling:resourceType': 'mysite/components/text',
                  'text': '<p>Page 2 content</p>'
                }
              }
            ]
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id-2',
        duration: 100,
        cached: false
      }
    };

    it('should get text content from multiple pages', async () => {
      // Mock the getPageTextContent method to return different responses for different paths
      jest.spyOn(componentAnalysisService, 'getPageTextContent').mockImplementation((path) => {
        if (path === '/content/mysite/en/page1') {
          return Promise.resolve({
            success: true,
            data: {
              pagePath: '/content/mysite/en/page1',
              pageTitle: 'Page 1',
              totalTextLength: 14,
              textItems: [
                {
                  path: '/content/mysite/en/page1/jcr:content/root/container/text',
                  text: 'Page 1 content',
                  resourceType: 'mysite/components/text'
                }
              ]
            },
            metadata: mockPageContent1.metadata
          });
        } else {
          return Promise.resolve({
            success: true,
            data: {
              pagePath: '/content/mysite/en/page2',
              pageTitle: 'Page 2',
              totalTextLength: 14,
              textItems: [
                {
                  path: '/content/mysite/en/page2/jcr:content/root/container/text',
                  text: 'Page 2 content',
                  resourceType: 'mysite/components/text'
                }
              ]
            },
            metadata: mockPageContent2.metadata
          });
        }
      });

      const pagePaths = ['/content/mysite/en/page1', '/content/mysite/en/page2'];
      const result = await componentAnalysisService.getAllTextContent(pagePaths);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].pagePath).toBe('/content/mysite/en/page1');
      expect(result.data![1].pagePath).toBe('/content/mysite/en/page2');
      expect(result.data![0].textItems).toHaveLength(1);
      expect(result.data![1].textItems).toHaveLength(1);

      expect(componentAnalysisService.getPageTextContent).toHaveBeenCalledTimes(2);
    });

    it('should throw validation error for empty page paths', async () => {
      await expect(componentAnalysisService.getAllTextContent([])).rejects.toThrow(AEMException);
      await expect(componentAnalysisService.getAllTextContent([])).rejects.toThrow('At least one page path is required');
    });

    it('should continue processing even if one page fails', async () => {
      // Mock the getPageTextContent method to succeed for one page and fail for another
      jest.spyOn(componentAnalysisService, 'getPageTextContent').mockImplementation((path) => {
        if (path === '/content/mysite/en/page1') {
          return Promise.resolve({
            success: true,
            data: {
              pagePath: '/content/mysite/en/page1',
              pageTitle: 'Page 1',
              totalTextLength: 14,
              textItems: [
                {
                  path: '/content/mysite/en/page1/jcr:content/root/container/text',
                  text: 'Page 1 content',
                  resourceType: 'mysite/components/text'
                }
              ]
            },
            metadata: mockPageContent1.metadata
          });
        } else {
          return Promise.reject(new AEMException('Page not found', 'NOT_FOUND_ERROR', false));
        }
      });

      const pagePaths = ['/content/mysite/en/page1', '/content/mysite/en/non-existent'];
      const result = await componentAnalysisService.getAllTextContent(pagePaths);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].pagePath).toBe('/content/mysite/en/page1');

      expect(componentAnalysisService.getPageTextContent).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPageImages', () => {
    const mockPageContent: AEMResponse<PageContent> = {
      success: true,
      data: {
        path: '/content/mysite/en/page1',
        name: 'page1',
        primaryType: 'cq:Page',
        title: 'Page 1',
        template: '/conf/mysite/settings/wcm/templates/content-page',
        resourceType: 'mysite/components/page',
        published: true,
        properties: {},
        components: [
          {
            path: '/content/mysite/en/page1/jcr:content',
            resourceType: 'mysite/components/page',
            properties: {
              'jcr:title': 'Page 1',
              'sling:resourceType': 'mysite/components/page'
            },
            children: [
              {
                path: '/content/mysite/en/page1/jcr:content/root/container/image1',
                resourceType: 'mysite/components/image',
                properties: {
                  'sling:resourceType': 'mysite/components/image',
                  'fileReference': '/content/dam/mysite/image1.jpg',
                  'alt': 'Image 1',
                  'width': '800',
                  'height': '600'
                }
              },
              {
                path: '/content/mysite/en/page1/jcr:content/root/container/teaser',
                resourceType: 'mysite/components/teaser',
                properties: {
                  'sling:resourceType': 'mysite/components/teaser',
                  'fileReference': '/content/dam/mysite/teaser.jpg',
                  'title': 'Teaser Title'
                }
              },
              {
                path: '/content/mysite/en/page1/jcr:content/root/container/text',
                resourceType: 'mysite/components/text',
                properties: {
                  'sling:resourceType': 'mysite/components/text',
                  'text': '<p>This is not an image</p>'
                }
              }
            ]
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

    it('should get page images successfully', async () => {
      mockContentDiscoveryService.getPageContent.mockResolvedValue(mockPageContent);

      const pagePath = '/content/mysite/en/page1';
      const result = await componentAnalysisService.getPageImages(pagePath);

      expect(result.success).toBe(true);
      expect(result.data!.pagePath).toBe(pagePath);
      expect(result.data!.pageTitle).toBe('Page 1');
      expect(result.data!.imageCount).toBe(2);
      expect(result.data!.images).toHaveLength(2);
      expect(result.data!.images[0].path).toBe('/content/mysite/en/page1/jcr:content/root/container/image1');
      expect(result.data!.images[0].fileReference).toBe('/content/dam/mysite/image1.jpg');
      expect(result.data!.images[0].alt).toBe('Image 1');
      expect(result.data!.images[0].width).toBe(800);
      expect(result.data!.images[0].height).toBe(600);
      expect(result.data!.images[1].path).toBe('/content/mysite/en/page1/jcr:content/root/container/teaser');
      expect(result.data!.images[1].fileReference).toBe('/content/dam/mysite/teaser.jpg');

      expect(mockContentDiscoveryService.getPageContent).toHaveBeenCalledWith(pagePath);
    });

    it('should throw validation error for empty page path', async () => {
      await expect(componentAnalysisService.getPageImages('')).rejects.toThrow(AEMException);
      await expect(componentAnalysisService.getPageImages('')).rejects.toThrow('Page path is required');
    });

    it('should handle page with no images', async () => {
      const noImagesPageContent = {
        ...mockPageContent,
        data: {
          ...mockPageContent.data!,
          components: [
            {
              path: '/content/mysite/en/page1/jcr:content',
              resourceType: 'mysite/components/page',
              properties: {
                'jcr:title': 'Page 1',
                'sling:resourceType': 'mysite/components/page'
              },
              children: [
                {
                  path: '/content/mysite/en/page1/jcr:content/root/container/text',
                  resourceType: 'mysite/components/text',
                  properties: {
                    'sling:resourceType': 'mysite/components/text',
                    'text': '<p>This is not an image</p>'
                  }
                }
              ]
            }
          ]
        }
      };
      mockContentDiscoveryService.getPageContent.mockResolvedValue(noImagesPageContent);

      const pagePath = '/content/mysite/en/page1';
      const result = await componentAnalysisService.getPageImages(pagePath);

      expect(result.success).toBe(true);
      expect(result.data!.imageCount).toBe(0);
      expect(result.data!.images).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockContentDiscoveryService.getPageContent.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(componentAnalysisService.scanPageComponents('/content/mysite/en/page1')).rejects.toThrow(AEMException);
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockContentDiscoveryService.getPageContent.mockRejectedValue(originalError);

      await expect(componentAnalysisService.scanPageComponents('/content/mysite/en/page1')).rejects.toThrow('Original error');
    });
  });
});
