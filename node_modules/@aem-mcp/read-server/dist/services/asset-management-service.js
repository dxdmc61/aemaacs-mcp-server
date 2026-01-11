/**
 * Asset Management Service for AEMaaCS read operations
 * Handles asset metadata retrieval, listing, renditions, references, and versions
 */
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';
export class AssetManagementService {
    constructor(client) {
        this.client = client;
        this.logger = Logger.getInstance();
    }
    /**
     * Get comprehensive asset metadata
     */
    async getAssetMetadata(assetPath) {
        try {
            this.logger.debug('Getting asset metadata', { assetPath });
            if (!assetPath) {
                throw new AEMException('Asset path is required', 'VALIDATION_ERROR', false);
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'getAssetMetadata',
                    resource: assetPath
                }
            };
            // Get asset metadata
            const response = await this.client.get(`${assetPath}/jcr:content/metadata.json`, undefined, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Asset not found: ${assetPath}`, 'NOT_FOUND_ERROR', false, undefined, { assetPath });
            }
            const metadata = this.parseAssetMetadata(response.data);
            this.logger.debug('Successfully retrieved asset metadata', {
                assetPath,
                mimeType: metadata['dam:MIMEtype']
            });
            return {
                success: true,
                data: metadata,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get asset metadata', error, { assetPath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting asset metadata for ${assetPath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, assetPath });
        }
    }
    /**
     * List assets with filtering and pagination
     */
    async listAssets(options = {}) {
        try {
            this.logger.debug('Listing assets', { options });
            const params = {
                'path': options.path || '/content/dam',
                'type': 'dam:Asset',
                'p.limit': options.limit || 50,
                'p.offset': options.offset || 0
            };
            // Add MIME type filter
            if (options.mimeType) {
                params['property'] = 'jcr:content/metadata/dc:format';
                params['property.value'] = options.mimeType;
            }
            // Add tag filters
            if (options.tags && options.tags.length > 0) {
                params['tagid'] = options.tags;
            }
            // Add ordering
            if (options.orderBy) {
                switch (options.orderBy) {
                    case 'name':
                        params['orderby'] = '@jcr:name';
                        break;
                    case 'modified':
                        params['orderby'] = '@jcr:lastModified';
                        break;
                    case 'created':
                        params['orderby'] = '@jcr:created';
                        break;
                    case 'size':
                        params['orderby'] = 'jcr:content/metadata/@dam:size';
                        break;
                }
                if (options.orderDirection) {
                    params['orderby.sort'] = options.orderDirection;
                }
            }
            // Include subfolders
            if (options.includeSubfolders !== false) {
                params['path.flat'] = 'false';
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 180000, // Cache for 3 minutes
                context: {
                    operation: 'listAssets',
                    resource: options.path || '/content/dam'
                }
            };
            const response = await this.client.get('/bin/querybuilder.json', params, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to list assets', 'SERVER_ERROR', true, undefined, { response });
            }
            const assets = this.parseAssetListResponse(response.data);
            this.logger.debug('Successfully listed assets', {
                assetCount: assets.length,
                path: options.path
            });
            return {
                success: true,
                data: assets,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to list assets', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while listing assets', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * Get asset renditions
     */
    async getAssetRenditions(assetPath) {
        try {
            this.logger.debug('Getting asset renditions', { assetPath });
            if (!assetPath) {
                throw new AEMException('Asset path is required', 'VALIDATION_ERROR', false);
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'getAssetRenditions',
                    resource: assetPath
                }
            };
            // Get asset renditions
            const response = await this.client.get(`${assetPath}/jcr:content/renditions.json`, undefined, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Asset renditions not found: ${assetPath}`, 'NOT_FOUND_ERROR', false, undefined, { assetPath });
            }
            const renditions = this.parseRenditionsResponse(response.data, assetPath);
            this.logger.debug('Successfully retrieved asset renditions', {
                assetPath,
                renditionCount: renditions.length
            });
            return {
                success: true,
                data: renditions,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get asset renditions', error, { assetPath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting asset renditions for ${assetPath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, assetPath });
        }
    }
    /**
     * Get asset references for usage tracking
     */
    async getAssetReferences(assetPath) {
        try {
            this.logger.debug('Getting asset references', { assetPath });
            if (!assetPath) {
                throw new AEMException('Asset path is required', 'VALIDATION_ERROR', false);
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 180000, // Cache for 3 minutes
                context: {
                    operation: 'getAssetReferences',
                    resource: assetPath
                }
            };
            // Search for references to this asset
            const params = {
                'property': 'fileReference',
                'property.value': assetPath,
                'p.limit': 100
            };
            const response = await this.client.get('/bin/querybuilder.json', params, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to get asset references for ${assetPath}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const references = this.parseAssetReferencesResponse(response.data, assetPath);
            this.logger.debug('Successfully retrieved asset references', {
                assetPath,
                referenceCount: references.totalReferences
            });
            return {
                success: true,
                data: references,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get asset references', error, { assetPath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting asset references for ${assetPath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, assetPath });
        }
    }
    /**
     * Get asset version history
     */
    async getAssetVersions(assetPath) {
        try {
            this.logger.debug('Getting asset versions', { assetPath });
            if (!assetPath) {
                throw new AEMException('Asset path is required', 'VALIDATION_ERROR', false);
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'getAssetVersions',
                    resource: assetPath
                }
            };
            // Get version history
            const response = await this.client.get(`${assetPath}.versions.json`, undefined, requestOptions);
            if (!response.success || !response.data) {
                // Asset might not have versions, return empty history
                const emptyHistory = {
                    assetPath,
                    currentVersion: '1.0',
                    totalVersions: 0,
                    versions: []
                };
                return {
                    success: true,
                    data: emptyHistory,
                    metadata: {
                        timestamp: new Date(),
                        requestId: response.metadata?.requestId || '',
                        duration: response.metadata?.duration || 0,
                        cached: response.metadata?.cached
                    }
                };
            }
            const versionHistory = this.parseVersionHistoryResponse(response.data, assetPath);
            this.logger.debug('Successfully retrieved asset versions', {
                assetPath,
                versionCount: versionHistory.totalVersions
            });
            return {
                success: true,
                data: versionHistory,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get asset versions', error, { assetPath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting asset versions for ${assetPath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, assetPath });
        }
    }
    /**
     * Parse asset metadata response
     */
    parseAssetMetadata(data) {
        return {
            width: data['tiff:ImageWidth'] ? parseInt(data['tiff:ImageWidth']) : undefined,
            height: data['tiff:ImageLength'] ? parseInt(data['tiff:ImageLength']) : undefined,
            format: data['dc:format'],
            colorSpace: data['tiff:PhotometricInterpretation'],
            'dc:title': data['dc:title'],
            'dc:description': data['dc:description'],
            'dc:creator': data['dc:creator'],
            'dc:subject': Array.isArray(data['dc:subject']) ? data['dc:subject'] : (data['dc:subject'] ? [data['dc:subject']] : undefined),
            'dam:size': data['dam:size'] ? parseInt(data['dam:size']) : undefined,
            'dam:sha1': data['dam:sha1'],
            'dam:MIMEtype': data['dam:MIMEtype'],
            'tiff:ImageWidth': data['tiff:ImageWidth'] ? parseInt(data['tiff:ImageWidth']) : undefined,
            'tiff:ImageLength': data['tiff:ImageLength'] ? parseInt(data['tiff:ImageLength']) : undefined,
            'tiff:BitsPerSample': data['tiff:BitsPerSample'] ? parseInt(data['tiff:BitsPerSample']) : undefined,
            'tiff:PhotometricInterpretation': data['tiff:PhotometricInterpretation'],
            'exif:DateTimeOriginal': data['exif:DateTimeOriginal'],
            'exif:ExposureTime': data['exif:ExposureTime'],
            'exif:FNumber': data['exif:FNumber'],
            'exif:ISOSpeedRatings': data['exif:ISOSpeedRatings'] ? parseInt(data['exif:ISOSpeedRatings']) : undefined,
            'xmp:CreatorTool': data['xmp:CreatorTool'],
            'xmp:CreateDate': data['xmp:CreateDate'],
            'xmp:ModifyDate': data['xmp:ModifyDate'],
            ...data
        };
    }
    /**
     * Parse asset list response
     */
    parseAssetListResponse(data) {
        const hits = data.hits || [];
        return hits.map((hit) => {
            const metadata = hit['jcr:content']?.metadata || {};
            return {
                path: hit.path,
                name: hit.name || hit.path.split('/').pop() || '',
                primaryType: hit['jcr:primaryType'] || 'dam:Asset',
                title: metadata['dc:title'] || hit.name,
                lastModified: hit['jcr:lastModified'] ? new Date(hit['jcr:lastModified']) : new Date(),
                properties: { ...hit },
                mimeType: metadata['dc:format'] || metadata['dam:MIMEtype'] || 'application/octet-stream',
                size: parseInt(metadata['dam:size']) || 0,
                metadata: this.parseAssetMetadata(metadata),
                renditions: this.parseRenditionsFromHit(hit)
            };
        });
    }
    /**
     * Parse renditions response
     */
    parseRenditionsResponse(data, assetPath) {
        const renditions = [];
        // Skip known properties that aren't renditions
        const skipProps = ['jcr:primaryType', 'jcr:mixinTypes', 'jcr:created', 'jcr:createdBy'];
        for (const key of Object.keys(data)) {
            if (skipProps.includes(key))
                continue;
            const rendition = data[key];
            if (rendition && typeof rendition === 'object') {
                const metadata = rendition.metadata || {};
                renditions.push({
                    name: key,
                    path: `${assetPath}/jcr:content/renditions/${key}`,
                    width: metadata['tiff:ImageWidth'] ? parseInt(metadata['tiff:ImageWidth']) : undefined,
                    height: metadata['tiff:ImageLength'] ? parseInt(metadata['tiff:ImageLength']) : undefined,
                    size: parseInt(metadata['dam:size']) || 0,
                    mimeType: metadata['dc:format'] || metadata['dam:MIMEtype'] || 'application/octet-stream'
                });
            }
        }
        return renditions;
    }
    /**
     * Parse renditions from search hit
     */
    parseRenditionsFromHit(hit) {
        const renditionsData = hit['jcr:content']?.renditions;
        if (!renditionsData)
            return [];
        const renditions = [];
        const skipProps = ['jcr:primaryType', 'jcr:mixinTypes'];
        for (const key of Object.keys(renditionsData)) {
            if (skipProps.includes(key))
                continue;
            const rendition = renditionsData[key];
            if (rendition && typeof rendition === 'object') {
                const metadata = rendition.metadata || {};
                renditions.push({
                    name: key,
                    path: `${hit.path}/jcr:content/renditions/${key}`,
                    width: metadata['tiff:ImageWidth'] ? parseInt(metadata['tiff:ImageWidth']) : undefined,
                    height: metadata['tiff:ImageLength'] ? parseInt(metadata['tiff:ImageLength']) : undefined,
                    size: parseInt(metadata['dam:size']) || 0,
                    mimeType: metadata['dc:format'] || metadata['dam:MIMEtype'] || 'application/octet-stream'
                });
            }
        }
        return renditions;
    }
    /**
     * Parse asset references response
     */
    parseAssetReferencesResponse(data, assetPath) {
        const hits = data.hits || [];
        const references = [];
        for (const hit of hits) {
            references.push({
                referencingPath: hit.path,
                referencingType: hit['jcr:primaryType'] || 'unknown',
                referenceType: 'direct',
                context: hit['sling:resourceType']
            });
        }
        return {
            assetPath,
            totalReferences: references.length,
            references
        };
    }
    /**
     * Parse version history response
     */
    parseVersionHistoryResponse(data, assetPath) {
        const versions = [];
        let currentVersion = '1.0';
        // Parse version data structure
        if (data.versions && typeof data.versions === 'object') {
            for (const [versionName, versionData] of Object.entries(data.versions)) {
                if (typeof versionData === 'object' && versionData !== null) {
                    const version = versionData;
                    versions.push({
                        versionName,
                        versionPath: `${assetPath}/jcr:versions/${versionName}`,
                        created: version['jcr:created'] ? new Date(version['jcr:created']) : new Date(),
                        createdBy: version['jcr:createdBy'] || 'unknown',
                        comment: version['jcr:comment'],
                        labels: version['jcr:versionLabels'] || []
                    });
                }
            }
        }
        // Sort versions by creation date (newest first)
        versions.sort((a, b) => b.created.getTime() - a.created.getTime());
        // Set current version to the latest
        if (versions.length > 0) {
            currentVersion = versions[0].versionName;
        }
        return {
            assetPath,
            currentVersion,
            totalVersions: versions.length,
            versions
        };
    }
}
//# sourceMappingURL=asset-management-service.js.map