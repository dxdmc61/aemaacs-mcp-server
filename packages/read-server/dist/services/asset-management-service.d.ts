/**
 * Asset Management Service for AEMaaCS read operations
 * Handles asset metadata retrieval, listing, renditions, references, and versions
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse, Asset, AssetMetadata, Rendition } from '@aemaacs-mcp/shared';
export interface AssetMetadataExtended extends AssetMetadata {
    'dc:title'?: string;
    'dc:description'?: string;
    'dc:creator'?: string;
    'dc:subject'?: string[];
    'dam:size'?: number;
    'dam:sha1'?: string;
    'dam:MIMEtype'?: string;
    'tiff:ImageWidth'?: number;
    'tiff:ImageLength'?: number;
    'tiff:BitsPerSample'?: number;
    'tiff:PhotometricInterpretation'?: string;
    'exif:DateTimeOriginal'?: string;
    'exif:ExposureTime'?: string;
    'exif:FNumber'?: string;
    'exif:ISOSpeedRatings'?: number;
    'xmp:CreatorTool'?: string;
    'xmp:CreateDate'?: string;
    'xmp:ModifyDate'?: string;
    [key: string]: any;
}
export interface ListAssetsOptions {
    path?: string;
    mimeType?: string;
    tags?: string[];
    orderBy?: 'name' | 'modified' | 'created' | 'size';
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
    includeSubfolders?: boolean;
}
export interface AssetReference {
    referencingPath: string;
    referencingType: string;
    referenceType: 'direct' | 'indirect';
    context?: string;
}
export interface AssetReferences {
    assetPath: string;
    totalReferences: number;
    references: AssetReference[];
}
export interface AssetVersion {
    versionName: string;
    versionPath: string;
    created: Date;
    createdBy: string;
    comment?: string;
    labels?: string[];
}
export interface AssetVersionHistory {
    assetPath: string;
    currentVersion: string;
    totalVersions: number;
    versions: AssetVersion[];
}
export declare class AssetManagementService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Get comprehensive asset metadata
     */
    getAssetMetadata(assetPath: string): Promise<AEMResponse<AssetMetadataExtended>>;
    /**
     * List assets with filtering and pagination
     */
    listAssets(options?: ListAssetsOptions): Promise<AEMResponse<Asset[]>>;
    /**
     * Get asset renditions
     */
    getAssetRenditions(assetPath: string): Promise<AEMResponse<Rendition[]>>;
    /**
     * Get asset references for usage tracking
     */
    getAssetReferences(assetPath: string): Promise<AEMResponse<AssetReferences>>;
    /**
     * Get asset version history
     */
    getAssetVersions(assetPath: string): Promise<AEMResponse<AssetVersionHistory>>;
    /**
     * Parse asset metadata response
     */
    private parseAssetMetadata;
    /**
     * Parse asset list response
     */
    private parseAssetListResponse;
    /**
     * Parse renditions response
     */
    private parseRenditionsResponse;
    /**
     * Parse renditions from search hit
     */
    private parseRenditionsFromHit;
    /**
     * Parse asset references response
     */
    private parseAssetReferencesResponse;
    /**
     * Parse version history response
     */
    private parseVersionHistoryResponse;
}
//# sourceMappingURL=asset-management-service.d.ts.map