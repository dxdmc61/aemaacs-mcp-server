/**
 * Unit tests for Asset Management Service
 */

import { AssetManagementService, AssetMetadataExtended, ListAssetsOptions, AssetReferences, AssetVersionHistory } from '../services/asset-management-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse, Asset, Rendition } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('AssetManagementService', () => {
  let assetService: AssetManagementService;
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

    assetService = new AssetManagementService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAssetMetadata', () => {
    const mockMetadataResponse = {
      success: true,
      data: {
        'dc:title': 'Test Image',
        'dc:description': 'A test image for unit testing',
        'dc:creator': 'Test User',
        'dc:format': 'image/jpeg',
        'dam:size': '1024000',
        'dam:sha1': 'abc123def456',
        'dam:MIMEtype': 'image/jpeg',
        'tiff:ImageWidth': '1920',
        'tiff:ImageLength': '1080',
        'tiff:BitsPerSample': '8',
        'tiff:PhotometricInterpretation': 'RGB',
        'exif:DateTimeOriginal': '2024-01-01T12:00:00.000Z',
        'exif:ExposureTime': '1/60',
        'exif:FNumber': 'f/2.8',
        'exif:ISOSpeedRatings': '100',
        'xmp:CreatorTool': 'Adobe Photoshop',
        'xmp:CreateDate': '2024-01-01T12:00:00.000Z',
        'xmp:ModifyDate': '2024-01-02T12:00:00.000Z'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100,
        cached: false
      }
    };

    it('should get asset metadata successfully', async () => {
      mockClient.get.mockResolvedValue(mockMetadataResponse);

      const assetPath = '/content/dam/test/image.jpg';
      const result = await assetService.getAssetMetadata(assetPath);

      expect(result.success).toBe(true);
      expect(result.data!['dc:title']).toBe('Test Image');
      expect(result.data!['dam:size']).toBe(1024000);
      expect(result.data!['tiff:ImageWidth']).toBe(1920);
      expect(result.data!['tiff:ImageLength']).toBe(1080);
      expect(result.data!.width).toBe(1920);
      expect(result.data!.height).toBe(1080);

      expect(mockClient.get).toHaveBeenCalledWith(
        `${assetPath}/jcr:content/metadata.json`,
        undefined,
        expect.objectContaining({
          cache: true,
          cacheTtl: 300000,
          context: {
            operation: 'getAssetMetadata',
            resource: assetPath
          }
        })
      );
    });

    it('should throw validation error for empty asset path', async () => {
      await expect(assetService.getAssetMetadata('')).rejects.toThrow(AEMException);
      await expect(assetService.getAssetMetadata('')).rejects.toThrow('Asset path is required');
    });

    it('should throw not found error for non-existent asset', async () => {
      const notFoundResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(notFoundResponse);

      const assetPath = '/content/dam/non-existent/image.jpg';
      await expect(assetService.getAssetMetadata(assetPath)).rejects.toThrow(AEMException);
    });

    it('should handle minimal metadata', async () => {
      const minimalResponse = {
        ...mockMetadataResponse,
        data: {
          'dc:format': 'image/png',
          'dam:MIMEtype': 'image/png'
        }
      };
      mockClient.get.mockResolvedValue(minimalResponse);

      const result = await assetService.getAssetMetadata('/content/dam/minimal.png');

      expect(result.success).toBe(true);
      expect(result.data!.format).toBe('image/png');
      expect(result.data!['dam:MIMEtype']).toBe('image/png');
    });
  });

  describe('listAssets', () => {
    const mockAssetListResponse = {
      success: true,
      data: {
        hits: [
          {
            path: '/content/dam/test/image1.jpg',
            name: 'image1.jpg',
            'jcr:primaryType': 'dam:Asset',
            'jcr:lastModified': '2024-01-01T00:00:00.000Z',
            'jcr:content': {
              metadata: {
                'dc:title': 'Image 1',
                'dc:format': 'image/jpeg',
                'dam:size': '500000',
                'tiff:ImageWidth': '1024',
                'tiff:ImageLength': '768'
              }
            }
          },
          {
            path: '/content/dam/test/image2.png',
            name: 'image2.png',
            'jcr:primaryType': 'dam:Asset',
            'jcr:lastModified': '2024-01-02T00:00:00.000Z',
            'jcr:content': {
              metadata: {
                'dc:title': 'Image 2',
                'dc:format': 'image/png',
                'dam:size': '750000'
              }
            }
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

    it('should list assets successfully', async () => {
      mockClient.get.mockResolvedValue(mockAssetListResponse);

      const result = await assetService.listAssets();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].name).toBe('image1.jpg');
      expect(result.data![0].mimeType).toBe('image/jpeg');
      expect(result.data![0].size).toBe(500000);
      expect(result.data![1].name).toBe('image2.png');
      expect(result.data![1].mimeType).toBe('image/png');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        expect.objectContaining({
          'path': '/content/dam',
          'type': 'dam:Asset',
          'p.limit': 50,
          'p.offset': 0
        }),
        expect.any(Object)
      );
    });

    it('should list assets with custom path', async () => {
      mockClient.get.mockResolvedValue(mockAssetListResponse);

      const options: ListAssetsOptions = {
        path: '/content/dam/custom',
        limit: 10
      };

      await assetService.listAssets(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        expect.objectContaining({
          'path': '/content/dam/custom',
          'p.limit': 10
        }),
        expect.any(Object)
      );
    });

    it('should list assets with MIME type filter', async () => {
      mockClient.get.mockResolvedValue(mockAssetListResponse);

      const options: ListAssetsOptions = {
        mimeType: 'image/jpeg'
      };

      await assetService.listAssets(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        expect.objectContaining({
          'property': 'jcr:content/metadata/dc:format',
          'property.value': 'image/jpeg'
        }),
        expect.any(Object)
      );
    });

    it('should list assets with ordering', async () => {
      mockClient.get.mockResolvedValue(mockAssetListResponse);

      const options: ListAssetsOptions = {
        orderBy: 'size',
        orderDirection: 'desc'
      };

      await assetService.listAssets(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        expect.objectContaining({
          'orderby': 'jcr:content/metadata/@dam:size',
          'orderby.sort': 'desc'
        }),
        expect.any(Object)
      );
    });

    it('should handle empty asset list', async () => {
      const emptyResponse = {
        ...mockAssetListResponse,
        data: { hits: [] }
      };
      mockClient.get.mockResolvedValue(emptyResponse);

      const result = await assetService.listAssets();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('getAssetRenditions', () => {
    const mockRenditionsResponse = {
      success: true,
      data: {
        'cq5dam.thumbnail.48.48.png': {
          'jcr:primaryType': 'nt:file',
          metadata: {
            'dc:format': 'image/png',
            'dam:size': '2048',
            'tiff:ImageWidth': '48',
            'tiff:ImageLength': '48'
          }
        },
        'cq5dam.thumbnail.140.100.png': {
          'jcr:primaryType': 'nt:file',
          metadata: {
            'dc:format': 'image/png',
            'dam:size': '5120',
            'tiff:ImageWidth': '140',
            'tiff:ImageLength': '100'
          }
        },
        'cq5dam.web.1280.1280.jpeg': {
          'jcr:primaryType': 'nt:file',
          metadata: {
            'dc:format': 'image/jpeg',
            'dam:size': '102400',
            'tiff:ImageWidth': '1280',
            'tiff:ImageLength': '960'
          }
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 75,
        cached: false
      }
    };

    it('should get asset renditions successfully', async () => {
      mockClient.get.mockResolvedValue(mockRenditionsResponse);

      const assetPath = '/content/dam/test/image.jpg';
      const result = await assetService.getAssetRenditions(assetPath);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      
      const thumbnail = result.data!.find(r => r.name === 'cq5dam.thumbnail.48.48.png');
      expect(thumbnail).toBeDefined();
      expect(thumbnail!.width).toBe(48);
      expect(thumbnail!.height).toBe(48);
      expect(thumbnail!.size).toBe(2048);
      expect(thumbnail!.mimeType).toBe('image/png');

      const webRendition = result.data!.find(r => r.name === 'cq5dam.web.1280.1280.jpeg');
      expect(webRendition).toBeDefined();
      expect(webRendition!.width).toBe(1280);
      expect(webRendition!.height).toBe(960);

      expect(mockClient.get).toHaveBeenCalledWith(
        `${assetPath}/jcr:content/renditions.json`,
        undefined,
        expect.objectContaining({
          cache: true,
          cacheTtl: 300000,
          context: {
            operation: 'getAssetRenditions',
            resource: assetPath
          }
        })
      );
    });

    it('should throw validation error for empty asset path', async () => {
      await expect(assetService.getAssetRenditions('')).rejects.toThrow(AEMException);
      await expect(assetService.getAssetRenditions('')).rejects.toThrow('Asset path is required');
    });

    it('should handle asset without renditions', async () => {
      const notFoundResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(notFoundResponse);

      const assetPath = '/content/dam/no-renditions.jpg';
      await expect(assetService.getAssetRenditions(assetPath)).rejects.toThrow(AEMException);
    });
  });

  describe('getAssetReferences', () => {
    const mockReferencesResponse = {
      success: true,
      data: {
        hits: [
          {
            path: '/content/mysite/en/page1/jcr:content/root/image',
            'jcr:primaryType': 'nt:unstructured',
            'sling:resourceType': 'core/wcm/components/image/v2/image'
          },
          {
            path: '/content/mysite/en/page2/jcr:content/root/teaser',
            'jcr:primaryType': 'nt:unstructured',
            'sling:resourceType': 'core/wcm/components/teaser/v1/teaser'
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

    it('should get asset references successfully', async () => {
      mockClient.get.mockResolvedValue(mockReferencesResponse);

      const assetPath = '/content/dam/test/image.jpg';
      const result = await assetService.getAssetReferences(assetPath);

      expect(result.success).toBe(true);
      expect(result.data!.assetPath).toBe(assetPath);
      expect(result.data!.totalReferences).toBe(2);
      expect(result.data!.references).toHaveLength(2);
      
      expect(result.data!.references[0].referencingPath).toBe('/content/mysite/en/page1/jcr:content/root/image');
      expect(result.data!.references[0].referenceType).toBe('direct');
      expect(result.data!.references[0].context).toBe('core/wcm/components/image/v2/image');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        {
          'property': 'fileReference',
          'property.value': assetPath,
          'p.limit': 100
        },
        expect.objectContaining({
          cache: true,
          cacheTtl: 180000,
          context: {
            operation: 'getAssetReferences',
            resource: assetPath
          }
        })
      );
    });

    it('should handle asset with no references', async () => {
      const noReferencesResponse = {
        ...mockReferencesResponse,
        data: { hits: [] }
      };
      mockClient.get.mockResolvedValue(noReferencesResponse);

      const result = await assetService.getAssetReferences('/content/dam/unused.jpg');

      expect(result.success).toBe(true);
      expect(result.data!.totalReferences).toBe(0);
      expect(result.data!.references).toHaveLength(0);
    });
  });

  describe('getAssetVersions', () => {
    const mockVersionsResponse = {
      success: true,
      data: {
        versions: {
          '1.0': {
            'jcr:created': '2024-01-01T12:00:00.000Z',
            'jcr:createdBy': 'admin',
            'jcr:comment': 'Initial version'
          },
          '1.1': {
            'jcr:created': '2024-01-02T12:00:00.000Z',
            'jcr:createdBy': 'editor',
            'jcr:comment': 'Updated metadata',
            'jcr:versionLabels': ['approved']
          },
          '1.2': {
            'jcr:created': '2024-01-03T12:00:00.000Z',
            'jcr:createdBy': 'admin',
            'jcr:comment': 'Final version'
          }
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 90,
        cached: false
      }
    };

    it('should get asset versions successfully', async () => {
      mockClient.get.mockResolvedValue(mockVersionsResponse);

      const assetPath = '/content/dam/test/image.jpg';
      const result = await assetService.getAssetVersions(assetPath);

      expect(result.success).toBe(true);
      expect(result.data!.assetPath).toBe(assetPath);
      expect(result.data!.totalVersions).toBe(3);
      expect(result.data!.currentVersion).toBe('1.2'); // Latest version
      expect(result.data!.versions).toHaveLength(3);
      
      // Versions should be sorted by creation date (newest first)
      expect(result.data!.versions[0].versionName).toBe('1.2');
      expect(result.data!.versions[0].createdBy).toBe('admin');
      expect(result.data!.versions[1].versionName).toBe('1.1');
      expect(result.data!.versions[1].labels).toEqual(['approved']);

      expect(mockClient.get).toHaveBeenCalledWith(
        `${assetPath}.versions.json`,
        undefined,
        expect.objectContaining({
          cache: true,
          cacheTtl: 300000,
          context: {
            operation: 'getAssetVersions',
            resource: assetPath
          }
        })
      );
    });

    it('should handle asset without versions', async () => {
      const noVersionsResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(noVersionsResponse);

      const result = await assetService.getAssetVersions('/content/dam/no-versions.jpg');

      expect(result.success).toBe(true);
      expect(result.data!.totalVersions).toBe(0);
      expect(result.data!.currentVersion).toBe('1.0');
      expect(result.data!.versions).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(assetService.getAssetMetadata('/content/dam/test.jpg')).rejects.toThrow(AEMException);
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.get.mockRejectedValue(originalError);

      await expect(assetService.listAssets()).rejects.toThrow('Original error');
    });
  });
});
