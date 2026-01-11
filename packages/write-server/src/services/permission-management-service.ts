/**
 * Permission Management Service for AEMaaCS write operations
 * Handles ACL reading, permission validation, and effective permissions calculation
 */

import { AEMHttpClient, RequestOptions } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

export interface ACL {
  path: string;
  entries: ACLEntry[];
  inherited: boolean;
  lastModified?: Date;
  modifiedBy?: string;
}

export interface ACLEntry {
  principal: string;
  principalType: 'user' | 'group';
  permissions: Permission[];
  allow: boolean;
  order?: number;
}

export interface Permission {
  privilege: string;
  granted: boolean;
  restrictions?: Record<string, any>;
}

export interface EffectivePermissions {
  principal: string;
  path: string;
  permissions: EffectivePermission[];
  inheritedFrom: string[];
  deniedBy: string[];
}

export interface EffectivePermission {
  privilege: string;
  granted: boolean;
  source: 'direct' | 'inherited' | 'group';
  sourcePath?: string;
  restrictions?: Record<string, any>;
}

export interface PermissionValidationResult {
  valid: boolean;
  missingPermissions: string[];
  invalidPaths: string[];
  warnings: string[];
}

export interface ACLQueryOptions {
  path?: string;
  principal?: string;
  privilege?: string;
  includeInherited?: boolean;
  depth?: number;
}

export interface PermissionCheckOptions {
  includeRestrictions?: boolean;
  includeInherited?: boolean;
  includeGroups?: boolean;
}

export class PermissionManagementService {
  private client: AEMHttpClient;
  private logger: Logger;

  constructor(client: AEMHttpClient) {
    this.client = client;
    this.logger = Logger.getInstance();
  }

