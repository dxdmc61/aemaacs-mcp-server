/**
 * Package Service for AEMaaCS write operations
 * Handles package creation, installation, upload, modification, and deletion
 */

import { AEMHttpClient, RequestOptions } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

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

export class PackageService {
  private client: AEMHttpClient;
  private logger: Logger;

  constructor(client: AEMHttpClient) {
    this.client = client;
    this.logger = Logger.getInstance();
  }

  /**
   * Create package using /crx/packmgr/service/.json/
   */
  async createPackage(options: CreatePackageOptions): Promise<AEMResponse<PackageOperationResult>> {
    try {
      this.logger.debug('Creating package', { options });

      if (!options.groupName || !options.packageName) {
        throw new AEMException(
          'Group name and package name are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('cmd', 'create');
      formData.append('groupName', options.groupName);
      formData.append('packageName', options.packageName);
      
      if (options.version) {
        formData.append('packageVersion', options.version);
      }
      if (options.description) {
        formData.append('packageDescription', options.description);
      }
      if (options.acHandling) {
        formData.append('acHandling', options.acHandling);
      }
      if (options.cqVersion) {
        formData.append('cqVersion', options.cqVersion);
      }
      if (options.requiresRoot !== undefined) {
        formData.append('requiresRoot', options.requiresRoot.toString());
      }
      if (options.dependencies && options.dependencies.length > 0) {
        formData.append('dependencies', options.dependencies.join(','));
      }
      if (options.filters && options.filters.length > 0) {
        formData.append('filter', JSON.stringify(options.filters));
      }
      if (options.properties) {
        for (const [key, value] of Object.entries(options.properties)) {
          formData.append(`property.${key}`, value.toString());
        }
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'createPackage',
          resource: `/etc/packages/${options.groupName}/${options.packageName}`
        }
      };

      const response = await this.client.post<any>(
        '/crx/packmgr/service/.json/',
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          'Failed to create package',
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parsePackageOperationResponse(response.data);

      this.logger.debug('Successfully created package', { 
        groupName: options.groupName,
        packageName: options.packageName,
        packagePath: result.packagePath
      });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to create package', error as Error, { options });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while creating package',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, options }
      );
    }
  }

  /**
   * Install package with installation options
   */
  async installPackage(packagePath: string, options: InstallPackageOptions = {}): Promise<AEMResponse<PackageOperationResult>> {
    try {
      this.logger.debug('Installing package', { packagePath, options });

      if (!packagePath) {
        throw new AEMException(
          'Package path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('cmd', 'install');
      
      if (options.recursive !== undefined) {
        formData.append('recursive', options.recursive.toString());
      }
      if (options.autosave !== undefined) {
        formData.append('autosave', options.autosave.toString());
      }
      if (options.acHandling) {
        formData.append('acHandling', options.acHandling);
      }
      if (options.cqVersion) {
        formData.append('cqVersion', options.cqVersion);
      }
      if (options.strict !== undefined) {
        formData.append('strict', options.strict.toString());
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'installPackage',
          resource: packagePath
        }
      };

      const response = await this.client.post<any>(
        `${packagePath}/.json`,
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to install package: ${packagePath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parsePackageOperationResponse(response.data);

      this.logger.debug('Successfully installed package', { 
        packagePath,
        success: result.success
      });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to install package', error as Error, { packagePath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while installing package: ${packagePath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, packagePath }
      );
    }
  }

  /**
   * Upload package with file handling
   */
  async uploadPackage(packageFile: File | Buffer, options: UploadPackageOptions = {}): Promise<AEMResponse<PackageOperationResult>> {
    try {
      this.logger.debug('Uploading package', { 
        fileName: packageFile instanceof File ? packageFile.name : 'buffer',
        size: packageFile instanceof File ? packageFile.size : packageFile.length,
        options 
      });

      const formData = new FormData();
      formData.append('cmd', 'upload');
      
      if (packageFile instanceof File) {
        formData.append('package', packageFile);
      } else {
        // Handle Buffer case
        const blob = new Blob([packageFile], { type: 'application/zip' });
        formData.append('package', blob, 'package.zip');
      }

      if (options.force !== undefined) {
        formData.append('force', options.force.toString());
      }
      if (options.install !== undefined) {
        formData.append('install', options.install.toString());
      }

      // Add install options if install is true
      if (options.install && options.installOptions) {
        const installOpts = options.installOptions;
        if (installOpts.recursive !== undefined) {
          formData.append('recursive', installOpts.recursive.toString());
        }
        if (installOpts.autosave !== undefined) {
          formData.append('autosave', installOpts.autosave.toString());
        }
        if (installOpts.acHandling) {
          formData.append('acHandling', installOpts.acHandling);
        }
        if (installOpts.cqVersion) {
          formData.append('cqVersion', installOpts.cqVersion);
        }
        if (installOpts.strict !== undefined) {
          formData.append('strict', installOpts.strict.toString());
        }
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'uploadPackage',
          resource: '/crx/packmgr/service'
        }
      };

      const response = await this.client.upload<any>(
        '/crx/packmgr/service/.json/',
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          'Failed to upload package',
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parsePackageOperationResponse(response.data);

      this.logger.debug('Successfully uploaded package', { 
        packagePath: result.packagePath,
        success: result.success
      });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to upload package', error as Error);
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while uploading package',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error }
      );
    }
  }

  /**
   * Upload and install package in combined operation
   */
  async uploadAndInstallPackage(packageFile: File | Buffer, installOptions: InstallPackageOptions = {}): Promise<AEMResponse<PackageOperationResult>> {
    try {
      this.logger.debug('Uploading and installing package');

      const uploadOptions: UploadPackageOptions = {
        install: true,
        installOptions
      };

      return await this.uploadPackage(packageFile, uploadOptions);

    } catch (error) {
      this.logger.error('Failed to upload and install package', error as Error);
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while uploading and installing package',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error }
      );
    }
  }

