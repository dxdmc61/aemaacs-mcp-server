/**
 * Asset Management Service for AEMaaCS write operations
 * Handles asset uploads, updates, deletion, processing, and DAM folder management
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
export interface AssetMetadata {
    'dc:title'?: string;
    'dc:description'?: string;
    'dc:subject'?: string[];
    'dc:creator'?: string;
    'dc:contributor'?: string[];
    'dc:rights'?: string;
    'dc:language'?: string;
    'cq:tags'?: string[];
    'dam:assetState'?: string;
    [key: string]: any;
}
export interface UploadAssetOptions {
    metadata?: AssetMetadata;
    overwrite?: boolean;
    createFolders?: boolean;
    processAsset?: boolean;
}
export interface UpdateAssetOptions {
    metadata?: AssetMetadata;
    fileContent?: Buffer;
    mimeType?: string;
    processAsset?: boolean;
}
export interface DeleteAssetOptions {
    force?: boolean;
    checkReferences?: boolean;
}
export interface ProcessAssetsOptions {
    profile?: string;
    async?: boolean;
    wait?: boolean;
}
export interface AssetOperationResult {
    success: boolean;
    path?: string;
    assetId?: string;
    message?: string;
    warnings?: string[];
    errors?: string[];
}
export interface UploadResult extends AssetOperationResult {
    fileName?: string;
    mimeType?: string;
    size?: number;
    renditions?: string[];
}
export interface ProcessResult extends AssetOperationResult {
    jobId?: string;
    status?: string;
    processedAssets?: number;
    failedAssets?: number;
}
export interface FolderResult extends AssetOperationResult {
    folderName?: string;
    folderType?: string;
}
export declare class AssetManagementService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Upload asset with metadata support
     */
    uploadAsset(parentPath: string, fileName: string, fileContent: Buffer | File, options?: UploadAssetOptions): Promise<AEMResponse<UploadResult>>;
    /**
     * Update asset metadata and content
     */
    updateAsset(assetPath: string, options?: UpdateAssetOptions): Promise<AEMResponse<AssetOperationResult>>;
    /**
     * Delete asset with safety checks
     */
    deleteAsset(assetPath: string, options?: DeleteAssetOptions): Promise<AEMResponse<AssetOperationResult>>;
    /**
     * Process assets for bulk asset processing
     */
    processAssets(folderPath: string, options?: ProcessAssetsOptions): Promise<AEMResponse<ProcessResult>>;
    /**
     * Create asset folder for DAM organization
     */
    createAssetFolder(parentPath: string, folderName: string, metadata?: Record<string, any>): Promise<AEMResponse<FolderResult>>;
    /**
     * Parse asset operation response
     */
    private parseAssetOperationResponse;
    /**
     * Parse upload response
     */
    private parseUploadResponse;
    /**
     * Parse process response
     */
    private parseProcessResponse;
    /**
     * Parse folder response
     */
    private parseFolderResponse;
    /**
     * Validate file name
     */
    private isValidFileName;
    /**
     * Validate folder name
     */
    private isValidFolderName;
    /**
     * Check if asset is a system asset that should not be deleted
     */
    private isSystemAsset;
    /**
     * Guess MIME type from file name
     */
    private guessMimeType;
    /**
     * Ensure folder exists, creating parent folders as needed
     */
    private ensureFolderExists;
    /**
     * Wait for process completion
     */
    private waitForProcessCompletion;
    /**
     * Get asset processing status
     */
    getAssetProcessingStatus(assetPath: string): Promise<AEMResponse<AssetProcessingStatus>>;
    /**
     * Create custom rendition
     */
    createCustomRendition(assetPath: string, renditionOptions: CreateCustomRenditionOptions): Promise<AEMResponse<CustomRendition>>;
    /**
     * Apply smart crop to asset
     */
    applySmartCrop(assetPath: string, smartCropOptions: SmartCropOptions): Promise<AEMResponse<SmartCropResult>>;
    /**
     * Process video asset
     */
    processVideoAsset(assetPath: string, videoOptions?: ProcessVideoOptions): Promise<AEMResponse<VideoProcessResult>>;
    /**
     * Parse asset processing status response
     */
    private parseAssetProcessingStatus;
    /**
     * Parse custom rendition response
     */
    private parseCustomRenditionResponse;
    /**
     * Parse smart crop response
     */
    private parseSmartCropResponse;
    /**
     * Parse video process response
     */
    private parseVideoProcessResponse;
}
export interface AssetProcessingStatus {
    assetPath: string;
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PENDING' | 'UNKNOWN';
    processingSteps: string[];
    lastProcessed?: Date;
    errorMessage?: string;
    processingTime: number;
    renditionsGenerated: number;
}
export interface CreateCustomRenditionOptions {
    name: string;
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
}
export interface CustomRendition {
    name: string;
    path: string;
    width?: number;
    height?: number;
    size: number;
    mimeType: string;
    quality?: number;
    format?: string;
    created: Date;
}
export interface SmartCropOptions {
    width: number;
    height: number;
    algorithm?: 'face-detection' | 'saliency' | 'center-weighted';
    renditionName?: string;
    quality?: number;
}
export interface SmartCropResult {
    assetPath: string;
    renditionName: string;
    renditionPath: string;
    width: number;
    height: number;
    cropCoordinates?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    algorithm: string;
    confidence?: number;
    created: Date;
}
export interface ProcessVideoOptions {
    generateThumbnails?: boolean;
    thumbnailCount?: number;
    generatePreview?: boolean;
    previewQuality?: number;
    extractMetadata?: boolean;
}
export interface VideoProcessResult {
    assetPath: string;
    thumbnailCount: number;
    thumbnails: Array<{
        name: string;
        path: string;
        timestamp: number;
        width: number;
        height: number;
    }>;
    previewGenerated: boolean;
    previewPath?: string;
    metadataExtracted: boolean;
    duration?: number;
    bitrate?: number;
    resolution?: string;
    processingTime: number;
    created: Date;
}
//# sourceMappingURL=asset-management-service.d.ts.map