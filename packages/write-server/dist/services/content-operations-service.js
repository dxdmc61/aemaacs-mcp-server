/**
 * Content Operations Service for AEMaaCS write operations
 * Handles content creation, folder operations, file uploads, and property management
 */
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';
export class ContentOperationsService {
    constructor(client) {
        this.client = client;
        this.logger = Logger.getInstance();
    }
    /**
     * Create a folder in the JCR repository
     */
    async createFolder(parentPath, folderName, options = {}) {
        try {
            this.logger.debug('Creating folder', { parentPath, folderName, options });
            if (!parentPath || !folderName) {
                throw new AEMException('Parent path and folder name are required', 'VALIDATION_ERROR', false);
            }
            // Validate folder name
            if (!this.isValidNodeName(folderName)) {
                throw new AEMException('Invalid folder name. Names must not contain special characters', 'VALIDATION_ERROR', false);
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
                        }
                        else {
                            formData.append(key, value.toString());
                        }
                    }
                }
            }
            const requestOptions = {
                context: {
                    operation: 'createFolder',
                    resource: folderPath
                }
            };
            const response = await this.client.post(folderPath, formData, requestOptions);
            if (!response.success) {
                throw new AEMException(`Failed to create folder: ${folderName}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const result = {
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
        }
        catch (error) {
            this.logger.error('Failed to create folder', error, { parentPath, folderName });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while creating folder: ${folderName}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, parentPath, folderName });
        }
    }
    /**
     * Create an ordered folder (sling:OrderedFolder)
     */
    async createOrderedFolder(parentPath, folderName, options = {}) {
        return this.createFolder(parentPath, folderName, {
            ...options,
            primaryType: 'sling:OrderedFolder'
        });
    }
    /**
     * Copy folder with recursive support
     */
    async copyFolder(sourcePath, destinationPath, options = {}) {
        try {
            this.logger.debug('Copying folder', { sourcePath, destinationPath, options });
            if (!sourcePath || !destinationPath) {
                throw new AEMException('Source path and destination path are required', 'VALIDATION_ERROR', false);
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
            const requestOptions = {
                context: {
                    operation: 'copyFolder',
                    resource: sourcePath
                }
            };
            const response = await this.client.post(sourcePath, formData, requestOptions);
            if (!response.success) {
                throw new AEMException(`Failed to copy folder from ${sourcePath} to ${destinationPath}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const result = {
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
        }
        catch (error) {
            this.logger.error('Failed to copy folder', error, { sourcePath, destinationPath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while copying folder from ${sourcePath} to ${destinationPath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, sourcePath, destinationPath });
        }
    }
    /**
     * Upload file with MIME type detection
     */
    async uploadFile(parentPath, fileName, fileContent, options = {}) {
        try {
            this.logger.debug('Uploading file', { parentPath, fileName, options });
            if (!parentPath || !fileName || !fileContent) {
                throw new AEMException('Parent path, file name, and file content are required', 'VALIDATION_ERROR', false);
            }
            // Validate file name
            if (!this.isValidNodeName(fileName)) {
                throw new AEMException('Invalid file name. Names must not contain special characters', 'VALIDATION_ERROR', false);
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
                        }
                        else {
                            formData.append(`jcr:content/${key}`, value.toString());
                        }
                    }
                }
            }
            const requestOptions = {
                context: {
                    operation: 'uploadFile',
                    resource: filePath
                }
            };
            const response = await this.client.post(filePath, formData, requestOptions);
            if (!response.success) {
                throw new AEMException(`Failed to upload file: ${fileName}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const result = {
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
        }
        catch (error) {
            this.logger.error('Failed to upload file', error, { parentPath, fileName });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while uploading file: ${fileName}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, parentPath, fileName });
        }
    }
    /**
     * Update JCR properties for content nodes
     */
    async updateProperties(nodePath, properties, options = {}) {
        try {
            this.logger.debug('Updating properties', { nodePath, properties, options });
            if (!nodePath || !properties) {
                throw new AEMException('Node path and properties are required', 'VALIDATION_ERROR', false);
            }
            const formData = new FormData();
            const updatedProperties = [];
            // Add properties to update
            for (const [key, value] of Object.entries(properties)) {
                if (value !== null && value !== undefined) {
                    if (Array.isArray(value)) {
                        value.forEach((item, index) => {
                            formData.append(`${key}[${index}]`, item.toString());
                        });
                    }
                    else if (typeof value === 'boolean') {
                        formData.append(key, value.toString());
                    }
                    else if (typeof value === 'number') {
                        formData.append(key, value.toString());
                    }
                    else {
                        formData.append(key, value.toString());
                    }
                    updatedProperties.push(key);
                }
            }
            // Handle property removal
            const removedProperties = [];
            if (options.removeExisting) {
                // Get existing properties first
                try {
                    const existingResponse = await this.client.get(`${nodePath}.json`);
                    if (existingResponse.success && existingResponse.data) {
                        for (const existingKey of Object.keys(existingResponse.data)) {
                            if (!properties.hasOwnProperty(existingKey) && !existingKey.startsWith('jcr:') && !existingKey.startsWith('sling:')) {
                                formData.append(`${existingKey}@Delete`, '');
                                removedProperties.push(existingKey);
                            }
                        }
                    }
                }
                catch (error) {
                    this.logger.warn('Could not retrieve existing properties for removal', error);
                }
            }
            const requestOptions = {
                context: {
                    operation: 'updateProperties',
                    resource: nodePath
                }
            };
            const response = await this.client.post(nodePath, formData, requestOptions);
            if (!response.success) {
                throw new AEMException(`Failed to update properties for: ${nodePath}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const result = {
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
        }
        catch (error) {
            this.logger.error('Failed to update properties', error, { nodePath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while updating properties for: ${nodePath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, nodePath });
        }
    }
    /**
     * Delete content with safety checks
     */
    async deleteContent(contentPath, options = {}) {
        try {
            this.logger.debug('Deleting content', { contentPath, options });
            if (!contentPath) {
                throw new AEMException('Content path is required', 'VALIDATION_ERROR', false);
            }
            // Safety check: prevent deletion of system paths
            if (this.isSystemPath(contentPath)) {
                throw new AEMException(`Cannot delete system path: ${contentPath}`, 'VALIDATION_ERROR', false);
            }
            const formData = new FormData();
            formData.append(':operation', 'delete');
            if (options.force !== undefined) {
                formData.append('force', options.force.toString());
            }
            if (options.recursive !== undefined) {
                formData.append(':applyTo', options.recursive ? 'tree' : 'single');
            }
            const requestOptions = {
                context: {
                    operation: 'deleteContent',
                    resource: contentPath
                }
            };
            const response = await this.client.post(contentPath, formData, requestOptions);
            if (!response.success) {
                throw new AEMException(`Failed to delete content: ${contentPath}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const result = {
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
        }
        catch (error) {
            this.logger.error('Failed to delete content', error, { contentPath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while deleting content: ${contentPath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, contentPath });
        }
    }
    /**
     * Reindex content for search index management
     */
    async reindexContent(contentPath, options = {}) {
        try {
            this.logger.debug('Reindexing content', { contentPath, options });
            if (!contentPath) {
                throw new AEMException('Content path is required', 'VALIDATION_ERROR', false);
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
            const requestOptions = {
                context: {
                    operation: 'reindexContent',
                    resource: contentPath
                }
            };
            const response = await this.client.post('/system/console/jmx/org.apache.jackrabbit.oak%3Aname%3DLucene%20Index%2Ctype%3DLuceneIndex/op/reindex', formData, requestOptions);
            if (!response.success) {
                throw new AEMException(`Failed to reindex content: ${contentPath}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const result = {
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
        }
        catch (error) {
            this.logger.error('Failed to reindex content', error, { contentPath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while reindexing content: ${contentPath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, contentPath });
        }
    }
    /**
     * Validate JCR node name
     */
    isValidNodeName(name) {
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
    isSystemPath(path) {
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
    detectMimeType(fileName) {
        const extension = fileName.split('.').pop()?.toLowerCase();
        const mimeTypes = {
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
//# sourceMappingURL=content-operations-service.js.map