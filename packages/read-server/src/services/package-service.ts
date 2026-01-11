/**
 * Package Service for AEMaaCS read operations
 * Handles package listing, information retrieval, and status checking
 */

import { AEMHttpClient, RequestOptions } from '@aemaacs-mcp/shared';
import { AEMResponse, Package, ErrorType } from '@aemaacs-mcp/shared';
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

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

export class PackageService {
    private client: AEMHttpClient;
    private logger: Logger;

    constructor(client: AEMHttpClient) {
        this.client = client;
        this.logger = Logger.getInstance();
    }

    /**
     * List all packages using /crx/packmgr/list.jsp endpoint
     */
    async listPackages(options: ListPackagesOptions = {}): Promise<AEMResponse<Package[]>> {
        try {
            this.logger.debug('Listing packages', { options });

            const params: Record<string, any> = {};

            if (options.group) {
                params.group = options.group;
            }

            if (options.includeVersions !== undefined) {
                params.includeVersions = options.includeVersions;
            }

            if (options.includeSnapshots !== undefined) {
                params.includeSnapshots = options.includeSnapshots;
            }

            const requestOptions: RequestOptions = {
                cache: true,
                cacheTtl: 60000, // Cache for 1 minute
                context: {
                    operation: 'listPackages',
                    resource: '/crx/packmgr/list.jsp'
                }
            };

            const response = await this.client.get<any>('/crx/packmgr/list.jsp', params, requestOptions);

            if (!response.success || !response.data) {
                throw new AEMException(
                    'Failed to retrieve package list',
                    'SERVER_ERROR',
                    true,
                    undefined,
                    { response }
                );
            }

            // Parse the package list response
            const packages = this.parsePackageListResponse(response.data);

            // Apply client-side filtering and sorting
            let filteredPackages = packages;

            if (options.orderBy) {
                filteredPackages = this.sortPackages(filteredPackages, options.orderBy, options.orderDirection);
            }

            if (options.limit || options.offset) {
                const start = options.offset || 0;
                const end = options.limit ? start + options.limit : undefined;
                filteredPackages = filteredPackages.slice(start, end);
            }

            this.logger.debug('Successfully listed packages', {
                count: filteredPackages.length,
                totalCount: packages.length
            });

            return {
                success: true,
                data: filteredPackages,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };

        } catch (error) {
            this.logger.error('Failed to list packages', error as Error);

            if (error instanceof AEMException) {
                throw error;
            }

            throw new AEMException(
                'Unexpected error while listing packages',
                'UNKNOWN_ERROR',
                false,
                undefined,
                { originalError: error }
            );
        }
    }

    /**
     * Get detailed package information
     */
    async getPackageInfo(packagePath: string): Promise<AEMResponse<PackageInfo>> {
        try {
            this.logger.debug('Getting package info', { packagePath });

            if (!packagePath) {
                throw new AEMException(
                    'Package path is required',
                    'VALIDATION_ERROR',
                    false
                );
            }

            const requestOptions: RequestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'getPackageInfo',
                    resource: packagePath
                }
            };

            // Get package details from the package manager
            const response = await this.client.get<any>(
                `/crx/packmgr/service/.json${packagePath}`,
                undefined,
                requestOptions
            );

            if (!response.success || !response.data) {
                throw new AEMException(
                    `Package not found: ${packagePath}`,
                    'NOT_FOUND_ERROR',
                    false,
                    undefined,
                    { packagePath }
                );
            }

            const packageInfo = this.parsePackageInfoResponse(response.data, packagePath);

            this.logger.debug('Successfully retrieved package info', {
                packagePath,
                name: packageInfo.name,
                version: packageInfo.version
            });

