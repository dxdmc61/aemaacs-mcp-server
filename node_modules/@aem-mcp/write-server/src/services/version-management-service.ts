/**
 * Version Management Service for AEMaaCS write operations
 * Handles version creation, comparison, restoration, and labeling operations
 */

import { AEMHttpClient, RequestOptions } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

export interface CreateVersionOptions {
  comment?: string;
  label?: string;
  autoSave?: boolean;
}

export interface VersionComparison {
  resourcePath: string;
  version1: string;
  version2: string;
  differences: VersionDifference[];
  summary: {
    added: number;
    modified: number;
    deleted: number;
    unchanged: number;
  };
}

export interface VersionDifference {
  type: 'added' | 'modified' | 'deleted' | 'unchanged';
  path: string;
  property?: string;
  oldValue?: any;
  newValue?: any;
  description?: string;
}

export interface VersionRestoreOptions {
  comment?: string;
  force?: boolean;
  createBackup?: boolean;
}

export interface VersionLabelOptions {
  labels: string[];
  comment?: string;
}

export interface VersionInfo {
  versionName: string;
  versionPath: string;
  created: Date;
  createdBy: string;
  comment?: string;
  labels: string[];
  isCurrentVersion: boolean;
  size?: number;
  properties?: Record<string, any>;
}

export interface VersionHistory {
  resourcePath: string;
  currentVersion: string;
  totalVersions: number;
  versions: VersionInfo[];
}

export interface VersionOperationResult {
  success: boolean;
  versionName?: string;
  message?: string;
  warnings?: string[];
  errors?: string[];
}

export class VersionManagementService {
  private client: AEMHttpClient;
  private logger: Logger;

  constructor(client: AEMHttpClient) {
    this.client = client;
    this.logger = Logger.getInstance();
  }

  // ============================================================================
  // VERSION CREATION OPERATIONS
  // ============================================================================

