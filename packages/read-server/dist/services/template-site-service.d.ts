/**
 * Template and Site Service for AEMaaCS read operations
 * Handles site discovery, template management, and locale operations
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
export interface Site {
    path: string;
    name: string;
    title?: string;
    description?: string;
    rootPath: string;
    languageMaster?: string;
    locales: string[];
    templates: string[];
    created?: Date;
    lastModified?: Date;
    properties: Record<string, any>;
}
export interface LanguageMaster {
    path: string;
    locale: string;
    title?: string;
    isDefault: boolean;
    languageCopies: LanguageCopy[];
}
export interface LanguageCopy {
    path: string;
    locale: string;
    title?: string;
    status: 'synced' | 'out-of-sync' | 'never-synced';
    lastSyncDate?: Date;
}
export interface Locale {
    code: string;
    language: string;
    country?: string;
    displayName: string;
    available: boolean;
    path?: string;
}
export interface Template {
    path: string;
    name: string;
    title?: string;
    description?: string;
    resourceType?: string;
    allowedPaths?: string[];
    allowedParents?: string[];
    allowedChildren?: string[];
    ranking?: number;
    status: 'enabled' | 'disabled';
    created?: Date;
    lastModified?: Date;
    thumbnail?: string;
    properties: Record<string, any>;
}
export interface TemplateStructure {
    template: Template;
    structure: TemplateComponent[];
    policies: TemplatePolicy[];
    initialContent?: TemplateComponent[];
}
export interface TemplateComponent {
    path: string;
    resourceType: string;
    title?: string;
    description?: string;
    properties: Record<string, any>;
    children?: TemplateComponent[];
}
export interface TemplatePolicy {
    path: string;
    resourceType: string;
    title?: string;
    properties: Record<string, any>;
}
export declare class TemplateSiteService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Fetch sites for site discovery
     */
    fetchSites(): Promise<AEMResponse<Site[]>>;
    /**
     * Fetch language masters for multilingual sites
     */
    fetchLanguageMasters(sitePath: string): Promise<AEMResponse<LanguageMaster[]>>;
    /**
     * Fetch available locales for locale management
     */
    fetchAvailableLocales(): Promise<AEMResponse<Locale[]>>;
    /**
     * Get templates for template discovery
     */
    getTemplates(): Promise<AEMResponse<Template[]>>;
    /**
     * Get template structure for detailed template analysis
     */
    getTemplateStructure(templatePath: string): Promise<AEMResponse<TemplateStructure>>;
    /**
     * Parse sites response
     */
    private parseSitesResponse;
    /**
     * Parse language masters response
     */
    private parseLanguageMastersResponse;
    /**
     * Find language copies
     */
    private findLanguageCopies;
    /**
     * Parse locales response
     */
    private parseLocalesResponse;
    /**
     * Parse templates response
     */
    private parseTemplatesResponse;
    /**
     * Parse template structure response
     */
    private parseTemplateStructureResponse;
    /**
     * Map data to Site
     */
    private mapToSite;
    /**
     * Map data to Template
     */
    private mapToTemplate;
    /**
     * Extract template components
     */
    private extractTemplateComponents;
    /**
     * Extract template policies
     */
    private extractTemplatePolicies;
    /**
     * Get fallback locales
     */
    private getFallbackLocales;
}
//# sourceMappingURL=template-site-service.d.ts.map