  /**
   * Read ACL for a specific path
   */
  async readACL(path: string, options: ACLQueryOptions = {}): Promise<AEMResponse<ACL>> {
    try {
      this.logger.debug('Reading ACL', { path, options });

      if (!path) {
        throw new AEMException(
          'Path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const requestOptions: RequestOptions = {
        cache: true,
        cacheTtl: 300000, // Cache for 5 minutes
        context: {
          operation: 'readACL',
          resource: path
        }
      };

      const params: Record<string, any> = {};
      if (options.includeInherited !== undefined) {
        params['includeInherited'] = options.includeInherited;
      }
      if (options.depth) {
        params['depth'] = options.depth;
      }

      const response = await this.client.get<any>(
        `${path}/jcr:content/rep:policy.json`,
        params,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `ACL not found for path: ${path}`,
          'NOT_FOUND_ERROR',
          false,
          undefined,
          { path }
        );
      }

      const acl = this.parseACLResponse(response.data, path);

      this.logger.debug('Successfully read ACL', { 
        path,
        entryCount: acl.entries.length
      });

      return {
        success: true,
        data: acl,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0,
          cached: response.metadata?.cached
        }
      };

    } catch (error) {
      this.logger.error('Failed to read ACL', error as Error, { path });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while reading ACL for ${path}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, path }
      );
    }
  }

  /**
   * Get effective permissions for a principal at a specific path
   */
  async getEffectivePermissions(principal: string, path: string, options: PermissionCheckOptions = {}): Promise<AEMResponse<EffectivePermissions>> {
    try {
      this.logger.debug('Getting effective permissions', { principal, path, options });

      if (!principal || !path) {
        throw new AEMException(
          'Principal and path are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const requestOptions: RequestOptions = {
        cache: true,
        cacheTtl: 300000, // Cache for 5 minutes
        context: {
          operation: 'getEffectivePermissions',
          resource: path
        }
      };

      const params: Record<string, any> = {
        principal,
        path
      };

      if (options.includeRestrictions !== undefined) {
        params['includeRestrictions'] = options.includeRestrictions;
      }
      if (options.includeInherited !== undefined) {
        params['includeInherited'] = options.includeInherited;
      }
      if (options.includeGroups !== undefined) {
        params['includeGroups'] = options.includeGroups;
      }

      const response = await this.client.get<any>(
        '/libs/granite/security/effective-permissions.json',
        params,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to get effective permissions for principal: ${principal}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const effectivePermissions = this.parseEffectivePermissionsResponse(response.data, principal, path);

      this.logger.debug('Successfully retrieved effective permissions', { 
        principal,
        path,
        permissionCount: effectivePermissions.permissions.length
      });

      return {
        success: true,
        data: effectivePermissions,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0,
          cached: response.metadata?.cached
        }
      };

    } catch (error) {
      this.logger.error('Failed to get effective permissions', error as Error, { principal, path });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while getting effective permissions for ${principal} at ${path}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, principal, path }
      );
    }
  }

  /**
   * Validate permissions for a principal
   */
  async validatePermissions(principal: string, path: string, requiredPermissions: string[]): Promise<AEMResponse<PermissionValidationResult>> {
    try {
      this.logger.debug('Validating permissions', { principal, path, requiredPermissions });

      if (!principal || !path || !requiredPermissions.length) {
        throw new AEMException(
          'Principal, path, and required permissions are required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Get effective permissions
      const effectivePermissionsResponse = await this.getEffectivePermissions(principal, path, {
        includeRestrictions: true,
        includeInherited: true,
        includeGroups: true
      });

      if (!effectivePermissionsResponse.success || !effectivePermissionsResponse.data) {
        throw new AEMException(
          'Failed to retrieve effective permissions for validation',
          'SERVER_ERROR',
          true
        );
      }

      const effectivePermissions = effectivePermissionsResponse.data;
      const validationResult = this.performPermissionValidation(effectivePermissions, requiredPermissions, path);

      this.logger.debug('Successfully validated permissions', { 
        principal,
        path,
        valid: validationResult.valid,
        missingCount: validationResult.missingPermissions.length
      });

      return {
        success: true,
        data: validationResult,
        metadata: {
          timestamp: new Date(),
          requestId: effectivePermissionsResponse.metadata?.requestId || '',
          duration: effectivePermissionsResponse.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to validate permissions', error as Error, { principal, path, requiredPermissions });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while validating permissions for ${principal} at ${path}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, principal, path, requiredPermissions }
      );
    }
  }

  /**
   * Check if a principal has a specific permission
   */
  async hasPermission(principal: string, path: string, privilege: string): Promise<AEMResponse<boolean>> {
    try {
      this.logger.debug('Checking permission', { principal, path, privilege });

      if (!principal || !path || !privilege) {
        throw new AEMException(
          'Principal, path, and privilege are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const effectivePermissionsResponse = await this.getEffectivePermissions(principal, path);
      
      if (!effectivePermissionsResponse.success || !effectivePermissionsResponse.data) {
        throw new AEMException(
          'Failed to retrieve effective permissions',
          'SERVER_ERROR',
          true
        );
      }

      const effectivePermissions = effectivePermissionsResponse.data;
      const hasPermission = effectivePermissions.permissions.some(
        (perm: any) => perm.privilege === privilege && perm.granted
      );

      this.logger.debug('Successfully checked permission', { 
        principal,
        path,
        privilege,
        hasPermission
      });

      return {
        success: true,
        data: hasPermission,
        metadata: {
          timestamp: new Date(),
          requestId: effectivePermissionsResponse.metadata?.requestId || '',
          duration: effectivePermissionsResponse.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to check permission', error as Error, { principal, path, privilege });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while checking permission for ${principal} at ${path}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, principal, path, privilege }
      );
    }
  }

  /**
   * Get all permissions for a principal across multiple paths
   */
  async getPrincipalPermissions(principal: string, paths: string[], options: PermissionCheckOptions = {}): Promise<AEMResponse<Record<string, EffectivePermissions>>> {
    try {
      this.logger.debug('Getting principal permissions', { principal, paths, options });

      if (!principal || !paths.length) {
        throw new AEMException(
          'Principal and paths are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const results: Record<string, EffectivePermissions> = {};
      const errors: string[] = [];

      // Get effective permissions for each path
      for (const path of paths) {
        try {
          const effectivePermissionsResponse = await this.getEffectivePermissions(principal, path, options);
          if (effectivePermissionsResponse.success && effectivePermissionsResponse.data) {
            results[path] = effectivePermissionsResponse.data;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to get permissions for ${path}: ${errorMessage}`);
          this.logger.warn('Failed to get permissions for path', { principal, path, error: (error as Error).message });
        }
      }

      this.logger.debug('Successfully retrieved principal permissions', { 
        principal,
        pathCount: paths.length,
        successCount: Object.keys(results).length,
        errorCount: errors.length
      });

      return {
        success: true,
        data: results,
        metadata: {
          timestamp: new Date(),
          requestId: '',
          duration: 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to get principal permissions', error as Error, { principal, paths });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while getting principal permissions for ${principal}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, principal, paths }
      );
    }
  }

  /**
   * Parse ACL response
   */
  private parseACLResponse(data: any, path: string): ACL {
    const entries: ACLEntry[] = [];
    
    if (data.entries) {
      for (const [principal, entryData] of Object.entries(data.entries)) {
        const entry = entryData as any;
        entries.push({
          principal,
          principalType: entry.principalType || 'user',
          permissions: this.parsePermissions(entry.permissions || []),
          allow: entry.allow !== false,
          order: entry.order
        });
      }
    }

    return {
      path,
      entries,
      inherited: data.inherited || false,
      lastModified: data.lastModified ? new Date(data.lastModified) : undefined,
      modifiedBy: data.modifiedBy
    };
  }

  /**
   * Parse effective permissions response
   */
  private parseEffectivePermissionsResponse(data: any, principal: string, path: string): EffectivePermissions {
    const permissions: EffectivePermission[] = [];
    
    if (data.permissions) {
      for (const permData of data.permissions) {
        permissions.push({
          privilege: permData.privilege,
          granted: permData.granted || false,
          source: permData.source || 'direct',
          sourcePath: permData.sourcePath,
          restrictions: permData.restrictions
        });
      }
    }

    return {
      principal,
      path,
      permissions,
      inheritedFrom: data.inheritedFrom || [],
      deniedBy: data.deniedBy || []
    };
  }

  /**
   * Parse permissions array
   */
  private parsePermissions(permissionsData: any[]): Permission[] {
    return permissionsData.map(perm => ({
      privilege: perm.privilege,
      granted: perm.granted || false,
      restrictions: perm.restrictions
    }));
  }

  /**
   * Perform permission validation
   */
  private performPermissionValidation(effectivePermissions: EffectivePermissions, requiredPermissions: string[], path: string): PermissionValidationResult {
    const missingPermissions: string[] = [];
    const invalidPaths: string[] = [];
    const warnings: string[] = [];

    // Check if path exists and is accessible
    if (!effectivePermissions.path || effectivePermissions.path !== path) {
      invalidPaths.push(path);
    }

    // Check each required permission
    for (const requiredPerm of requiredPermissions) {
      const hasPermission = effectivePermissions.permissions.some(
        perm => perm.privilege === requiredPerm && perm.granted
      );

      if (!hasPermission) {
        missingPermissions.push(requiredPerm);
      }
    }

    // Add warnings for denied permissions
    if (effectivePermissions.deniedBy.length > 0) {
      warnings.push(`Some permissions are explicitly denied by: ${effectivePermissions.deniedBy.join(', ')}`);
    }

    return {
      valid: missingPermissions.length === 0 && invalidPaths.length === 0,
      missingPermissions,
      invalidPaths,
      warnings
    };
  }
}
