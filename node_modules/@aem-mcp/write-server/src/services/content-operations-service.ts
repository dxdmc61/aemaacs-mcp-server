/**
 * Content Operations Service for AEMaaCS write operations
 * Handles content creation, folder operations, file uploads, and property management
 */

import { AEMHttpClient, RequestOptions } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

export interface CreateFolderOptions {
  primaryType?: string;
  title?: string;
  description?: string;
  ordered?: boolean;
  properties?: Record<string, any>;
}

export interface CopyFolderOptions {
  recursive?: boolean;
  overwrite?: boolean;
  preserveProperties?: boolean;
}

export interface UploadFileOptions {
  mimeType?: string;
  overwrite?: boolean;
  properties?: Record<string, any>;
}

export interface UpdatePropertiesOptions {
  merge?: boolean;
  removeExisting?: boolean;
}

export interface DeleteContentOptions {
  force?: boolean;
  recursive?: boolean;
}

export interface ReindexOptions {
  async?: boolean;
  reindexDefinitions?: string[];
}

export interface ContentOperationResult {
  success: boolean;
  path?: string;
  message?: string;
  warnings?: string[];
  errors?: string[];
}

export interface FolderResult extends ContentOperationResult {
  folderType?: string;
  childCount?: number;
}

export interface FileResult extends ContentOperationResult {
  fileName?: string;
  mimeType?: string;
  size?: number;
}

export interface PropertyResult extends ContentOperationResult {
  updatedProperties?: string[];
  removedProperties?: string[];
}

export interface ReindexResult extends ContentOperationResult {
  jobId?: string;
  indexedPaths?: string[];
  status?: string;
}

export class ContentOperationsService {
  private client: AEMHttpClient;
  private logger: Logger;

  constructor(client: AEMHttpClient) {
    this.client = client;
    this.logger = Logger.getInstance();
  }

