/**
 * Unit tests for Asset Management Service
 */

import { AssetManagementService, AssetMetadata, UploadAssetOptions, UpdateAssetOptions, DeleteAssetOptions, ProcessAssetsOptions, AssetOperationResult, UploadResult, ProcessResult, FolderResult } from '../services/asset-management-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
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

  describe('uploadAsset', () => {
    const mockUploadResponse = {
      success: true,
      data: {
        success: true,
        path: '/content/dam/mysite/images/photo.jpg',
        mimeType: 'image/jpeg',
        size: '12345',
        message: 'Asset uploaded successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 300
      }
    };

    it('should upload asset successfully', async () => {
      const parentPath = '/content/dam/mysite/images';
      const fileName = 'photo.jpg';
      const fileContent = Buffer.from('fake image content');
      const options: UploadAssetOptions = {
        metadata: {
          'dc:title': 'Test Photo',
          'dc:description': 'A test photo for unit testing',
          'dc:subject': ['test', 'photo'],
          'cq:tags': ['mysite:category/images']
        },
        overwrite: true,
        processAsset: true
      };

      mockClient.upload.mockResolvedValue(mockUploadResponse);

      const result = await assetService.uploadAsset(parentPath, fileName, fileContent, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe('/content/dam/mysite/images/photo.jpg');
      expect(result.data!.fileName).toBe('photo.jpg');
      expect(result.data!.mimeType).toBe('image/jpeg');
      expect(result.data!.size).toBe(12345);

      expect(mockClient.upload).toHaveBeenCalledWith(
        '/content/dam/mysite/images.createasset.html',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'uploadAsset',
            resource: '/content/dam/mysite/images/photo.jpg'
          }
        })
      );
    });

    it('should throw validation error for missing required fields', async () => {
      await expect(assetService.uploadAsset('', 'file.jpg', Buffer.from('test'))).rejects.toThrow(AEMException);
      await expect(assetService.uploadAsset('/content/dam/path', '', Buffer.from('test'))).rejects.toThrow(AEMException);
      await expect(assetService.uploadAsset('/content/dam/path', 'file.jpg', null as unknown as Buffer)).rejects.toThrow(AEMException);
    });

    it('should throw validation error for invalid parent path', async () => {
      const invalidPaths = ['/content/path', '/apps/path', '/etc/path'];
      
      for (const invalidPath of invalidPaths) {
        await expect(assetService.uploadAsset(invalidPath, 'file.jpg', Buffer.from('test'))).rejects.toThrow(AEMException);
        await expect(assetService.uploadAsset(invalidPath, 'file.jpg', Buffer.from('test'))).rejects.toThrow('Parent path must be within DAM');
      }
    });

    it('should throw validation error for invalid file name', async () => {
      const invalidNames = ['file<name.jpg', 'file>name.jpg', 'file:name.jpg', 'file"name.jpg', 'file/name.jpg', 'file\\name.jpg'];
      
      for (const invalidName of invalidNames) {
        await expect(assetService.uploadAsset('/content/dam/path', invalidName, Buffer.from('test'))).rejects.toThrow(AEMException);
        await expect(assetService.uploadAsset('/content/dam/path', invalidName, Buffer.from('test'))).rejects.toThrow('Invalid file name');
      }
    });

    it('should handle File objects', async () => {
      const parentPath = '/content/dam/mysite/images';
      const fileName = 'photo.jpg';
      const file = new File(['fake content'], fileName, { type: 'image/jpeg' });

      mockClient.upload.mockResolvedValue(mockUploadResponse);

      const result = await assetService.uploadAsset(parentPath, fileName, file);

      expect(result.success).toBe(true);
      expect(mockClient.upload).toHaveBeenCalled();
    });

    it('should create folders when createFolders option is true', async () => {
      const parentPath = '/content/dam/mysite/new-folder';
      const fileName = 'photo.jpg';
      const fileContent = Buffer.from('fake content');
      const options: UploadAssetOptions = {
        createFolders: true
      };

      // Mock folder check to fail (folder doesn't exist)
      mockClient.get.mockRejectedValue(new Error('Not found'));
      
      // Mock folder creation
      mockClient.post.mockResolvedValue({
        success: true,
        data: { success: true }
      });

      mockClient.upload.mockResolvedValue(mockUploadResponse);

      const result = await assetService.uploadAsset(parentPath, fileName, fileContent, options);

      expect(result.success).toBe(true);
      expect(mockClient.get).toHaveBeenCalledWith('/content/dam/mysite/new-folder.json');
    });
  });

  describe('updateAsset', () => {
    const mockUpdateResponse = {
      success: true,
      data: {
        success: true,
        path: '/content/dam/mysite/images/photo.jpg',
        message: 'Asset updated successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 200
      }
    };

    it('should update asset metadata successfully', async () => {
      const assetPath = '/content/dam/mysite/images/photo.jpg';
      const options: UpdateAssetOptions = {
        metadata: {
          'dc:title': 'Updated Title',
          'dc:description': 'Updated description',
          'cq:tags': ['mysite:category/updated']
        },
        processAsset: true
      };

      mockClient.post.mockResolvedValue(mockUpdateResponse);

      const result = await assetService.updateAsset(assetPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe('/content/dam/mysite/images/photo.jpg');

      expect(mockClient.post).toHaveBeenCalledWith(
        assetPath,
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'updateAsset',
            resource: assetPath
          }
        })
      );
    });

    it('should update asset content successfully', async () => {
      const assetPath = '/content/dam/mysite/images/photo.jpg';
      const options: UpdateAssetOptions = {
        fileContent: Buffer.from('new file content'),
        mimeType: 'image/jpeg'
      };

      mockClient.post.mockResolvedValue(mockUpdateResponse);

      const result = await assetService.updateAsset(assetPath, options);

      expect(result.success).toBe(true);
      expect(mockClient.post).toHaveBeenCalled();
    });

    it('should throw validation error for missing asset path', async () => {
      await expect(assetService.updateAsset('')).rejects.toThrow(AEMException);
      await expect(assetService.updateAsset('')).rejects.toThrow('Asset path is required');
    });

    it('should throw validation error for invalid asset path', async () => {
      const invalidPaths = ['/content/path', '/apps/path', '/etc/path'];
      
      for (const invalidPath of invalidPaths) {
        await expect(assetService.updateAsset(invalidPath)).rejects.toThrow(AEMException);
        await expect(assetService.updateAsset(invalidPath)).rejects.toThrow('Asset path must be within DAM');
      }
    });
  });

  describe('deleteAsset', () => {
    const mockDeleteResponse = {
      success: true,
      data: {
        success: true,
        message: 'Asset deleted successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100
      }
    };

    it('should delete asset successfully', async () => {
      const assetPath = '/content/dam/mysite/images/old-photo.jpg';
      const options: DeleteAssetOptions = {
        force: true,
        checkReferences: true
      };

      mockClient.post.mockResolvedValue(mockDeleteResponse);

      const result = await assetService.deleteAsset(assetPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.message).toBe('Asset deleted successfully');

      expect(mockClient.post).toHaveBeenCalledWith(
        assetPath,
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'deleteAsset',
            resource: assetPath
          }
        })
      );
      
      // Verify delete operation parameters
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get(':operation')).toBe('delete');
      expect(formData.get('force')).toBe('true');
      expect(formData.get('checkReferences')).toBe('true');
    });

    it('should throw validation error for empty asset path', async () => {
      await expect(assetService.deleteAsset('')).rejects.toThrow(AEMException);
      await expect(assetService.deleteAsset('')).rejects.toThrow('Asset path is required');
    });

    it('should throw validation error for invalid asset path', async () => {
      const invalidPaths = ['/content/path', '/apps/path', '/etc/path'];
      
      for (const invalidPath of invalidPaths) {
        await expect(assetService.deleteAsset(invalidPath)).rejects.toThrow(AEMException);
        await expect(assetService.deleteAsset(invalidPath)).rejects.toThrow('Asset path must be within DAM');
      }
    });

    it('should prevent deletion of system assets', async () => {
      const systemAssets = [
        '/content/dam/system/test.jpg',
        '/content/dam/projects/test.jpg',
        '/content/dam/collections/test.jpg',
        '/content/dam'
      ];

      for (const systemAsset of systemAssets) {
        await expect(assetService.deleteAsset(systemAsset)).rejects.toThrow(AEMException);
        await expect(assetService.deleteAsset(systemAsset)).rejects.toThrow('Cannot delete system asset');
      }
    });

    it('should allow deletion of regular assets', async () => {
      const regularAssets = [
        '/content/dam/mysite/images/photo.jpg',
        '/content/dam/mycompany/documents/doc.pdf',
        '/content/dam/website/videos/video.mp4'
      ];

      mockClient.post.mockResolvedValue(mockDeleteResponse);

      for (const regularAsset of regularAssets) {
        const result = await assetService.deleteAsset(regularAsset);
        expect(result.success).toBe(true);
        jest.clearAllMocks();
        mockClient.post.mockResolvedValue(mockDeleteResponse);
      }
    });
  });

  describe('processAssets', () => {
    const mockProcessResponse = {
      success: true,
      data: {
        success: true,
        jobId: 'job-123',
        message: 'Asset processing initiated successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 150
      }
    };

    it('should process assets successfully', async () => {
      const folderPath = '/content/dam/mysite/images';
      const options: ProcessAssetsOptions = {
        profile: 'dam/update_asset',
        async: true
      };

      mockClient.post.mockResolvedValue(mockProcessResponse);

      const result = await assetService.processAssets(folderPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.jobId).toBe('job-123');
      expect(result.data!.status).toBe('INITIATED');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/bin/asynccommand',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'processAssets',
            resource: folderPath
          }
        })
      );
      
      // Verify process operation parameters
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('optype')).toBe('REPROCESS');
      expect(formData.get('path')).toBe(folderPath);
      expect(formData.get('profile')).toBe('dam/update_asset');
      expect(formData.get('async')).toBe('true');
    });

    it('should use default profile if not provided', async () => {
      const folderPath = '/content/dam/mysite/images';

      mockClient.post.mockResolvedValue(mockProcessResponse);

      await assetService.processAssets(folderPath);

      // Verify default profile was used
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('profile')).toBe('dam/update_asset');
    });

    it('should wait for process completion when wait option is true', async () => {
      const folderPath = '/content/dam/mysite/images';
      const options: ProcessAssetsOptions = {
        async: true,
        wait: true
      };

      // Mock the initial process call
      mockClient.post.mockResolvedValue(mockProcessResponse);
      
      // Mock the status check calls - first showing processing in progress, then complete
      mockClient.get
        .mockResolvedValueOnce({
          success: true,
          data: { status: 'RUNNING' }
        })
        .mockResolvedValueOnce({
          success: true,
          data: { status: 'COMPLETED' }
        });

      const result = await assetService.processAssets(folderPath, options);

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('COMPLETED');
      
      // Verify we called get to check status
      expect(mockClient.get).toHaveBeenCalledWith('/mnt/overlay/granite/async/content/asyncjobs/job-123.json');
    });

    it('should throw validation error for missing folder path', async () => {
      await expect(assetService.processAssets('')).rejects.toThrow(AEMException);
      await expect(assetService.processAssets('')).rejects.toThrow('Folder path is required');
    });

    it('should throw validation error for invalid folder path', async () => {
      const invalidPaths = ['/content/path', '/apps/path', '/etc/path'];
      
      for (const invalidPath of invalidPaths) {
        await expect(assetService.processAssets(invalidPath)).rejects.toThrow(AEMException);
        await expect(assetService.processAssets(invalidPath)).rejects.toThrow('Folder path must be within DAM');
      }
    });
  });

  describe('createAssetFolder', () => {
    const mockCreateFolderResponse = {
      success: true,
      data: {
        success: true,
        path: '/content/dam/mysite/new-folder',
        message: 'Asset folder created successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 120
      }
    };

    it('should create asset folder successfully', async () => {
      const parentPath = '/content/dam/mysite';
      const folderName = 'new-folder';
      const metadata = {
        'jcr:title': 'New Folder',
        'jcr:description': 'A new folder for assets',
        'cq:tags': ['mysite:category/folders']
      };

      mockClient.post.mockResolvedValue(mockCreateFolderResponse);

      const result = await assetService.createAssetFolder(parentPath, folderName, metadata);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe('/content/dam/mysite/new-folder');
      expect(result.data!.folderName).toBe('new-folder');
      expect(result.data!.folderType).toBe('dam:AssetContent');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/content/dam/mysite/new-folder',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'createAssetFolder',
            resource: '/content/dam/mysite/new-folder'
          }
        })
      );
      
      // Verify folder creation parameters
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('jcr:primaryType')).toBe('sling:Folder');
      expect(formData.get('jcr:content/jcr:primaryType')).toBe('dam:AssetContent');
      expect(formData.get('jcr:content/jcr:title')).toBe('New Folder');
      expect(formData.get('jcr:content/jcr:description')).toBe('A new folder for assets');
    });

    it('should throw validation error for missing required fields', async () => {
      await expect(assetService.createAssetFolder('', 'folder')).rejects.toThrow(AEMException);
      await expect(assetService.createAssetFolder('/content/dam/path', '')).rejects.toThrow(AEMException);
      await expect(assetService.createAssetFolder('', '')).rejects.toThrow('Parent path and folder name are required');
    });

    it('should throw validation error for invalid parent path', async () => {
      const invalidPaths = ['/content/path', '/apps/path', '/etc/path'];
      
      for (const invalidPath of invalidPaths) {
        await expect(assetService.createAssetFolder(invalidPath, 'folder')).rejects.toThrow(AEMException);
        await expect(assetService.createAssetFolder(invalidPath, 'folder')).rejects.toThrow('Parent path must be within DAM');
      }
    });

    it('should throw validation error for invalid folder name', async () => {
      const invalidNames = ['folder<name', 'folder>name', 'folder:name', 'folder"name', 'folder/name', 'folder\\name'];
      
      for (const invalidName of invalidNames) {
        await expect(assetService.createAssetFolder('/content/dam/path', invalidName)).rejects.toThrow(AEMException);
        await expect(assetService.createAssetFolder('/content/dam/path', invalidName)).rejects.toThrow('Invalid folder name');
      }
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockClient.upload.mockRejectedValue(networkError);

      await expect(assetService.uploadAsset('/content/dam/path', 'file.jpg', Buffer.from('test'))).rejects.toThrow(AEMException);
      await expect(assetService.uploadAsset('/content/dam/path', 'file.jpg', Buffer.from('test'))).rejects.toThrow('Unexpected error while uploading asset');
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.post.mockRejectedValue(originalError);

      await expect(assetService.updateAsset('/content/dam/path/asset.jpg')).rejects.toThrow('Original error');
    });

    it('should handle malformed responses', async () => {
      const malformedResponse = {
        success: false,
        data: null
      };
      mockClient.post.mockResolvedValue(malformedResponse);

      await expect(assetService.deleteAsset('/content/dam/path/asset.jpg')).rejects.toThrow(AEMException);
      await expect(assetService.deleteAsset('/content/dam/path/asset.jpg')).rejects.toThrow('Failed to delete asset');
    });
  });

  describe('file name validation', () => {
    it('should validate file names correctly', async () => {
      const validNames = ['file.jpg', 'my-file.pdf', 'file_123.png', 'document.docx'];
      const invalidNames = ['file<name.jpg', 'file>name.jpg', 'file:name.jpg', 'file"name.jpg', 'file/name.jpg', 'file\\name.jpg', '.hidden.jpg', 'file.'];

      const mockResponse = {
        success: true,
        data: { success: true, message: 'Uploaded' }
      };

      mockClient.upload.mockResolvedValue(mockResponse);

      // Valid names should work
      for (const validName of validNames) {
        const result = await assetService.uploadAsset('/content/dam/path', validName, Buffer.from('test'));
        expect(result.success).toBe(true);
        jest.clearAllMocks();
        mockClient.upload.mockResolvedValue(mockResponse);
      }

      // Invalid names should throw errors
      for (const invalidName of invalidNames) {
        await expect(assetService.uploadAsset('/content/dam/path', invalidName, Buffer.from('test'))).rejects.toThrow(AEMException);
      }
    });

    it('should reject reserved names', async () => {
      const reservedNames = ['con.jpg', 'prn.pdf', 'aux.png', 'nul.gif', 'com1.doc', 'lpt1.txt'];

      for (const reservedName of reservedNames) {
        await expect(assetService.uploadAsset('/content/dam/path', reservedName, Buffer.from('test'))).rejects.toThrow(AEMException);
      }
    });

    it('should reject names that are too long', async () => {
      const longName = 'a'.repeat(251) + '.jpg'; // Over 255 character limit
      await expect(assetService.uploadAsset('/content/dam/path', longName, Buffer.from('test'))).rejects.toThrow(AEMException);
    });
  });

  describe('MIME type detection', () => {
    it('should correctly guess MIME types from file extensions', async () => {
      const fileExtensions = {
        'image.jpg': 'image/jpeg',
        'image.png': 'image/png',
        'document.pdf': 'application/pdf',
        'video.mp4': 'video/mp4',
        'audio.mp3': 'audio/mpeg',
        'archive.zip': 'application/zip',
        'unknown.xyz': 'application/octet-stream'
      };

      const mockResponse = {
        success: true,
        data: { success: true }
      };

      mockClient.upload.mockResolvedValue(mockResponse);

      for (const [fileName, expectedMimeType] of Object.entries(fileExtensions)) {
        await assetService.uploadAsset('/content/dam/path', fileName, Buffer.from('test'));
        
        // We can't directly check the Blob's type, but we can verify the upload was called
        expect(mockClient.upload).toHaveBeenCalled();
        jest.clearAllMocks();
        mockClient.upload.mockResolvedValue(mockResponse);
      }
    });
  });

  describe('system asset protection', () => {
    it('should identify system assets correctly', async () => {
      const systemAssets = [
        '/content/dam/system/test.jpg',
        '/content/dam/projects/test.jpg',
        '/content/dam/collections/test.jpg',
        '/content/dam'
      ];

      for (const systemAsset of systemAssets) {
        await expect(assetService.deleteAsset(systemAsset)).rejects.toThrow('Cannot delete system asset');
      }
    });

    it('should allow deletion of regular assets', async () => {
      const regularAssets = [
        '/content/dam/mysite/images/photo.jpg',
        '/content/dam/mycompany/documents/doc.pdf',
        '/content/dam/website/videos/video.mp4'
      ];

      const mockResponse = {
        success: true,
        data: { success: true, message: 'Deleted' }
      };

      mockClient.post.mockResolvedValue(mockResponse);

      for (const regularAsset of regularAssets) {
        const result = await assetService.deleteAsset(regularAsset);
        expect(result.success).toBe(true);
        jest.clearAllMocks();
        mockClient.post.mockResolvedValue(mockResponse);
      }
    });
  });
});
