/**
 * Tag Management Service for AEMaaCS read operations
 * Handles tag namespace discovery, tag hierarchy, and tagged content discovery
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse, Tag } from '@aemaacs-mcp/shared';
export interface TagNamespace {
    id: string;
    path: string;
    title: string;
    description?: string;
    created?: Date;
    lastModified?: Date;
    tagCount?: number;
}
export interface TagDetails extends Tag {
    created?: Date;
    lastModified?: Date;
    translations?: Record<string, TagTranslation>;
    usageCount?: number;
    childCount?: number;
}
export interface TagTranslation {
    title: string;
    description?: string;
    locale: string;
}
export interface TaggedContent {
    path: string;
    title?: string;
    resourceType?: string;
    tags: string[];
    lastModified?: Date;
}
export interface TaggedContentResponse {
    tagId: string;
    tagTitle?: string;
    totalContent: number;
    content: TaggedContent[];
}
export interface TagHierarchy {
    rootNamespace: string;
    totalTags: number;
    maxDepth: number;
    tags: TagHierarchyNode[];
}
export interface TagHierarchyNode extends Tag {
    level: number;
    hasChildren: boolean;
    childCount: number;
    children?: TagHierarchyNode[];
}
export interface ListTagsOptions {
    namespace?: string;
    parentTag?: string;
    includeChildren?: boolean;
    maxDepth?: number;
    orderBy?: 'title' | 'id' | 'created' | 'modified';
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}
export interface ListTaggedContentOptions {
    contentType?: string;
    path?: string;
    includeSubpaths?: boolean;
    orderBy?: 'title' | 'path' | 'modified';
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}
export declare class TagManagementService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * List tag namespaces
     */
    listTagNamespaces(): Promise<AEMResponse<TagNamespace[]>>;
    /**
     * List tags with hierarchy support
     */
    listTags(options?: ListTagsOptions): Promise<AEMResponse<TagDetails[]>>;
    /**
     * Get tag details with properties and translations
     */
    getTagDetails(tagId: string): Promise<AEMResponse<TagDetails>>;
    /**
     * Get content tagged with specific tags
     */
    getTaggedContent(tagId: string, options?: ListTaggedContentOptions): Promise<AEMResponse<TaggedContentResponse>>;
    /**
     * Get complete tag hierarchy
     */
    getTagHierarchy(namespace: string): Promise<AEMResponse<TagHierarchy>>;
    /**
     * Parse tag namespaces response
     */
    private parseTagNamespacesResponse;
    /**
     * Parse tag list response
     */
    private parseTagListResponse;
    /**
     * Parse tag details response
     */
    private parseTagDetailsResponse;
    /**
     * Parse tagged content response
     */
    private parseTaggedContentResponse;
    /**
     * Parse tag hierarchy response
     */
    private parseTagHierarchyResponse;
    /**
     * Process tag hierarchy node recursively
     */
    private processTagHierarchyNode;
    /**
     * Map data to TagDetails
     */
    private mapToTagDetails;
    /**
     * Parse tag translations
     */
    private parseTagTranslations;
    /**
     * Count child tags
     */
    private countChildTags;
    /**
     * Extract child tags
     */
    private extractChildTags;
    /**
     * Sort tags by specified criteria
     */
    private sortTags;
}
//# sourceMappingURL=tag-management-service.d.ts.map