  /**
   * Create a folder in the JCR repository
   */
  async createFolder(
    parentPath: string,
    folderName: string,
    options: CreateFolderOptions = {}
  ): Promise<AEMResponse<FolderResult>> {
    try {
      this.logger.debug('Creating folder', { parentPath, folderName, options });

      if (!parentPath || !folderName) {
        throw new AEMException(
          'Parent path and folder name are required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Validate folder name
      if (!this.isValidNodeName(folderName)) {
        throw new AEMException(
          'Invalid folder name. Names must not contain special characters',
          'VALIDATION_ERROR',
          false
        );
      }

      const folderPath = `${parentPath}/${folderName}`;
      const formData = new FormData();
      
      // Set primary type
      const primaryType = options.primaryType || 'sling:Folder';
      formData.append('jcr:primaryType', primaryType);
      
      // Add title and description
      if (options.title) {
        formData.append('jcr:title', options.title);
      }
      if (options.description) {
        formData.append('jcr:description', options.description);
      }

      // Add custom properties
      if (options.properties) {
        for (const [key, value] of Object.entries(options.properties)) {
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach((item, index) => {
                formData.append(`${key}[${index}]`, item.toString());
              });
            } else {
              formData.append(key, value.toString());
            }
          }
        }
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'createFolder',
          resource: folderPath
        }
      };

      const response = await this.client.post<any>(
        folderPath,
        formData as any,
        requestOptions
      );

      if (!response.success) {
        throw new AEMException(
          `Failed to create folder: ${folderName}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result: FolderResult = {
        success: true,
        path: folderPath,
        folderType: primaryType,
        message: `Folder ${folderName} created successfully`
      };

      this.logger.debug('Successfully created folder', { folderPath, primaryType });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to create folder', error as Error, { parentPath, folderName });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while creating folder: ${folderName}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, parentPath, folderName }
      );
    }
  }

  /**
   * Create an ordered folder (sling:OrderedFolder)
   */
  async createOrderedFolder(
    parentPath: string,
    folderName: string,
    options: Omit<CreateFolderOptions, 'primaryType'> = {}
  ): Promise<AEMResponse<FolderResult>> {
    return this.createFolder(parentPath, folderName, {
      ...options,
      primaryType: 'sling:OrderedFolder'
    });
  }

  /**
   * Copy folder with recursive support
   */
  async copyFolder(
    sourcePath: string,
    destinationPath: string,
    options: CopyFolderOptions = {}
  ): Promise<AEMResponse<ContentOperationResult>> {
    try {
      this.logger.debug('Copying folder', { sourcePath, destinationPath, options });

      if (!sourcePath || !destinationPath) {
        throw new AEMException(
          'Source path and destination path are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append(':operation', 'copy');
      formData.append(':dest', destinationPath);
      
      if (options.recursive !== undefined) {
        formData.append(':deep', options.recursive.toString());
      }
      if (options.overwrite !== undefined) {
        formData.append(':replace', options.overwrite.toString());
      }
      if (options.preserveProperties !== undefined) {
        formData.append(':saveParamPrefix', options.preserveProperties.toString());
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'copyFolder',
          resource: sourcePath
        }
      };

      const response = await this.client.post<any>(
        sourcePath,
        formData as any,
        requestOptions
      );

      if (!response.success) {
        throw new AEMException(
          `Failed to copy folder from ${sourcePath} to ${destinationPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result: ContentOperationResult = {
        success: true,
        path: destinationPath,
        message: `Folder copied from ${sourcePath} to ${destinationPath} successfully`
      };

      this.logger.debug('Successfully copied folder', { sourcePath, destinationPath });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to copy folder', error as Error, { sourcePath, destinationPath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while copying folder from ${sourcePath} to ${destinationPath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, sourcePath, destinationPath }
      );
    }
  }

  /**
   * Upload file with MIME type detection
   */
  async uploadFile(
    parentPath: string,
    fileName: string,
    fileContent: Buffer | Uint8Array,
    options: UploadFileOptions = {}
  ): Promise<AEMResponse<FileResult>> {
    try {
      this.logger.debug('Uploading file', { parentPath, fileName, options });

      if (!parentPath || !fileName || !fileContent) {
        throw new AEMException(
          'Parent path, file name, and file content are required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Validate file name
      if (!this.isValidNodeName(fileName)) {
        throw new AEMException(
          'Invalid file name. Names must not contain special characters',
          'VALIDATION_ERROR',
          false
        );
      }

      const filePath = `${parentPath}/${fileName}`;
      const mimeType = options.mimeType || this.detectMimeType(fileName);
      
      const formData = new FormData();
      
      // Create blob from buffer/array
      const blob = new Blob([fileContent], { type: mimeType });
      formData.append('file', blob, fileName);
      
      // Set file properties
      formData.append('jcr:primaryType', 'nt:file');
      formData.append('jcr:content/jcr:primaryType', 'nt:resource');
      formData.append('jcr:content/jcr:mimeType', mimeType);
      
      if (options.overwrite !== undefined) {
        formData.append(':replace', options.overwrite.toString());
      }

      // Add custom properties
      if (options.properties) {
        for (const [key, value] of Object.entries(options.properties)) {
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach((item, index) => {
                formData.append(`jcr:content/${key}[${index}]`, item.toString());
              });
            } else {
              formData.append(`jcr:content/${key}`, value.toString());
            }
          }
        }
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'uploadFile',
          resource: filePath
        }
      };

      const response = await this.client.post<any>(
        filePath,
        formData as any,
        requestOptions
      );

      if (!response.success) {
        throw new AEMException(
          `Failed to upload file: ${fileName}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result: FileResult = {
        success: true,
        path: filePath,
        fileName,
        mimeType,
        size: fileContent.length,
        message: `File ${fileName} uploaded successfully`
      };

      this.logger.debug('Successfully uploaded file', { filePath, mimeType, size: fileContent.length });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to upload file', error as Error, { parentPath, fileName });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while uploading file: ${fileName}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, parentPath, fileName }
      );
    }
  }

  /**
   * Update JCR properties for content nodes
   */
  async updateProperties(
    nodePath: string,
    properties: Record<string, any>,
    options: UpdatePropertiesOptions = {}
  ): Promise<AEMResponse<PropertyResult>> {
    try {
      this.logger.debug('Updating properties', { nodePath, properties, options });

      if (!nodePath || !properties) {
        throw new AEMException(
          'Node path and properties are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      const updatedProperties: string[] = [];
      
      // Add properties to update
      for (const [key, value] of Object.entries(properties)) {
        if (value !== null && value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach((item, index) => {
              formData.append(`${key}[${index}]`, item.toString());
            });
          } else if (typeof value === 'boolean') {
            formData.append(key, value.toString());
          } else if (typeof value === 'number') {
            formData.append(key, value.toString());
          } else {
            formData.append(key, value.toString());
          }
          updatedProperties.push(key);
        }
      }

      // Handle property removal
      const removedProperties: string[] = [];
      if (options.removeExisting) {
        // Get existing properties first
        try {
          const existingResponse = await this.client.get<any>(`${nodePath}.json`);
          if (existingResponse.success && existingResponse.data) {
            for (const existingKey of Object.keys(existingResponse.data)) {
              if (!properties.hasOwnProperty(existingKey) && !existingKey.startsWith('jcr:') && !existingKey.startsWith('sling:')) {
                formData.append(`${existingKey}@Delete`, '');
                removedProperties.push(existingKey);
              }
            }
          }
        } catch (error) {
          this.logger.warn('Could not retrieve existing properties for removal', error as Error);
        }
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'updateProperties',
          resource: nodePath
        }
      };

      const response = await this.client.post<any>(
        nodePath,
        formData as any,
        requestOptions
      );

      if (!response.success) {
        throw new AEMException(
          `Failed to update properties for: ${nodePath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result: PropertyResult = {
        success: true,
        path: nodePath,
        updatedProperties,
        removedProperties,
        message: `Properties updated successfully for ${nodePath}`
      };

      this.logger.debug('Successfully updated properties', { 
        nodePath, 
        updatedCount: updatedProperties.length,
        removedCount: removedProperties.length
      });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to update properties', error as Error, { nodePath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while updating properties for: ${nodePath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, nodePath }
      );
    }
  }

  /**
   * Delete content with safety checks
   */
  async deleteContent(
    contentPath: string,
    options: DeleteContentOptions = {}
  ): Promise<AEMResponse<ContentOperationResult>> {
    try {
      this.logger.debug('Deleting content', { contentPath, options });

      if (!contentPath) {
        throw new AEMException(
          'Content path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Safety check: prevent deletion of system paths
      if (this.isSystemPath(contentPath)) {
        throw new AEMException(
          `Cannot delete system path: ${contentPath}`,
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append(':operation', 'delete');
      
      if (options.force !== undefined) {
        formData.append('force', options.force.toString());
      }
      if (options.recursive !== undefined) {
        formData.append(':applyTo', options.recursive ? 'tree' : 'single');
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'deleteContent',
          resource: contentPath
        }
      };

      const response = await this.client.post<any>(
        contentPath,
        formData as any,
        requestOptions
      );

      if (!response.success) {
        throw new AEMException(
          `Failed to delete content: ${contentPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result: ContentOperationResult = {
        success: true,
        path: contentPath,
        message: `Content ${contentPath} deleted successfully`
      };

      this.logger.debug('Successfully deleted content', { contentPath });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to delete content', error as Error, { contentPath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while deleting content: ${contentPath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, contentPath }
      );
    }
  }

  /**
   * Reindex content for search index management
   */
  async reindexContent(
    contentPath: string,
    options: ReindexOptions = {}
  ): Promise<AEMResponse<ReindexResult>> {
    try {
      this.logger.debug('Reindexing content', { contentPath, options });

      if (!contentPath) {
        throw new AEMException(
          'Content path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('path', contentPath);
      formData.append('cmd', 'reindex');
      
      if (options.async !== undefined) {
        formData.append('async', options.async.toString());
      }
      
      if (options.reindexDefinitions && options.reindexDefinitions.length > 0) {
        options.reindexDefinitions.forEach((def, index) => {
          formData.append(`reindexDefinitions[${index}]`, def);
        });
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'reindexContent',
          resource: contentPath
        }
      };

      const response = await this.client.post<any>(
        '/system/console/jmx/org.apache.jackrabbit.oak%3Aname%3DLucene%20Index%2Ctype%3DLuceneIndex/op/reindex',
        formData as any,
        requestOptions
      );

      if (!response.success) {
        throw new AEMException(
          `Failed to reindex content: ${contentPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result: ReindexResult = {
        success: true,
        path: contentPath,
        jobId: response.data?.jobId,
        indexedPaths: [contentPath],
        status: options.async ? 'INITIATED' : 'COMPLETED',
        message: `Reindexing ${options.async ? 'initiated' : 'completed'} for ${contentPath}`
      };

      this.logger.debug('Successfully initiated reindexing', { 
        contentPath, 
        async: options.async,
        jobId: result.jobId
      });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to reindex content', error as Error, { contentPath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while reindexing content: ${contentPath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, contentPath }
      );
    }
  }

  /**
   * Validate JCR node name
   */
  private isValidNodeName(name: string): boolean {
    // JCR node name restrictions
    const invalidChars = /[\/\[\]:|*]/;
    const reservedNames = ['.', '..'];
    
    return !invalidChars.test(name) && 
           !reservedNames.includes(name) &&
           name.length > 0 &&
           name.length <= 150 &&
           !name.startsWith(' ') &&
           !name.endsWith(' ');
  }

  /**
   * Check if path is a system path that should not be deleted
   */
  private isSystemPath(path: string): boolean {
    const systemPaths = [
      '/apps',
      '/libs',
      '/system',
      '/etc/designs',
      '/etc/clientlibs',
      '/etc/workflow',
      '/etc/replication',
      '/var/audit',
      '/var/eventing',
      '/var/replication',
      '/tmp'
    ];

    return systemPaths.some(systemPath => path.startsWith(systemPath)) ||
           path === '/' ||
           path === '/content' ||
           path === '/etc' ||
           path === '/var';
  }

  /**
   * Detect MIME type from file extension
   */
  private detectMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      // Images
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'tiff': 'image/tiff',
      'tif': 'image/tiff',
      'ico': 'image/x-icon',
      
      // Documents
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'odt': 'application/vnd.oasis.opendocument.text',
      'ods': 'application/vnd.oasis.opendocument.spreadsheet',
      'odp': 'application/vnd.oasis.opendocument.presentation',
      
      // Text
      'txt': 'text/plain',
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'csv': 'text/csv',
      'rtf': 'application/rtf',
      
      // Archives
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
      'tar': 'application/x-tar',
      'gz': 'application/gzip',
      
      // Audio
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'flac': 'audio/flac',
      'aac': 'audio/aac',
      'ogg': 'audio/ogg',
      'm4a': 'audio/mp4',
      
      // Video
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'wmv': 'video/x-ms-wmv',
      'flv': 'video/x-flv',
      'webm': 'video/webm',
      'mkv': 'video/x-matroska',
      '3gp': 'video/3gpp',
      
      // Fonts
      'ttf': 'font/ttf',
      'otf': 'font/otf',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'eot': 'application/vnd.ms-fontobject'
    };
    
    return extension && mimeTypes[extension] ? mimeTypes[extension] : 'application/octet-stream';
  }
}
