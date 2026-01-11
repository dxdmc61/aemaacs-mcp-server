/**
 * Package Service for AEMaaCS read operations
 * Handles package listing, information retrieval, and status checking
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse, Package } from '@aemaacs-mcp/shared';
export interface PackageInfo extends Package {
    description?: string;
    dependencies?: string[];
    filters?: PackageFilter[];
    screenshots?: string[];
    thumbnail?: string;
    definition?: {
        'jcr:created'?: string;
        'jcr:createdBy'?: string;
        'jcr:lastModified'?: string;
        'jcr:lastModifiedBy'?: string;
        [key: string]: any;
    };
}
export interface PackageFilter {
    root: string;
    rules?: PackageFilterRule[];
}
export interface PackageFilterRule {
    modifier: 'include' | 'exclude';
    pattern: string;
}
export interface PackageStatus {
    path: string;
    installed: boolean;
    installationDate?: Date;
    installedBy?: string;
    installationLog?: string[];
    errors?: string[];
    warnings?: string[];
}
export interface ListPackagesOptions {
    group?: string;
    includeVersions?: boolean;
    includeSnapshots?: boolean;
    orderBy?: 'name' | 'group' | 'version' | 'created' | 'modified';
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}
export declare class PackageService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * List all packages using /crx/packmgr/list.jsp endpoint
     */
    listPackages(options?: ListPackagesOptions): Promise<AEMResponse<Package[]>>;
    /**
     * Get detailed package information
     */
    getPackageInfo(packagePath: string): Promise<AEMResponse<PackageInfo>>;
    /**
     * Get package installation status
     */
    getPackageStatus(packagePath: string): Promise<AEMResponse<PackageStatus>>;
    /**
     * Parse package list response from AEM
     */
    private parsePackageListResponse;
    /**
     * Parse package info response from AEM
     */
    private parsePackageInfoResponse;
    /**
     * Parse package status response from AEM
     */
    private parsePackageStatusResponse;
    /**
     * Map AEM package data to Package interface
     */
    private mapToPackage;
    /**
     * Parse package dependencies
     */
    private parseDependencies;
    /**
     * Parse package filters
     */
    private parseFilters;
    /**
     * Parse filter rules
     */
    private parseFilterRules;
    /**
     * Parse screenshots
     */
    private parseScreenshots;
    /**
     * Parse installation log
     */
    private parseInstallationLog;
    /**
     * Parse log messages (errors/warnings)
     */
    private parseLogMessages;
    /**
     * Sort packages by specified criteria
     */
    private sortPackages;
}
//# sourceMappingURL=package-service.d.ts.map