  /**
   * Create a new version of a resource
   */
  async createVersion(resourcePath: string, options: CreateVersionOptions = {}): Promise<AEMResponse<VersionOperationResult>> {
    try {
      this.logger.debug('Creating version', { resourcePath, options });

      if (!resourcePath) {
        throw new AEMException(
          'Resource path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('cmd', 'createVersion');
      formData.append('path', resourcePath);
      
      if (options.comment) {
        formData.append('comment', options.comment);
      }
      if (options.label) {
        formData.append('label', options.label);
      }
      if (options.autoSave !== undefined) {
        formData.append('autoSave', options.autoSave.toString());
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'createVersion',
          resource: resourcePath
        }
      };

      const response = await this.client.post<any>(
        '/bin/wcmcommand',
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to create version for: ${resourcePath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseVersionOperationResponse(response.data, resourcePath);

      this.logger.debug('Successfully created version', { 
        resourcePath,
        versionName: result.versionName
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
      this.logger.error('Failed to create version', error as Error, { resourcePath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while creating version: ${resourcePath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, resourcePath }
      );
    }
  }

  /**
   * Create version with auto-save
   */
  async createAutoSaveVersion(resourcePath: string, comment?: string): Promise<AEMResponse<VersionOperationResult>> {
    return this.createVersion(resourcePath, {
      comment: comment || 'Auto-save version',
      autoSave: true
    });
  }

  // ============================================================================
  // VERSION COMPARISON OPERATIONS
  // ============================================================================

  /**
   * Compare two versions of a resource
   */
  async compareVersions(resourcePath: string, version1: string, version2: string): Promise<AEMResponse<VersionComparison>> {
    try {
      this.logger.debug('Comparing versions', { resourcePath, version1, version2 });

      if (!resourcePath || !version1 || !version2) {
        throw new AEMException(
          'Resource path and both version names are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const queryParams = {
        path: resourcePath,
        version1,
        version2,
        diffFormat: 'json'
      };

      const requestOptions: RequestOptions = {
        context: {
          operation: 'compareVersions',
          resource: resourcePath
        }
      };

      const response = await this.client.get<any>(
        `/bin/versiondiff?${new URLSearchParams(queryParams).toString()}`,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to compare versions for: ${resourcePath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const comparison = this.parseVersionComparison(response.data, resourcePath, version1, version2);

      this.logger.debug('Successfully compared versions', { 
        resourcePath,
        version1,
        version2,
        differencesCount: comparison.differences.length
      });

      return {
        success: true,
        data: comparison,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to compare versions', error as Error, { resourcePath, version1, version2 });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while comparing versions: ${resourcePath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, resourcePath, version1, version2 }
      );
    }
  }

  /**
   * Compare current version with a specific version
   */
  async compareWithCurrentVersion(resourcePath: string, versionName: string): Promise<AEMResponse<VersionComparison>> {
    try {
      // Get current version first
      const historyResponse = await this.getVersionHistory(resourcePath);
      if (!historyResponse.success || !historyResponse.data) {
        throw new AEMException(
          'Failed to get current version information',
          'SERVER_ERROR',
          false
        );
      }

      const currentVersion = historyResponse.data.currentVersion;
      return this.compareVersions(resourcePath, currentVersion, versionName);

    } catch (error) {
      this.logger.error('Failed to compare with current version', error as Error, { resourcePath, versionName });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while comparing with current version: ${resourcePath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, resourcePath, versionName }
      );
    }
  }

  // ============================================================================
  // VERSION RESTORATION OPERATIONS
  // ============================================================================

  /**
   * Restore a specific version of a resource
   */
  async restoreVersion(resourcePath: string, versionName: string, options: VersionRestoreOptions = {}): Promise<AEMResponse<VersionOperationResult>> {
    try {
      this.logger.debug('Restoring version', { resourcePath, versionName, options });

      if (!resourcePath || !versionName) {
        throw new AEMException(
          'Resource path and version name are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('cmd', 'restoreVersion');
      formData.append('path', resourcePath);
      formData.append('version', versionName);
      
      if (options.comment) {
        formData.append('comment', options.comment);
      }
      if (options.force !== undefined) {
        formData.append('force', options.force.toString());
      }
      if (options.createBackup !== undefined) {
        formData.append('createBackup', options.createBackup.toString());
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'restoreVersion',
          resource: resourcePath
        }
      };

      const response = await this.client.post<any>(
        '/bin/wcmcommand',
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to restore version for: ${resourcePath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseVersionOperationResponse(response.data, resourcePath);

      this.logger.debug('Successfully restored version', { 
        resourcePath,
        versionName,
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
      this.logger.error('Failed to restore version', error as Error, { resourcePath, versionName });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while restoring version: ${resourcePath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, resourcePath, versionName }
      );
    }
  }

  // ============================================================================
  // VERSION LABELING OPERATIONS
  // ============================================================================

  /**
   * Add labels to a version
   */
  async addVersionLabels(resourcePath: string, versionName: string, options: VersionLabelOptions): Promise<AEMResponse<VersionOperationResult>> {
    try {
      this.logger.debug('Adding version labels', { resourcePath, versionName, options });

      if (!resourcePath || !versionName || !options.labels || options.labels.length === 0) {
        throw new AEMException(
          'Resource path, version name, and labels are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('cmd', 'addVersionLabels');
      formData.append('path', resourcePath);
      formData.append('version', versionName);
      formData.append('labels', options.labels.join(','));
      
      if (options.comment) {
        formData.append('comment', options.comment);
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'addVersionLabels',
          resource: resourcePath
        }
      };

      const response = await this.client.post<any>(
        '/bin/wcmcommand',
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to add version labels for: ${resourcePath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseVersionOperationResponse(response.data, resourcePath);

      this.logger.debug('Successfully added version labels', { 
        resourcePath,
        versionName,
        labels: options.labels
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
      this.logger.error('Failed to add version labels', error as Error, { resourcePath, versionName });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while adding version labels: ${resourcePath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, resourcePath, versionName }
      );
    }
  }

  /**
   * Remove labels from a version
   */
  async removeVersionLabels(resourcePath: string, versionName: string, labels: string[], comment?: string): Promise<AEMResponse<VersionOperationResult>> {
    try {
      this.logger.debug('Removing version labels', { resourcePath, versionName, labels });

      if (!resourcePath || !versionName || !labels || labels.length === 0) {
        throw new AEMException(
          'Resource path, version name, and labels are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('cmd', 'removeVersionLabels');
      formData.append('path', resourcePath);
      formData.append('version', versionName);
      formData.append('labels', labels.join(','));
      
      if (comment) {
        formData.append('comment', comment);
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'removeVersionLabels',
          resource: resourcePath
        }
      };

      const response = await this.client.post<any>(
        '/bin/wcmcommand',
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to remove version labels for: ${resourcePath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseVersionOperationResponse(response.data, resourcePath);

      this.logger.debug('Successfully removed version labels', { 
        resourcePath,
        versionName,
        labels
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
      this.logger.error('Failed to remove version labels', error as Error, { resourcePath, versionName });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while removing version labels: ${resourcePath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, resourcePath, versionName }
      );
    }
  }

  // ============================================================================
  // VERSION HISTORY OPERATIONS
  // ============================================================================

  /**
   * Get version history for a resource
   */
  async getVersionHistory(resourcePath: string): Promise<AEMResponse<VersionHistory>> {
    try {
      this.logger.debug('Getting version history', { resourcePath });

      if (!resourcePath) {
        throw new AEMException(
          'Resource path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const requestOptions: RequestOptions = {
        cache: true,
        cacheTtl: 300000, // Cache for 5 minutes
        context: {
          operation: 'getVersionHistory',
          resource: resourcePath
        }
      };

      const response = await this.client.get<any>(
        `${resourcePath}.versions.json`,
        requestOptions
      );

      if (!response.success || !response.data) {
        // Resource might not have versions, return empty history
        const emptyHistory: VersionHistory = {
          resourcePath,
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

      const versionHistory = this.parseVersionHistory(response.data, resourcePath);

      this.logger.debug('Successfully retrieved version history', { 
        resourcePath,
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

    } catch (error) {
      this.logger.error('Failed to get version history', error as Error, { resourcePath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while getting version history: ${resourcePath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, resourcePath }
      );
    }
  }

  /**
   * Get specific version information
   */
  async getVersionInfo(resourcePath: string, versionName: string): Promise<AEMResponse<VersionInfo>> {
    try {
      this.logger.debug('Getting version info', { resourcePath, versionName });

      if (!resourcePath || !versionName) {
        throw new AEMException(
          'Resource path and version name are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const versionPath = `${resourcePath}/jcr:versions/${versionName}`;

      const requestOptions: RequestOptions = {
        context: {
          operation: 'getVersionInfo',
          resource: versionPath
        }
      };

      const response = await this.client.get<any>(
        `${versionPath}.json`,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to get version info: ${versionName}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const versionInfo = this.parseVersionInfo(response.data, resourcePath, versionName);

      this.logger.debug('Successfully retrieved version info', { resourcePath, versionName });

      return {
        success: true,
        data: versionInfo,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to get version info', error as Error, { resourcePath, versionName });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while getting version info: ${versionName}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, resourcePath, versionName }
      );
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Parse version operation response
   */
  private parseVersionOperationResponse(data: any, resourcePath: string): VersionOperationResult {
    return {
      success: Boolean(data.success !== false),
      versionName: data.versionName || data.version,
      message: data.message || data.msg,
      warnings: Array.isArray(data.warnings) ? data.warnings : (data.warning ? [data.warning] : []),
      errors: Array.isArray(data.errors) ? data.errors : (data.error ? [data.error] : [])
    };
  }

  /**
   * Parse version comparison response
   */
  private parseVersionComparison(data: any, resourcePath: string, version1: string, version2: string): VersionComparison {
    const differences: VersionDifference[] = [];

    if (data.differences && Array.isArray(data.differences)) {
      for (const diff of data.differences) {
        differences.push({
          type: diff.type || 'unchanged',
          path: diff.path || '',
          property: diff.property,
          oldValue: diff.oldValue,
          newValue: diff.newValue,
          description: diff.description
        });
      }
    }

    const summary = {
      added: differences.filter(d => d.type === 'added').length,
      modified: differences.filter(d => d.type === 'modified').length,
      deleted: differences.filter(d => d.type === 'deleted').length,
      unchanged: differences.filter(d => d.type === 'unchanged').length
    };

    return {
      resourcePath,
      version1,
      version2,
      differences,
      summary
    };
  }

  /**
   * Parse version history response
   */
  private parseVersionHistory(data: any, resourcePath: string): VersionHistory {
    const versions: VersionInfo[] = [];
    let currentVersion = '1.0';

    if (data.versions && typeof data.versions === 'object') {
      for (const [versionName, versionData] of Object.entries(data.versions)) {
        if (typeof versionData === 'object' && versionData !== null) {
          const version = versionData as any;
          versions.push({
            versionName,
            versionPath: `${resourcePath}/jcr:versions/${versionName}`,
            created: version['jcr:created'] ? new Date(version['jcr:created']) : new Date(),
            createdBy: version['jcr:createdBy'] || 'unknown',
            comment: version['jcr:comment'],
            labels: version['jcr:versionLabels'] || [],
            isCurrentVersion: version.isCurrentVersion || false,
            size: version.size,
            properties: version.properties || {}
          });
        }
      }
    }

    // Sort versions by creation date (newest first)
    versions.sort((a, b) => b.created.getTime() - a.created.getTime());

    // Set current version to the latest or the one marked as current
    if (versions.length > 0) {
      const current = versions.find(v => v.isCurrentVersion) || versions[0];
      currentVersion = current.versionName;
    }

    return {
      resourcePath,
      currentVersion,
      totalVersions: versions.length,
      versions
    };
  }

  /**
   * Parse version info response
   */
  private parseVersionInfo(data: any, resourcePath: string, versionName: string): VersionInfo {
    return {
      versionName,
      versionPath: `${resourcePath}/jcr:versions/${versionName}`,
      created: data['jcr:created'] ? new Date(data['jcr:created']) : new Date(),
      createdBy: data['jcr:createdBy'] || 'unknown',
      comment: data['jcr:comment'],
      labels: data['jcr:versionLabels'] || [],
      isCurrentVersion: data.isCurrentVersion || false,
      size: data.size,
      properties: data.properties || {}
    };
  }
}
