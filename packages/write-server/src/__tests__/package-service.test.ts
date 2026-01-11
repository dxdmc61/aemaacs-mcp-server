/**
 * Unit tests for Write Server Package Service
 */

import { PackageService, CreatePackageOptions, InstallPackageOptions, UploadPackageOptions, ModifyPackageOptions, RebuildPackageOptions, DeletePackageOptions, PackageOperationResult } from '../services/package-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('PackageService (Write)', () => {
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

  describe('createPackage', () => {
    const mockCreateResponse = {
      success: true,
      data: {
        success: true,
        path: '/etc/packages/mygroup/mypackage-1.0.zip',
        msg: 'Package created successfully',
        log: ['Package created at /etc/packages/mygroup/mypackage-1.0.zip']
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 200
      }
    };

    it('should create package successfully', async () => {
      const options: CreatePackageOptions = {
        groupName: 'mygroup',
        packageName: 'mypackage',
        version: '1.0',
        description: 'Test package',
        acHandling: 'overwrite',
        filters: [
          {
            root: '/content/mysite',
            rules: [
              { modifier: 'include', pattern: '/content/mysite/.*' },
              { modifier: 'exclude', pattern: '/content/mysite/tmp/.*' }
            ]
          }
        ]
      };

      mockClient.post.mockResolvedValue(mockCreateResponse);

      const result = await packageService.createPackage(options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.packagePath).toBe('/etc/packages/mygroup/mypackage-1.0.zip');
      expect(result.data!.message).toBe('Package created successfully');
      expect(result.data!.log).toEqual(['Package created at /etc/packages/mygroup/mypackage-1.0.zip']);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/crx/packmgr/service/.json/',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'createPackage',
            resource: '/etc/packages/mygroup/mypackage'
          }
        })
      );
    });

    it('should throw validation error for missing required fields', async () => {
      const invalidOptions = {
        groupName: '',
        packageName: 'mypackage'
      } as CreatePackageOptions;

      await expect(packageService.createPackage(invalidOptions)).rejects.toThrow(AEMException);
      await expect(packageService.createPackage(invalidOptions)).rejects.toThrow('Group name and package name are required');
    });

    it('should handle server errors gracefully', async () => {
      const options: CreatePackageOptions = {
        groupName: 'mygroup',
        packageName: 'mypackage'
      };

      const errorResponse = {
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' }
      };
      mockClient.post.mockResolvedValue(errorResponse);

      await expect(packageService.createPackage(options)).rejects.toThrow(AEMException);
      await expect(packageService.createPackage(options)).rejects.toThrow('Failed to create package');
    });
  });

  describe('installPackage', () => {
    const mockInstallResponse = {
      success: true,
      data: {
        success: true,
        msg: 'Package installed successfully',
        log: ['Installing package...', 'Package installed successfully']
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 5000
      }
    };

    it('should install package successfully', async () => {
      const packagePath = '/etc/packages/mygroup/mypackage-1.0.zip';
      const options: InstallPackageOptions = {
        recursive: true,
        autosave: 1024,
        acHandling: 'merge',
        strict: false
      };

      mockClient.post.mockResolvedValue(mockInstallResponse);

      const result = await packageService.installPackage(packagePath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.message).toBe('Package installed successfully');
      expect(result.data!.log).toEqual(['Installing package...', 'Package installed successfully']);

      expect(mockClient.post).toHaveBeenCalledWith(
        `${packagePath}/.json`,
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'installPackage',
            resource: packagePath
          }
        })
      );
    });

    it('should throw validation error for empty package path', async () => {
      await expect(packageService.installPackage('')).rejects.toThrow(AEMException);
      await expect(packageService.installPackage('')).rejects.toThrow('Package path is required');
    });

    it('should handle installation failures', async () => {
      const packagePath = '/etc/packages/mygroup/mypackage-1.0.zip';
      const errorResponse = {
        success: true,
        data: {
          success: false,
          msg: 'Installation failed',
          errors: ['Dependency not found', 'Permission denied']
        }
      };

      mockClient.post.mockResolvedValue(errorResponse);

      const result = await packageService.installPackage(packagePath);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(false);
      expect(result.data!.errors).toEqual(['Dependency not found', 'Permission denied']);
    });
  });

  describe('uploadPackage', () => {
    const mockUploadResponse = {
      success: true,
      data: {
        success: true,
        path: '/etc/packages/uploaded/package-1.0.zip',
        msg: 'Package uploaded successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 3000
      }
    };

    it('should upload package file successfully', async () => {
      const mockFile = new File(['package content'], 'package.zip', { type: 'application/zip' });
      const options: UploadPackageOptions = {
        force: true,
        install: false
      };

      mockClient.upload.mockResolvedValue(mockUploadResponse);

      const result = await packageService.uploadPackage(mockFile, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.packagePath).toBe('/etc/packages/uploaded/package-1.0.zip');
      expect(result.data!.message).toBe('Package uploaded successfully');

      expect(mockClient.upload).toHaveBeenCalledWith(
        '/crx/packmgr/service/.json/',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'uploadPackage',
            resource: '/crx/packmgr/service'
          }
        })
      );
    });

    it('should upload package buffer successfully', async () => {
      const mockBuffer = Buffer.from('package content');
      const options: UploadPackageOptions = {
        install: true,
        installOptions: {
          recursive: true,
          acHandling: 'overwrite'
        }
      };

      mockClient.upload.mockResolvedValue(mockUploadResponse);

      const result = await packageService.uploadPackage(mockBuffer, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
    });

    it('should handle upload failures', async () => {
      const mockFile = new File(['package content'], 'package.zip', { type: 'application/zip' });
      const errorResponse = {
        success: false,
        error: { code: 'UPLOAD_ERROR', message: 'Upload failed' }
      };

      mockClient.upload.mockResolvedValue(errorResponse);

      await expect(packageService.uploadPackage(mockFile)).rejects.toThrow(AEMException);
      await expect(packageService.uploadPackage(mockFile)).rejects.toThrow('Failed to upload package');
    });
  });

  describe('uploadAndInstallPackage', () => {
    const mockUploadInstallResponse = {
      success: true,
      data: {
        success: true,
        path: '/etc/packages/uploaded/package-1.0.zip',
        msg: 'Package uploaded and installed successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 8000
      }
    };

    it('should upload and install package successfully', async () => {
      const mockFile = new File(['package content'], 'package.zip', { type: 'application/zip' });
      const installOptions: InstallPackageOptions = {
        recursive: true,
        acHandling: 'merge'
      };

      mockClient.upload.mockResolvedValue(mockUploadInstallResponse);

      const result = await packageService.uploadAndInstallPackage(mockFile, installOptions);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.message).toBe('Package uploaded and installed successfully');
    });
  });

  describe('rebuildPackage', () => {
    const mockRebuildResponse = {
      success: true,
      data: {
        success: true,
        msg: 'Package rebuilt successfully',
        log: ['Rebuilding package...', 'Package rebuilt successfully']
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 2000
      }
    };

    it('should rebuild package successfully', async () => {
      const packagePath = '/etc/packages/mygroup/mypackage-1.0.zip';
      const options: RebuildPackageOptions = {
        force: true
      };

      mockClient.post.mockResolvedValue(mockRebuildResponse);

      const result = await packageService.rebuildPackage(packagePath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.message).toBe('Package rebuilt successfully');

      expect(mockClient.post).toHaveBeenCalledWith(
        `${packagePath}/.json`,
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'rebuildPackage',
            resource: packagePath
          }
        })
      );
    });

    it('should throw validation error for empty package path', async () => {
      await expect(packageService.rebuildPackage('')).rejects.toThrow(AEMException);
      await expect(packageService.rebuildPackage('')).rejects.toThrow('Package path is required');
    });
  });

  describe('modifyPackage', () => {
    const mockModifyResponse = {
      success: true,
      data: {
        success: true,
        msg: 'Package modified successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 1000
      }
    };

    it('should modify package successfully', async () => {
      const packagePath = '/etc/packages/mygroup/mypackage-1.0.zip';
      const options: ModifyPackageOptions = {
        description: 'Updated description',
        acHandling: 'merge_preserve',
        filters: [
          {
            root: '/content/updated',
            rules: [{ modifier: 'include', pattern: '/content/updated/.*' }]
          }
        ],
        properties: {
          'custom.property': 'custom value'
        }
      };

      mockClient.post.mockResolvedValue(mockModifyResponse);

      const result = await packageService.modifyPackage(packagePath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.message).toBe('Package modified successfully');

      expect(mockClient.post).toHaveBeenCalledWith(
        `${packagePath}/.json`,
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'modifyPackage',
            resource: packagePath
          }
        })
      );
    });

    it('should throw validation error for empty package path', async () => {
      const options: ModifyPackageOptions = {
        description: 'Updated description'
      };

      await expect(packageService.modifyPackage('', options)).rejects.toThrow(AEMException);
      await expect(packageService.modifyPackage('', options)).rejects.toThrow('Package path is required');
    });
  });

  describe('deletePackage', () => {
    const mockDeleteResponse = {
      success: true,
      data: {
        success: true,
        msg: 'Package deleted successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 500
      }
    };

    it('should delete package successfully', async () => {
      const packagePath = '/etc/packages/mygroup/mypackage-1.0.zip';
      const options: DeletePackageOptions = {
        force: true,
        uninstall: true
      };

      mockClient.post.mockResolvedValue(mockDeleteResponse);

      const result = await packageService.deletePackage(packagePath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.message).toBe('Package deleted successfully');

      expect(mockClient.post).toHaveBeenCalledWith(
        `${packagePath}/.json`,
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'deletePackage',
            resource: packagePath
          }
        })
      );
    });

    it('should throw validation error for empty package path', async () => {
      await expect(packageService.deletePackage('')).rejects.toThrow(AEMException);
      await expect(packageService.deletePackage('')).rejects.toThrow('Package path is required');
    });

    it('should prevent deletion of system packages', async () => {
      const systemPackagePath = '/etc/packages/adobe/cq-system-package-1.0.zip';

      await expect(packageService.deletePackage(systemPackagePath)).rejects.toThrow(AEMException);
      await expect(packageService.deletePackage(systemPackagePath)).rejects.toThrow('Cannot delete system package');
    });

    it('should allow deletion of non-system packages', async () => {
      const userPackagePath = '/etc/packages/mycompany/mypackage-1.0.zip';

      mockClient.post.mockResolvedValue(mockDeleteResponse);

      const result = await packageService.deletePackage(userPackagePath);

      expect(result.success).toBe(true);
      expect(mockClient.post).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockClient.post.mockRejectedValue(networkError);

      const options: CreatePackageOptions = {
        groupName: 'mygroup',
        packageName: 'mypackage'
      };

      await expect(packageService.createPackage(options)).rejects.toThrow(AEMException);
      await expect(packageService.createPackage(options)).rejects.toThrow('Unexpected error while creating package');
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.post.mockRejectedValue(originalError);

      const options: CreatePackageOptions = {
        groupName: 'mygroup',
        packageName: 'mypackage'
      };

      await expect(packageService.createPackage(options)).rejects.toThrow('Original error');
    });

    it('should handle malformed responses', async () => {
      const malformedResponse = {
        success: false,
        data: null
      };
      mockClient.post.mockResolvedValue(malformedResponse);

      const options: CreatePackageOptions = {
        groupName: 'mygroup',
        packageName: 'mypackage'
      };

      await expect(packageService.createPackage(options)).rejects.toThrow(AEMException);
      await expect(packageService.createPackage(options)).rejects.toThrow('Failed to create package');
    });
  });

  describe('response parsing', () => {
    it('should parse successful operation response correctly', async () => {
      const response = {
        success: true,
        data: {
          success: true,
          path: '/etc/packages/test/package.zip',
          msg: 'Operation successful',
          log: ['Step 1', 'Step 2'],
          warnings: ['Warning message']
        }
      };

      mockClient.post.mockResolvedValue(response);

      const options: CreatePackageOptions = {
        groupName: 'test',
        packageName: 'package'
      };

      const result = await packageService.createPackage(options);

      expect(result.data!.success).toBe(true);
      expect(result.data!.packagePath).toBe('/etc/packages/test/package.zip');
      expect(result.data!.message).toBe('Operation successful');
      expect(result.data!.log).toEqual(['Step 1', 'Step 2']);
      expect(result.data!.warnings).toEqual(['Warning message']);
    });

    it('should parse failed operation response correctly', async () => {
      const response = {
        success: true,
        data: {
          success: false,
          msg: 'Operation failed',
          error: 'Error message',
          errors: ['Error 1', 'Error 2']
        }
      };

      mockClient.post.mockResolvedValue(response);

      const options: CreatePackageOptions = {
        groupName: 'test',
        packageName: 'package'
      };

      const result = await packageService.createPackage(options);

      expect(result.data!.success).toBe(false);
      expect(result.data!.message).toBe('Operation failed');
      expect(result.data!.errors).toEqual(['Error message', 'Error 1', 'Error 2']);
    });
  });

  describe('system package detection', () => {
    it('should identify system packages correctly', async () => {
      const systemPackages = [
        '/etc/packages/adobe/test-package.zip',
        '/etc/packages/day/test-package.zip',
        '/etc/packages/cq/test-package.zip',
        '/etc/packages/granite/test-package.zip',
        '/etc/packages/sling/test-package.zip'
      ];

      for (const packagePath of systemPackages) {
        await expect(packageService.deletePackage(packagePath)).rejects.toThrow('Cannot delete system package');
      }
    });

    it('should allow deletion of non-system packages', async () => {
      const userPackages = [
        '/etc/packages/mycompany/test-package.zip',
        '/etc/packages/custom/test-package.zip',
        '/etc/packages/project/test-package.zip'
      ];

      const mockResponse = {
        success: true,
        data: { success: true, msg: 'Deleted' }
      };

      for (const packagePath of userPackages) {
        mockClient.post.mockResolvedValue(mockResponse);
        
        const result = await packageService.deletePackage(packagePath);
        expect(result.success).toBe(true);
        
        jest.clearAllMocks();
      }
    });
  });
});