  /**
   * Rebuild package
   */
  async rebuildPackage(packagePath: string, options: RebuildPackageOptions = {}): Promise<AEMResponse<PackageOperationResult>> {
    try {
      this.logger.debug('Rebuilding package', { packagePath, options });

      if (!packagePath) {
        throw new AEMException(
          'Package path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('cmd', 'build');
      
      if (options.force !== undefined) {
        formData.append('force', options.force.toString());
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'rebuildPackage',
          resource: packagePath
        }
      };

      const response = await this.client.post<any>(
        `${packagePath}/.json`,
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to rebuild package: ${packagePath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parsePackageOperationResponse(response.data);

      this.logger.debug('Successfully rebuilt package', { 
        packagePath,
        success: result.success
      });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to rebuild package', error as Error, { packagePath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while rebuilding package: ${packagePath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, packagePath }
      );
    }
  }

  /**
   * Modify package
   */
  async modifyPackage(packagePath: string, options: ModifyPackageOptions): Promise<AEMResponse<PackageOperationResult>> {
    try {
      this.logger.debug('Modifying package', { packagePath, options });

      if (!packagePath) {
        throw new AEMException(
          'Package path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('cmd', 'modify');
      
      if (options.description) {
        formData.append('packageDescription', options.description);
      }
      if (options.acHandling) {
        formData.append('acHandling', options.acHandling);
      }
      if (options.cqVersion) {
        formData.append('cqVersion', options.cqVersion);
      }
      if (options.requiresRoot !== undefined) {
        formData.append('requiresRoot', options.requiresRoot.toString());
      }
      if (options.dependencies && options.dependencies.length > 0) {
        formData.append('dependencies', options.dependencies.join(','));
      }
      if (options.filters && options.filters.length > 0) {
        formData.append('filter', JSON.stringify(options.filters));
      }
      if (options.properties) {
        for (const [key, value] of Object.entries(options.properties)) {
          formData.append(`property.${key}`, value.toString());
        }
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'modifyPackage',
          resource: packagePath
        }
      };

      const response = await this.client.post<any>(
        `${packagePath}/.json`,
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to modify package: ${packagePath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parsePackageOperationResponse(response.data);

      this.logger.debug('Successfully modified package', { 
        packagePath,
        success: result.success
      });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to modify package', error as Error, { packagePath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while modifying package: ${packagePath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, packagePath }
      );
    }
  }

  /**
   * Delete package with safety checks
   */
  async deletePackage(packagePath: string, options: DeletePackageOptions = {}): Promise<AEMResponse<PackageOperationResult>> {
    try {
      this.logger.debug('Deleting package', { packagePath, options });

      if (!packagePath) {
        throw new AEMException(
          'Package path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Safety check: prevent deletion of system packages
      if (this.isSystemPackage(packagePath)) {
        throw new AEMException(
          `Cannot delete system package: ${packagePath}`,
          'VALIDATION_ERROR',
          false,
          undefined,
          { packagePath }
        );
      }

      const formData = new FormData();
      formData.append('cmd', 'delete');
      
      if (options.force !== undefined) {
        formData.append('force', options.force.toString());
      }
      if (options.uninstall !== undefined) {
        formData.append('uninstall', options.uninstall.toString());
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'deletePackage',
          resource: packagePath
        }
      };

      const response = await this.client.post<any>(
        `${packagePath}/.json`,
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to delete package: ${packagePath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parsePackageOperationResponse(response.data);

      this.logger.debug('Successfully deleted package', { 
        packagePath,
        success: result.success
      });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to delete package', error as Error, { packagePath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while deleting package: ${packagePath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, packagePath }
      );
    }
  }

  /**
   * Parse package operation response
   */
  private parsePackageOperationResponse(data: any): PackageOperationResult {
    return {
      success: Boolean(data.success !== false),
      packagePath: data.path || data.packagePath,
      message: data.msg || data.message,
      log: Array.isArray(data.log) ? data.log : (data.log ? [data.log] : []),
      errors: Array.isArray(data.errors) ? data.errors : (data.error ? [data.error] : []),
      warnings: Array.isArray(data.warnings) ? data.warnings : (data.warning ? [data.warning] : [])
    };
  }

  /**
   * Check if package is a system package that should not be deleted
   */
  private isSystemPackage(packagePath: string): boolean {
    const systemPackagePrefixes = [
      '/etc/packages/adobe/',
      '/etc/packages/day/',
      '/etc/packages/cq/',
      '/etc/packages/granite/',
      '/etc/packages/sling/'
    ];

    return systemPackagePrefixes.some(prefix => packagePath.startsWith(prefix));
  }
}
