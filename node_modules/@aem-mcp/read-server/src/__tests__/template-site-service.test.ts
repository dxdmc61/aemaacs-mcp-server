/**
 * Unit tests for Template and Site Service
 */

import { TemplateSiteService, Site, LanguageMaster, Locale, Template, TemplateStructure } from '../services/template-site-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('TemplateSiteService', () => {
  let templateSiteService: TemplateSiteService;
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

    templateSiteService = new TemplateSiteService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchSites', () => {
    const mockSiteSearchResponse = {
      success: true,
      data: {
        hits: [
          {
            path: '/content/mysite/en/home'
          },
          {
            path: '/content/mysite/de/home'
          },
          {
            path: '/content/anothersite/en/home'
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

    const mockSiteDetailsResponses = [
      {
        success: true,
        data: {
          'jcr:primaryType': 'cq:Page',
          'jcr:created': '2024-01-01T00:00:00.000Z',
          'jcr:content': {
            'jcr:title': 'My Site',
            'jcr:description': 'My corporate website',
            'jcr:lastModified': '2024-01-02T00:00:00.000Z',
            'languageMaster': 'en',
            'locales': ['en', 'de', 'fr'],
            'allowedTemplates': ['/conf/mysite/settings/wcm/templates/content-page']
          }
        }
      },
      {
        success: true,
        data: {
          'jcr:primaryType': 'cq:Page',
          'jcr:created': '2024-01-03T00:00:00.000Z',
          'jcr:content': {
            'jcr:title': 'Another Site',
            'jcr:description': 'Another website',
            'jcr:lastModified': '2024-01-04T00:00:00.000Z',
            'locales': ['en']
          }
        }
      }
    ];

    it('should fetch sites successfully', async () => {
      mockClient.get
        .mockResolvedValueOnce(mockSiteSearchResponse) // Site search
        .mockResolvedValueOnce(mockSiteDetailsResponses[0]) // /content/mysite details
        .mockResolvedValueOnce(mockSiteDetailsResponses[1]); // /content/anothersite details

      const result = await templateSiteService.fetchSites();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      
      const mySite = result.data![0];
      expect(mySite.name).toBe('mysite');
      expect(mySite.title).toBe('My Site');
      expect(mySite.description).toBe('My corporate website');
      expect(mySite.rootPath).toBe('/content/mysite');
      expect(mySite.languageMaster).toBe('en');
      expect(mySite.locales).toEqual(['en', 'de', 'fr']);
      expect(mySite.templates).toEqual(['/conf/mysite/settings/wcm/templates/content-page']);

      const anotherSite = result.data![1];
      expect(anotherSite.name).toBe('anothersite');
      expect(anotherSite.title).toBe('Another Site');

      expect(mockClient.get).toHaveBeenCalledTimes(3);
      expect(mockClient.get).toHaveBeenNthCalledWith(1,
        '/bin/querybuilder.json',
        expect.objectContaining({
          'path': '/content',
          'type': 'cq:Page'
        }),
        expect.any(Object)
      );
    });

    it('should handle sites that cannot be accessed', async () => {
      const errorResponse = {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' }
      };

      mockClient.get
        .mockResolvedValueOnce(mockSiteSearchResponse) // Site search
        .mockResolvedValueOnce(mockSiteDetailsResponses[0]) // /content/mysite details
        .mockResolvedValueOnce(errorResponse); // /content/anothersite access denied

      const result = await templateSiteService.fetchSites();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1); // Only accessible site
      expect(result.data![0].name).toBe('mysite');
    });

    it('should handle empty site search results', async () => {
      const emptyResponse = {
        ...mockSiteSearchResponse,
        data: { hits: [] }
      };
      mockClient.get.mockResolvedValue(emptyResponse);

      const result = await templateSiteService.fetchSites();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('fetchLanguageMasters', () => {
    const mockLanguageMasterResponse = {
      success: true,
      data: {
        'jcr:primaryType': 'cq:Page',
        'en': {
          'jcr:primaryType': 'cq:Page',
          'jcr:content': {
            'jcr:title': 'English Master',
            'jcr:lastModified': '2024-01-01T00:00:00.000Z'
          }
        },
        'de': {
          'jcr:primaryType': 'cq:Page',
          'jcr:content': {
            'jcr:title': 'German Master',
            'jcr:lastModified': '2024-01-02T00:00:00.000Z'
          }
        },
        'fr': {
          'jcr:primaryType': 'cq:Page',
          'jcr:content': {
            'jcr:title': 'French Master',
            'jcr:lastModified': '2024-01-03T00:00:00.000Z'
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

    it('should fetch language masters successfully', async () => {
      mockClient.get.mockResolvedValue(mockLanguageMasterResponse);

      const sitePath = '/content/mysite';
      const result = await templateSiteService.fetchLanguageMasters(sitePath);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      
      const englishMaster = result.data!.find(m => m.locale === 'en');
      expect(englishMaster).toBeDefined();
      expect(englishMaster!.path).toBe('/content/mysite/en');
      expect(englishMaster!.title).toBe('English Master');
      expect(englishMaster!.isDefault).toBe(true); // English is typically default

      const germanMaster = result.data!.find(m => m.locale === 'de');
      expect(germanMaster).toBeDefined();
      expect(germanMaster!.isDefault).toBe(false);

      expect(mockClient.get).toHaveBeenCalledWith(
        `${sitePath}.2.json`,
        undefined,
        expect.objectContaining({
          cache: true,
          cacheTtl: 300000,
          context: {
            operation: 'fetchLanguageMasters',
            resource: sitePath
          }
        })
      );
    });

    it('should throw validation error for empty site path', async () => {
      await expect(templateSiteService.fetchLanguageMasters('')).rejects.toThrow(AEMException);
      await expect(templateSiteService.fetchLanguageMasters('')).rejects.toThrow('Site path is required');
    });

    it('should throw not found error for non-existent site', async () => {
      const notFoundResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(notFoundResponse);

      await expect(templateSiteService.fetchLanguageMasters('/content/non-existent')).rejects.toThrow(AEMException);
    });
  });

  describe('fetchAvailableLocales', () => {
    const mockLocalesResponse = {
      success: true,
      data: [
        {
          code: 'en',
          language: 'English',
          displayName: 'English',
          available: true
        },
        {
          code: 'en_US',
          language: 'English',
          country: 'US',
          displayName: 'English (United States)',
          available: true
        },
        {
          code: 'de',
          language: 'German',
          displayName: 'Deutsch',
          available: true
        },
        {
          code: 'fr',
          language: 'French',
          displayName: 'Français',
          available: false
        }
      ],
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 50,
        cached: false
      }
    };

    it('should fetch available locales successfully', async () => {
      mockClient.get.mockResolvedValue(mockLocalesResponse);

      const result = await templateSiteService.fetchAvailableLocales();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(4);
      
      const englishLocale = result.data![0];
      expect(englishLocale.code).toBe('en');
      expect(englishLocale.language).toBe('English');
      expect(englishLocale.available).toBe(true);

      const usLocale = result.data![1];
      expect(usLocale.code).toBe('en_US');
      expect(usLocale.country).toBe('US');

      const frenchLocale = result.data![3];
      expect(frenchLocale.available).toBe(false);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/libs/wcm/core/resources/languages.json',
        undefined,
        expect.objectContaining({
          cache: true,
          cacheTtl: 3600000,
          context: {
            operation: 'fetchAvailableLocales',
            resource: '/libs/wcm/core/resources/languages'
          }
        })
      );
    });

    it('should return fallback locales when endpoint fails', async () => {
      const errorResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(errorResponse);

      const result = await templateSiteService.fetchAvailableLocales();

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      
      // Should include common fallback locales
      const englishLocale = result.data!.find(l => l.code === 'en');
      expect(englishLocale).toBeDefined();
      expect(englishLocale!.language).toBe('English');
    });

    it('should handle object format locale response', async () => {
      const objectFormatResponse = {
        success: true,
        data: {
          'en': {
            language: 'English',
            displayName: 'English',
            available: true
          },
          'de_DE': {
            language: 'German',
            country: 'DE',
            displayName: 'Deutsch (Deutschland)',
            available: true
          }
        }
      };
      mockClient.get.mockResolvedValue(objectFormatResponse);

      const result = await templateSiteService.fetchAvailableLocales();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].code).toBe('en');
      expect(result.data![1].code).toBe('de_DE');
      expect(result.data![1].country).toBe('DE');
    });
  });

  describe('getTemplates', () => {
    const mockTemplateSearchResponse = {
      success: true,
      data: {
        hits: [
          {
            path: '/conf/mysite/settings/wcm/templates/content-page'
          },
          {
            path: '/conf/mysite/settings/wcm/templates/landing-page'
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

    const mockTemplateDetailsResponses = [
      {
        success: true,
        data: {
          'jcr:primaryType': 'cq:Template',
          'jcr:title': 'Content Page',
          'jcr:description': 'Standard content page template',
          'jcr:created': '2024-01-01T00:00:00.000Z',
          'jcr:lastModified': '2024-01-02T00:00:00.000Z',
          'sling:resourceType': 'mysite/components/page',
          'allowedPaths': ['/content/mysite/.*'],
          'allowedParents': ['/conf/mysite/settings/wcm/templates/.*'],
          'ranking': '100',
          'status': 'enabled',
          'thumbnail': '/conf/mysite/settings/wcm/templates/content-page/thumbnail.png'
        }
      },
      {
        success: true,
        data: {
          'jcr:primaryType': 'cq:Template',
          'jcr:title': 'Landing Page',
          'jcr:description': 'Marketing landing page template',
          'jcr:created': '2024-01-03T00:00:00.000Z',
          'sling:resourceType': 'mysite/components/landing-page',
          'status': 'disabled'
        }
      }
    ];

    it('should get templates successfully', async () => {
      mockClient.get
        .mockResolvedValueOnce(mockTemplateSearchResponse) // Template search
        .mockResolvedValueOnce(mockTemplateDetailsResponses[0]) // Content page template
        .mockResolvedValueOnce(mockTemplateDetailsResponses[1]); // Landing page template

      const result = await templateSiteService.getTemplates();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      
      const contentPageTemplate = result.data![0];
      expect(contentPageTemplate.name).toBe('content-page');
      expect(contentPageTemplate.title).toBe('Content Page');
      expect(contentPageTemplate.description).toBe('Standard content page template');
      expect(contentPageTemplate.resourceType).toBe('mysite/components/page');
      expect(contentPageTemplate.allowedPaths).toEqual(['/content/mysite/.*']);
      expect(contentPageTemplate.ranking).toBe(100);
      expect(contentPageTemplate.status).toBe('enabled');
      expect(contentPageTemplate.thumbnail).toBe('/conf/mysite/settings/wcm/templates/content-page/thumbnail.png');

      const landingPageTemplate = result.data![1];
      expect(landingPageTemplate.status).toBe('disabled');

      expect(mockClient.get).toHaveBeenCalledTimes(3);
      expect(mockClient.get).toHaveBeenNthCalledWith(1,
        '/bin/querybuilder.json',
        expect.objectContaining({
          'path': '/conf',
          'type': 'cq:Template'
        }),
        expect.any(Object)
      );
    });

    it('should handle templates that cannot be accessed', async () => {
      const errorResponse = {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' }
      };

      mockClient.get
        .mockResolvedValueOnce(mockTemplateSearchResponse) // Template search
        .mockResolvedValueOnce(mockTemplateDetailsResponses[0]) // Content page template
        .mockResolvedValueOnce(errorResponse); // Landing page access denied

      const result = await templateSiteService.getTemplates();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1); // Only accessible template
      expect(result.data![0].name).toBe('content-page');
    });
  });

  describe('getTemplateStructure', () => {
    const mockTemplateStructureResponse = {
      success: true,
      data: {
        'jcr:primaryType': 'cq:Template',
        'jcr:title': 'Content Page',
        'jcr:description': 'Standard content page template',
        'sling:resourceType': 'mysite/components/page',
        'structure': {
          'jcr:primaryType': 'cq:Page',
          'jcr:content': {
            'jcr:primaryType': 'cq:PageContent',
            'sling:resourceType': 'mysite/components/page',
            'root': {
              'jcr:primaryType': 'nt:unstructured',
              'sling:resourceType': 'wcm/foundation/components/responsivegrid',
              'header': {
                'jcr:primaryType': 'nt:unstructured',
                'sling:resourceType': 'mysite/components/header',
                'jcr:title': 'Header Component'
              },
              'main': {
                'jcr:primaryType': 'nt:unstructured',
                'sling:resourceType': 'wcm/foundation/components/responsivegrid'
              }
            }
          }
        },
        'policies': {
          'jcr:primaryType': 'nt:unstructured',
          'jcr:content': {
            'root': {
              'jcr:primaryType': 'nt:unstructured',
              'sling:resourceType': 'wcm/core/wcm/policy',
              'jcr:title': 'Root Container Policy'
            }
          }
        },
        'initialContent': {
          'jcr:primaryType': 'cq:Page',
          'jcr:content': {
            'jcr:primaryType': 'cq:PageContent',
            'sling:resourceType': 'mysite/components/page',
            'jcr:title': 'New Page'
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

    it('should get template structure successfully', async () => {
      mockClient.get.mockResolvedValue(mockTemplateStructureResponse);

      const templatePath = '/conf/mysite/settings/wcm/templates/content-page';
      const result = await templateSiteService.getTemplateStructure(templatePath);

      expect(result.success).toBe(true);
      expect(result.data!.template.name).toBe('content-page');
      expect(result.data!.template.title).toBe('Content Page');
      
      // Check structure components
      expect(result.data!.structure.length).toBeGreaterThan(0);
      const rootComponent = result.data!.structure.find(c => c.path === 'jcr:content');
      expect(rootComponent).toBeDefined();
      expect(rootComponent!.resourceType).toBe('mysite/components/page');
      
      // Check policies
      expect(result.data!.policies.length).toBeGreaterThan(0);
      const rootPolicy = result.data!.policies.find(p => p.path === 'jcr:content');
      expect(rootPolicy).toBeDefined();
      
      // Check initial content
      expect(result.data!.initialContent).toBeDefined();
      expect(result.data!.initialContent!.length).toBeGreaterThan(0);

      expect(mockClient.get).toHaveBeenCalledWith(
        `${templatePath}.infinity.json`,
        undefined,
        expect.objectContaining({
          cache: true,
          cacheTtl: 600000,
          context: {
            operation: 'getTemplateStructure',
            resource: templatePath
          }
        })
      );
    });

    it('should throw validation error for empty template path', async () => {
      await expect(templateSiteService.getTemplateStructure('')).rejects.toThrow(AEMException);
      await expect(templateSiteService.getTemplateStructure('')).rejects.toThrow('Template path is required');
    });

    it('should throw not found error for non-existent template', async () => {
      const notFoundResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(notFoundResponse);

      await expect(templateSiteService.getTemplateStructure('/conf/non-existent/template')).rejects.toThrow(AEMException);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(templateSiteService.fetchSites()).rejects.toThrow(AEMException);
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.get.mockRejectedValue(originalError);

      await expect(templateSiteService.getTemplates()).rejects.toThrow('Original error');
    });

    it('should handle malformed response data', async () => {
      const malformedResponse = {
        success: true,
        data: 'invalid-data'
      };
      mockClient.get.mockResolvedValue(malformedResponse);

      const result = await templateSiteService.fetchSites();
      expect(result.data).toHaveLength(0);
    });
  });
});