            return {
                success: true,
                data: packageInfo,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };

        } catch (error) {
            this.logger.error('Failed to get package info', error as Error, { packagePath });

            if (error instanceof AEMException) {
                throw error;
            }

            throw new AEMException(
                `Unexpected error while getting package info for ${packagePath}`,
                'UNKNOWN_ERROR',
                false,
                undefined,
                { originalError: error, packagePath }
            );
        }
    }

    /**
     * Get package installation status
     */
    async getPackageStatus(packagePath: string): Promise<AEMResponse<PackageStatus>> {
        try {
            this.logger.debug('Getting package status', { packagePath });

            if (!packagePath) {
                throw new AEMException(
                    'Package path is required',
                    'VALIDATION_ERROR',
                    false
                );
            }

            const requestOptions: RequestOptions = {
                cache: true,
                cacheTtl: 30000, // Cache for 30 seconds (status changes more frequently)
                context: {
                    operation: 'getPackageStatus',
                    resource: packagePath
                }
            };

            // Get package status from the package manager
            const response = await this.client.get<any>(
                `/crx/packmgr/service/.json${packagePath}`,
                { cmd: 'status' },
                requestOptions
            );

            if (!response.success || !response.data) {
                throw new AEMException(
                    `Package status not available: ${packagePath}`,
                    'NOT_FOUND_ERROR',
                    false,
                    undefined,
                    { packagePath }
                );
            }

            const packageStatus = this.parsePackageStatusResponse(response.data, packagePath);

            this.logger.debug('Successfully retrieved package status', {
                packagePath,
                installed: packageStatus.installed
            });

            return {
                success: true,
                data: packageStatus,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };

        } catch (error) {
            this.logger.error('Failed to get package status', error as Error, { packagePath });

            if (error instanceof AEMException) {
                throw error;
            }

            throw new AEMException(
                `Unexpected error while getting package status for ${packagePath}`,
                'UNKNOWN_ERROR',
                false,
                undefined,
                { originalError: error, packagePath }
            );
        }
    }

    /**
     * Parse package list response from AEM
     */
    private parsePackageListResponse(data: any): Package[] {
        try {
            // Handle different response formats from AEM package manager
            let packages: any[] = [];

            if (data.results && Array.isArray(data.results)) {
                packages = data.results;
            } else if (Array.isArray(data)) {
                packages = data;
            } else if (data.packages && Array.isArray(data.packages)) {
                packages = data.packages;
            } else {
                this.logger.warn('Unexpected package list response format', { data });
                return [];
            }

            return packages.map(pkg => this.mapToPackage(pkg)).filter(Boolean) as Package[];
        } catch (error) {
            this.logger.error('Failed to parse package list response', error as Error, { data });
            return [];
        }
    }

    /**
     * Parse package info response from AEM
     */
    private parsePackageInfoResponse(data: any, packagePath: string): PackageInfo {
        try {
            const basePackage = this.mapToPackage(data);
            if (!basePackage) {
                throw new Error('Invalid package data');
            }

            const packageInfo: PackageInfo = {
                ...basePackage,
                description: data.description || data.jcr?.description,
                dependencies: this.parseDependencies(data.dependencies),
                filters: this.parseFilters(data.filter || data.filters),
                screenshots: this.parseScreenshots(data.screenshots),
                thumbnail: data.thumbnail,
                definition: data.definition || data.jcr
            };

            return packageInfo;
        } catch (error) {
            this.logger.error('Failed to parse package info response', error as Error, { data, packagePath });
            throw new Error(`Invalid package info response for ${packagePath}`);
        }
    }

    /**
     * Parse package status response from AEM
     */
    private parsePackageStatusResponse(data: any, packagePath: string): PackageStatus {
        try {
            const status: PackageStatus = {
                path: packagePath,
                installed: Boolean(data.installed || data.status === 'installed'),
                installationDate: data.installTime ? new Date(data.installTime) : undefined,
                installedBy: data.installedBy || data.installUser,
                installationLog: this.parseInstallationLog(data.log || data.installLog),
                errors: this.parseLogMessages(data.errors || data.error),
                warnings: this.parseLogMessages(data.warnings || data.warning)
            };

            return status;
        } catch (error) {
            this.logger.error('Failed to parse package status response', error as Error, { data, packagePath });
            throw new Error(`Invalid package status response for ${packagePath}`);
        }
    }

    /**
     * Map AEM package data to Package interface
     */
    private mapToPackage(data: any): Package | null {
        try {
            if (!data || !data.name) {
                return null;
            }

            return {
                name: data.name,
                group: data.group || 'default',
                version: data.version || '1.0.0',
                path: data.path || `/etc/packages/${data.group || 'default'}/${data.name}-${data.version || '1.0.0'}.zip`,
                size: parseInt(data.size) || 0,
                created: data.created ? new Date(data.created) : new Date(),
                lastModified: data.lastModified ? new Date(data.lastModified) : new Date(),
                installed: Boolean(data.installed),
                builtWith: data.builtWith || data.buildCount
            };
        } catch (error) {
            this.logger.error('Failed to map package data', error as Error, { data });
            return null;
        }
    }

    /**
     * Parse package dependencies
     */
    private parseDependencies(dependencies: any): string[] {
        if (!dependencies) return [];

        if (Array.isArray(dependencies)) {
            return dependencies.map(dep => typeof dep === 'string' ? dep : dep.name || dep.id).filter(Boolean);
        }

        if (typeof dependencies === 'string') {
            return [dependencies];
        }

        return [];
    }

    /**
     * Parse package filters
     */
    private parseFilters(filters: any): PackageFilter[] {
        if (!filters) return [];

        if (Array.isArray(filters)) {
            return filters.map(filter => ({
                root: filter.root || filter.path || '/',
                rules: this.parseFilterRules(filter.rules)
            }));
        }

        return [];
    }

    /**
     * Parse filter rules
     */
    private parseFilterRules(rules: any): PackageFilterRule[] {
        if (!rules || !Array.isArray(rules)) return [];

        return rules.map(rule => ({
            modifier: rule.modifier === 'exclude' ? 'exclude' : 'include',
            pattern: rule.pattern || rule.path || '*'
        }));
    }

    /**
     * Parse screenshots
     */
    private parseScreenshots(screenshots: any): string[] {
        if (!screenshots) return [];

        if (Array.isArray(screenshots)) {
            return screenshots.filter(Boolean);
        }

        if (typeof screenshots === 'string') {
            return [screenshots];
        }

        return [];
    }

    /**
     * Parse installation log
     */
    private parseInstallationLog(log: any): string[] {
        if (!log) return [];

        if (Array.isArray(log)) {
            return log.map(entry => typeof entry === 'string' ? entry : JSON.stringify(entry));
        }

        if (typeof log === 'string') {
            return log.split('\n').filter(Boolean);
        }

        return [];
    }

    /**
     * Parse log messages (errors/warnings)
     */
    private parseLogMessages(messages: any): string[] {
        if (!messages) return [];

        if (Array.isArray(messages)) {
            return messages.map(msg => typeof msg === 'string' ? msg : msg.message || JSON.stringify(msg));
        }

        if (typeof messages === 'string') {
            return [messages];
        }

        if (typeof messages === 'object' && messages.message) {
            return [messages.message];
        }

        return [];
    }

    /**
     * Sort packages by specified criteria
     */
    private sortPackages(packages: Package[], orderBy: string, direction: 'asc' | 'desc' = 'asc'): Package[] {
        return packages.sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (orderBy) {
                case 'name':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'group':
                    aValue = a.group.toLowerCase();
                    bValue = b.group.toLowerCase();
                    break;
                case 'version':
                    aValue = a.version;
                    bValue = b.version;
                    break;
                case 'created':
                    aValue = a.created.getTime();
                    bValue = b.created.getTime();
                    break;
                case 'modified':
                    aValue = a.lastModified.getTime();
                    bValue = b.lastModified.getTime();
                    break;
                default:
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
            }

            if (aValue < bValue) {
                return direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }
}
