/**
 * Search and Query Service for AEMaaCS read operations
 * Handles content search, JCR queries, and asset discovery
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse, Asset, User, Group } from '@aemaacs-mcp/shared';
export interface SearchOptions {
    path?: string;
    type?: string;
    fulltext?: string;
    property?: string;
    propertyValue?: string;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}
export interface SearchResult {
    path: string;
    name: string;
    title?: string;
    resourceType?: string;
    lastModified?: Date;
    score?: number;
    excerpt?: string;
    properties: Record<string, any>;
}
export interface SearchResponse {
    total: number;
    results: SearchResult[];
    facets?: Record<string, any>;
    spellcheck?: string[];
}
export interface JCRQueryOptions {
    type: 'xpath' | 'sql2' | 'jcr-sql2';
    statement: string;
    limit?: number;
    offset?: number;
}
export interface JCRQueryResult {
    path: string;
    score?: number;
    properties: Record<string, any>;
}
export interface EnhancedSearchOptions extends SearchOptions {
    fuzzy?: boolean;
    synonyms?: boolean;
    facets?: string[];
    filters?: Record<string, any>;
    boost?: Record<string, number>;
}
export interface AssetSearchOptions {
    path?: string;
    mimeType?: string;
    tags?: string[];
    metadata?: Record<string, any>;
    dateRange?: {
        from?: Date;
        to?: Date;
    };
    limit?: number;
    offset?: number;
}
export interface UserSearchOptions {
    query?: string;
    group?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
}
export interface GroupSearchOptions {
    query?: string;
    parentGroup?: string;
    limit?: number;
    offset?: number;
}
export declare class SearchQueryService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Search content using QueryBuilder API
     */
    searchContent(options?: SearchOptions): Promise<AEMResponse<SearchResponse>>;
    /**
     * Execute JCR query with security validation
     */
    executeJCRQuery(queryOptions: JCRQueryOptions): Promise<AEMResponse<JCRQueryResult[]>>;
    /**
     * Enhanced page search with fallback strategies
     */
    enhancedPageSearch(options: EnhancedSearchOptions): Promise<AEMResponse<SearchResponse>>;
    /**
     * Search assets in DAM
     */
    searchAssets(options?: AssetSearchOptions): Promise<AEMResponse<Asset[]>>;
    /**
     * Search users
     */
    searchUsers(options?: UserSearchOptions): Promise<AEMResponse<User[]>>;
    /**
     * Search groups
     */
    searchGroups(options?: GroupSearchOptions): Promise<AEMResponse<Group[]>>;
    /**
     * Validate JCR query for security
     */
    private validateJCRQuery;
    /**
     * Parse search response from QueryBuilder
     */
    private parseSearchResponse;
    /**
     * Parse JCR query response
     */
    private parseJCRQueryResponse;
    /**
     * Parse asset search response
     */
    private parseAssetSearchResponse;
    /**
     * Parse user search response
     */
    private parseUserSearchResponse;
    /**
     * Parse group search response
     */
    private parseGroupSearchResponse;
    /**
     * Parse renditions from asset data
     */
    private parseRenditions;
    /**
     * Advanced QueryBuilder search with full parameter support
     */
    advancedSearch(options?: EnhancedSearchOptions): Promise<AEMResponse<SearchResponse>>;
    /**
     * Search content fragments with advanced filtering
     */
    searchContentFragments(options?: ContentFragmentSearchOptions): Promise<AEMResponse<SearchResponse>>;
    /**
     * Get search suggestions based on query
     */
    getSearchSuggestions(query: string, options?: SearchSuggestionOptions): Promise<AEMResponse<SearchSuggestion[]>>;
    /**
     * Get search facets for filtering
     */
    getSearchFacets(options?: SearchFacetOptions): Promise<AEMResponse<SearchFacet[]>>;
    /**
     * Build advanced query parameters
     */
    private buildAdvancedQueryParams;
    /**
     * Parse advanced search response with facets
     */
    private parseAdvancedSearchResponse;
    /**
     * Parse search suggestions
     */
    private parseSearchSuggestions;
    /**
     * Parse search facets
     */
    private parseSearchFacets;
}
export interface ContentFragmentSearchOptions extends SearchOptions {
    model?: string;
    variation?: string;
    elements?: string[];
    elementValues?: string[];
}
export interface SearchSuggestionOptions {
    path?: string;
    type?: string;
    limit?: number;
}
export interface SearchSuggestion {
    text: string;
    type: string;
    count: number;
    path?: string;
}
export interface SearchFacetOptions {
    path?: string;
    type?: string;
    facets?: string[];
}
export interface SearchFacet {
    name: string;
    values: Array<{
        value: string;
        count: number;
    }>;
}
//# sourceMappingURL=search-query-service.d.ts.map