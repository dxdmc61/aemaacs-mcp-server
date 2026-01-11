/**
 * Package Service for AEMaaCS write operations
 * Handles package creation, installation, upload, modification, and deletion
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
export interface CreatePackageOptions {
    groupName: string;
    packageName: string;
    version?: string;
    description?: string;
    acHandling?: 'ignore' | 'overwrite' | 'merge' | 'merge_preserve' | 'clear';
    cqVersion?: string;
    requiresRoot?: boolean;
    dependencies?: string[];
    filters?: PackageFilter[];
    properties?: Record<string, any>;
}
export interface PackageFilter {
    root: string;
    rules?: FilterRule[];
}
export interface FilterRule {
    modifier: 'include' | 'exclude';
    pattern: string;
}
export interface InstallPackageOptions {
    recursive?: boolean;
    autosave?: number;
    acHandling?: 'ignore' | 'overwrite' | 'merge' | 'merge_preserve' | 'clear';
    cqVersion?: string;
    strict?: boolean;
}
export interface UploadPackageOptions {
    force?: boolean;
    install?: boolean;
    installOptions?: InstallPackageOptions;
}
export interface ModifyPackageOptions {
    description?: string;
    acHandling?: 'ignore' | 'overwrite' | 'merge' | 'merge_preserve' | 'clear';
    cqVersion?: string;
    requiresRoot?: boolean;
    dependencies?: string[];
    filters?: PackageFilter[];
    properties?: Record<string, any>;
}
export interface RebuildPackageOptions {
    force?: boolean;
}
export interface DeletePackageOptions {
    force?: boolean;
    uninstall?: boolean;
}
export interface PackageOperationResult {
    success: boolean;
    packagePath?: string;
    message?: string;
    log?: string[];
    errors?: string[];
    warnings?: string[];
}
export declare class PackageService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Create package using /crx/packmgr/service/.json/
     */
    createPackage(options: CreatePackageOptions): Promise<AEMResponse<PackageOperationResult>>;
    /**
     * Install package with installation options
     */
    installPackage(packagePath: string, options?: InstallPackageOptions): Promise<AEMResponse<PackageOperationResult>>;
    /**
     * Upload package with file handling
     */
    uploadPackage(packageFile: File | Buffer, options?: UploadPackageOptions): Promise<AEMResponse<PackageOperationResult>>;
    /**
     * Upload and install package in combined operation
     */
    uploadAndInstallPackage(packageFile: File | Buffer, installOptions?: InstallPackageOptions): Promise<AEMResponse<PackageOperationResult>>;
    /**
     * Rebuild package
     */
    rebuildPackage(packagePath: string, options?: RebuildPackageOptions): Promise<AEMResponse<PackageOperationResult>>;
    /**
     * Modify package
     */
    modifyPackage(packagePath: string, options: ModifyPackageOptions): Promise<AEMResponse<PackageOperationResult>>;
    /**
     * Delete package with safety checks
     */
    deletePackage(packagePath: string, options?: DeletePackageOptions): Promise<AEMResponse<PackageOperationResult>>;
    /**
     * Parse package operation response
     */
    private parsePackageOperationResponse;
    /**
     * Check if package is a system package that should not be deleted
     */
    private isSystemPackage;
}
//# sourceMappingURL=package-service.d.ts.map