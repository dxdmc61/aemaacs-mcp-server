/**
 * Content Operations Service for AEMaaCS write operations
 * Handles content creation, folder operations, file uploads, and property management
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
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
export declare class ContentOperationsService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Create a folder in the JCR repository
     */
    createFolder(parentPath: string, folderName: string, options?: CreateFolderOptions): Promise<AEMResponse<FolderResult>>;
    /**
     * Create an ordered folder (sling:OrderedFolder)
     */
    createOrderedFolder(parentPath: string, folderName: string, options?: Omit<CreateFolderOptions, 'primaryType'>): Promise<AEMResponse<FolderResult>>;
    /**
     * Copy folder with recursive support
     */
    copyFolder(sourcePath: string, destinationPath: string, options?: CopyFolderOptions): Promise<AEMResponse<ContentOperationResult>>;
    /**
     * Upload file with MIME type detection
     */
    uploadFile(parentPath: string, fileName: string, fileContent: Buffer | Uint8Array, options?: UploadFileOptions): Promise<AEMResponse<FileResult>>;
    /**
     * Update JCR properties for content nodes
     */
    updateProperties(nodePath: string, properties: Record<string, any>, options?: UpdatePropertiesOptions): Promise<AEMResponse<PropertyResult>>;
    /**
     * Delete content with safety checks
     */
    deleteContent(contentPath: string, options?: DeleteContentOptions): Promise<AEMResponse<ContentOperationResult>>;
    /**
     * Reindex content for search index management
     */
    reindexContent(contentPath: string, options?: ReindexOptions): Promise<AEMResponse<ReindexResult>>;
    /**
     * Validate JCR node name
     */
    private isValidNodeName;
    /**
     * Check if path is a system path that should not be deleted
     */
    private isSystemPath;
    /**
     * Detect MIME type from file extension
     */
    private detectMimeType;
}
//# sourceMappingURL=content-operations-service.d.ts.map