/**
 * Unit tests for Package Service
 */

import { PackageService, PackageInfo, PackageStatus, ListPackagesOptions } from '../services/package-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse, Package } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('PackageService', () => {
  let packageService: PackageService;
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

    packageService = new PackageService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listPackages', () => {
    const mockPackageListResponse = {
      success: true,
      data: {
        results: [
          {
            name: 'test-package-1',
            group: 'my-group',
            version: '1.0.0',
            path: '/etc/packages/my-group/test-package-1-1.0.0.zip',
            size: '1024',
            created: '2024-01-01T00:00:00.000Z',
            lastModified: '2024-01-02T00:00:00.000Z',
            installed: true,
            builtWith: 'AEM Package Manager'
          },
          {
            name: 'test-package-2',
            group: 'my-group',
            version: '2.0.0',
            path: '/etc/packages/my-group/test-package-2-2.0.0.zip',
            size: '2048',
            created: '2024-01-03T00:00:00.000Z',
            lastModified: '2024-01-04T00:00:00.000Z',
            installed: false
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

    it('should list packages successfully', async () => {
      mockClient.get.mockResolvedValue(mockPackageListResponse);

      const result = await packageService.listPackages();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].name).toBe('test-package-1');
      expect(result.data![0].group).toBe('my-group');
      expect(result.data![0].installed).toBe(true);
      expect(result.data![1].name).toBe('test-package-2');
      expect(result.data![1].installed).toBe(false);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/crx/packmgr/list.jsp',
        {},
        expect.objectContaining({
          cache: true,
          cacheTtl: 60000,
          context: {
            operation: 'listPackages',
            resource: '/crx/packmgr/list.jsp'
          }
        })
      );
    });

    it('should list packages with group filter', async () => {
      mockClient.get.mockResolvedValue(mockPackageListResponse);

      const options: ListPackagesOptions = {
        group: 'my-group'
      };

      await packageService.listPackages(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/crx/packmgr/list.jsp',
        { group: 'my-group' },
        expect.any(Object)
      );
    });

    it('should list packages with all options', async () => {
      mockClient.get.mockResolvedValue(mockPackageListResponse);

      const options: ListPackagesOptions = {
        group: 'my-group',
        includeVersions: true,
        includeSnapshots: false,
        orderBy: 'name',
        orderDirection: 'desc',
        limit: 10,
        offset: 5
      };

      await packageService.listPackages(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/crx/packmgr/list.jsp',
        {
          group: 'my-group',
          includeVersions: true,
          includeSnapshots: false
        },
        expect.any(Object)
      );
    });

    it('should handle empty package list', async () => {
      const emptyResponse = {
        ...mockPackageListResponse,
        data: { results: [] }
      };
      mockClient.get.mockResolvedValue(emptyResponse);

      const result = await packageService.listPackages();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should handle different response formats', async () => {
      const alternativeResponse = {
        ...mockPackageListResponse,
        data: [mockPackageListResponse.data.results[0]]
      };
      mockClient.get.mockResolvedValue(alternativeResponse);

      const result = await packageService.listPackages();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should sort packages by name ascending', async () => {
      const unsortedResponse = {
        ...mockPackageListResponse,
        data: {
          results: [
            { ...mockPackageListResponse.data.results[1], name: 'z-package' },
            { ...mockPackageListResponse.data.results[0], name: 'a-package' }
          ]
        }
      };
      mockClient.get.mockResolvedValue(unsortedResponse);

      const result = await packageService.listPackages({ orderBy: 'name', orderDirection: 'asc' });

      expect(result.data![0].name).toBe('a-package');
      expect(result.data![1].name).toBe('z-package');
    });

    it('should apply limit and offset', async () => {
      const manyPackagesResponse = {
        ...mockPackageListResponse,
        data: {
          results: Array.from({ length: 10 }, (_, i) => ({
            ...mockPackageListResponse.data.results[0],
            name: `package-${i}`,
            path: `/etc/packages/group/package-${i}.zip`
          }))
        }
      };
      mockClient.get.mockResolvedValue(manyPackagesResponse);

      const result = await packageService.listPackages({ limit: 3, offset: 2 });

      expect(result.data).toHaveLength(3);
      expect(result.data![0].name).toBe('package-2');
      expect(result.data![2].name).toBe('package-4');
    });

    it('should throw AEMException on client error', async () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error',
          recoverable: true
        }
      };
      mockClient.get.mockResolvedValue(errorResponse);

      await expect(packageService.listPackages()).rejects.toThrow(AEMException);
    });

    it('should handle client rejection', async () => {
      mockClient.get.mockRejectedValue(new Error('Network error'));

      await expect(packageService.listPackages()).rejects.toThrow(AEMException);
    });
  });

  describe('getPackageInfo', () => {
    const mockPackageInfoResponse = {
      success: true,
      data: {
        name: 'test-package',
        group: 'my-group',
        version: '1.0.0',
        path: '/etc/packages/my-group/test-package-1.0.0.zip',
        size: '1024',
        created: '2024-01-01T00:00:00.000Z',
        lastModified: '2024-01-02T00:00:00.000Z',
        installed: true,
        description: 'Test package description',
        dependencies: ['dependency1', 'dependency2'],
        filter: [
          {
            root: '/content/mysite',
            rules: [
              { modifier: 'include', pattern: '*' },
              { modifier: 'exclude', pattern: '*.tmp' }
            ]
          }
        ],
        screenshots: ['screenshot1.png', 'screenshot2.png'],
        thumbnail: 'thumbnail.png',
        definition: {
          'jcr:created': '2024-01-01T00:00:00.000Z',
          'jcr:createdBy': 'admin'
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 150,
        cached: false
      }
    };

    it('should get package info successfully', async () => {
      mockClient.get.mockResolvedValue(mockPackageInfoResponse);

      const packagePath = '/etc/packages/my-group/test-package-1.0.0.zip';
      const result = await packageService.getPackageInfo(packagePath);

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('test-package');
      expect(result.data!.description).toBe('Test package description');
      expect(result.data!.dependencies).toEqual(['dependency1', 'dependency2']);
      expect(result.data!.filters).toHaveLength(1);
      expect(result.data!.filters![0].root).toBe('/content/mysite');
      expect(result.data!.filters![0].rules).toHaveLength(2);
      expect(result.data!.screenshots).toEqual(['screenshot1.png', 'screenshot2.png']);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/crx/packmgr/service/.json${packagePath}`,
        undefined,
        expect.objectContaining({
          cache: true,
          cacheTtl: 300000,
          context: {
            operation: 'getPackageInfo',
            resource: packagePath
          }
        })
      );
    });

    it('should throw validation error for empty package path', async () => {
      await expect(packageService.getPackageInfo('')).rejects.toThrow(AEMException);
      await expect(packageService.getPackageInfo('')).rejects.toThrow('Package path is required');
    });

    it('should throw not found error for non-existent package', async () => {
      const notFoundResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(notFoundResponse);

      const packagePath = '/etc/packages/non-existent/package.zip';
      await expect(packageService.getPackageInfo(packagePath)).rejects.toThrow(AEMException);
    });

    it('should handle minimal package data', async () => {
      const minimalResponse = {
        ...mockPackageInfoResponse,
        data: {
          name: 'minimal-package',
          group: 'default',
          version: '1.0.0'
        }
      };
      mockClient.get.mockResolvedValue(minimalResponse);

      const result = await packageService.getPackageInfo('/etc/packages/minimal.zip');

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('minimal-package');
      expect(result.data!.dependencies).toEqual([]);
      expect(result.data!.filters).toEqual([]);
    });
  });

  describe('getPackageStatus', () => {
    const mockPackageStatusResponse = {
      success: true,
      data: {
        installed: true,
        installTime: '2024-01-01T12:00:00.000Z',
        installedBy: 'admin',
        log: [
          'Package installation started',
          'Installing content...',
          'Package installation completed successfully'
        ],
        errors: [],
        warnings: ['Warning: Some files were skipped']
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 75,
        cached: false
      }
    };

    it('should get package status successfully', async () => {
      mockClient.get.mockResolvedValue(mockPackageStatusResponse);

      const packagePath = '/etc/packages/my-group/test-package-1.0.0.zip';
      const result = await packageService.getPackageStatus(packagePath);

      expect(result.success).toBe(true);
      expect(result.data!.path).toBe(packagePath);
      expect(result.data!.installed).toBe(true);
      expect(result.data!.installationDate).toEqual(new Date('2024-01-01T12:00:00.000Z'));
      expect(result.data!.installedBy).toBe('admin');
      expect(result.data!.installationLog).toHaveLength(3);
      expect(result.data!.errors).toEqual([]);
      expect(result.data!.warnings).toEqual(['Warning: Some files were skipped']);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/crx/packmgr/service/.json${packagePath}`,
        { cmd: 'status' },
        expect.objectContaining({
          cache: true,
          cacheTtl: 30000,
          context: {
            operation: 'getPackageStatus',
            resource: packagePath
          }
        })
      );
    });

    it('should handle not installed package', async () => {
      const notInstalledResponse = {
        ...mockPackageStatusResponse,
        data: {
          installed: false,
          status: 'not-installed'
        }
      };
      mockClient.get.mockResolvedValue(notInstalledResponse);

      const result = await packageService.getPackageStatus('/etc/packages/not-installed.zip');

      expect(result.success).toBe(true);
      expect(result.data!.installed).toBe(false);
      expect(result.data!.installationDate).toBeUndefined();
    });

    it('should throw validation error for empty package path', async () => {
      await expect(packageService.getPackageStatus('')).rejects.toThrow(AEMException);
      await expect(packageService.getPackageStatus('')).rejects.toThrow('Package path is required');
    });

    it('should handle package status not available', async () => {
      const notAvailableResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(notAvailableResponse);

      const packagePath = '/etc/packages/unavailable.zip';
      await expect(packageService.getPackageStatus(packagePath)).rejects.toThrow(AEMException);
    });

    it('should handle different log formats', async () => {
      const stringLogResponse = {
        ...mockPackageStatusResponse,
        data: {
          installed: true,
          log: 'Single line log\nSecond line\nThird line'
        }
      };
      mockClient.get.mockResolvedValue(stringLogResponse);

      const result = await packageService.getPackageStatus('/etc/packages/test.zip');

      expect(result.data!.installationLog).toEqual(['Single line log', 'Second line', 'Third line']);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(packageService.listPackages()).rejects.toThrow(AEMException);
    });

    it('should handle malformed response data', async () => {
      const malformedResponse = {
        success: true,
        data: 'invalid-json-string'
      };
      mockClient.get.mockResolvedValue(malformedResponse);

      const result = await packageService.listPackages();
      expect(result.data).toEqual([]);
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.get.mockRejectedValue(originalError);

      await expect(packageService.listPackages()).rejects.toThrow('Original error');
    });
  });

  describe('data parsing', () => {
    it('should handle null package data', async () => {
      const nullDataResponse = {
        success: true,
        data: {
          results: [null, undefined, { name: 'valid-package', group: 'test' }]
        }
      };
      mockClient.get.mockResolvedValue(nullDataResponse);

      const result = await packageService.listPackages();

      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe('valid-package');
    });

    it('should handle missing required fields with defaults', async () => {
      const incompleteDataResponse = {
        success: true,
        data: {
          results: [{
            name: 'incomplete-package'
            // Missing group, version, etc.
          }]
        }
      };
      mockClient.get.mockResolvedValue(incompleteDataResponse);

      const result = await packageService.listPackages();

      expect(result.data).toHaveLength(1);
      expect(result.data![0].group).toBe('default');
      expect(result.data![0].version).toBe('1.0.0');
      expect(result.data![0].size).toBe(0);
    });

    it('should parse complex dependencies', async () => {
      const complexDepsResponse = {
        success: true,
        data: {
          name: 'test-package',
          dependencies: [
            'simple-dep',
            { name: 'complex-dep', version: '1.0' },
            { id: 'id-dep' }
          ]
        }
      };
      mockClient.get.mockResolvedValue(complexDepsResponse);

      const result = await packageService.getPackageInfo('/test/path');

      expect(result.data!.dependencies).toEqual(['simple-dep', 'complex-dep', 'id-dep']);
    });
  });
});
