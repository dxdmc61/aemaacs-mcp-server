/**
 * Component Analysis Service for AEMaaCS read operations
 * Handles component discovery, text extraction, and image reference extraction
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { ContentDiscoveryService } from './content-discovery-service.js';
export interface ComponentInfo {
    path: string;
    resourceType: string;
    properties: Record<string, any>;
}
export interface PageComponentAnalysis {
    pagePath: string;
    pageTitle?: string;
    template?: string;
    componentCount: number;
    components: ComponentInfo[];
}
export interface TextContent {
    path: string;
    text: string;
    resourceType?: string;
    context?: string;
}
export interface PageTextContent {
    pagePath: string;
    pageTitle?: string;
    totalTextLength: number;
    textItems: TextContent[];
}
export interface ImageReference {
    path: string;
    resourceType: string;
    fileReference?: string;
    alt?: string;
    title?: string;
    width?: number;
    height?: number;
    renditions?: string[];
}
export interface PageImages {
    pagePath: string;
    pageTitle?: string;
    imageCount: number;
    images: ImageReference[];
}
export declare class ComponentAnalysisService {
    private client;
    private logger;
    private contentDiscoveryService;
    constructor(client: AEMHttpClient, contentDiscoveryService?: ContentDiscoveryService);
    /**
     * Scan page components for discovery
     */
    scanPageComponents(pagePath: string): Promise<AEMResponse<PageComponentAnalysis>>;
    /**
     * Get all text content from multiple pages
     */
    getAllTextContent(pagePaths: string[]): Promise<AEMResponse<PageTextContent[]>>;
    /**
     * Get page-specific text content
     */
    getPageTextContent(pagePath: string): Promise<AEMResponse<PageTextContent>>;
    /**
     * Get page images and image references
     */
    getPageImages(pagePath: string): Promise<AEMResponse<PageImages>>;
    /**
     * Extract components recursively
     */
    private extractComponentsRecursively;
    /**
     * Extract text from components
     */
    private extractTextFromComponents;
    /**
     * Extract text from a single component
     */
    private extractTextFromComponent;
    /**
     * Extract images from components
     */
    private extractImagesFromComponents;
    /**
     * Extract image from a single component
     */
    private extractImageFromComponent;
    /**
     * Extract renditions from component properties
     */
    private extractRenditions;
    /**
     * Strip HTML tags from text
     */
    private stripHtml;
}
//# sourceMappingURL=component-analysis-service.d.ts.map