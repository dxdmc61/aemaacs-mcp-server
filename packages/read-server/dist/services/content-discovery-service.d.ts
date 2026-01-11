/**
 * Content Discovery Service for AEMaaCS read operations
 * Handles page listing, content retrieval, and JCR node traversal
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse, ContentNode, Page } from '@aemaacs-mcp/shared';
export interface ListPagesOptions {
    depth?: number;
    limit?: number;
    offset?: number;
    filter?: string;
    orderBy?: 'title' | 'name' | 'path' | 'modified';
    orderDirection?: 'asc' | 'desc';
}
export interface ListChildrenOptions {
    depth?: number;
    primaryType?: string | string[];
    properties?: string[];
    limit?: number;
    offset?: number;
}
export interface PageContent extends Page {
    components: PageComponent[];
    childPages?: string[];
}
export interface PageComponent {
    path: string;
    resourceType: string;
    properties: Record<string, any>;
    children?: PageComponent[];
}
export interface PageProperties {
    path: string;
    name: string;
    title?: string;
    template?: string;
    created?: Date;
    lastModified?: Date;
    lastPublished?: Date;
    properties: Record<string, any>;
}
export interface NodeContentOptions {
    depth?: number;
    resolveReferences?: boolean;
    includeMetadata?: boolean;
}
export declare class ContentDiscoveryService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * List pages with depth control and pagination
     */
    listPages(rootPath: string, options?: ListPagesOptions): Promise<AEMResponse<Page[]>>;
    /**
     * List children nodes with JCR node traversal
     */
    listChildren(nodePath: string, options?: ListChildrenOptions): Promise<AEMResponse<ContentNode[]>>;
    /**
     * Get complete page content with components
     */
    getPageContent(pagePath: string): Promise<AEMResponse<PageContent>>;
    /**
     * Get page properties and metadata
     */
    getPageProperties(pagePath: string): Promise<AEMResponse<PageProperties>>;
    /**
     * Get node content with depth control
     */
    getNodeContent(nodePath: string, options?: NodeContentOptions): Promise<AEMResponse<ContentNode>>;
    /**
     * Parse page list response from AEM
     */
    private parsePageListResponse;
    /**
     * Parse node list response from AEM
     */
    private parseNodeListResponse;
    /**
     * Parse page content response from AEM
     */
    private parsePageContentResponse;
    /**
     * Parse page properties response from AEM
     */
    private parsePagePropertiesResponse;
    /**
     * Parse node content response from AEM
     */
    private parseNodeContentResponse;
    /**
     * Map AEM page data to Page interface
     */
    private mapToPage;
    /**
     * Map AEM node data to ContentNode interface
     */
    private mapToContentNode;
    /**
     * Extract child nodes from data
     */
    private extractChildNodes;
    /**
     * Extract page components from data
     */
    private extractPageComponents;
    /**
     * Extract child components recursively
     */
    private extractChildComponents;
    /**
     * Extract child pages from data
     */
    private extractChildPages;
    /**
     * Sort pages by specified criteria
     */
    private sortPages;
}
//# sourceMappingURL=content-discovery-service.d.ts.map