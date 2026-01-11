/**
 * User Administration Service for AEMaaCS write operations
 * Handles user and group creation, deletion, and membership management
 */

import { AEMHttpClient, RequestOptions } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

export interface UserProfile {
  givenName?: string;
  familyName?: string;
  email?: string;
  jobTitle?: string;
  aboutMe?: string;
  phoneNumber?: string;
  mobile?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  state?: string;
}

export interface CreateUserOptions {
  profile?: UserProfile;
  intermediatePath?: string;
  createHome?: boolean;
  rep_password?: string;
}

export interface CreateGroupOptions {
  intermediatePath?: string;
  profile?: Record<string, any>;
}

export interface UserOperationResult {
  success: boolean;
  path?: string;
  userId?: string;
  message?: string;
  warnings?: string[];
  errors?: string[];
}

export interface GroupOperationResult {
  success: boolean;
  path?: string;
  groupId?: string;
  message?: string;
  warnings?: string[];
  errors?: string[];
}

export interface MembershipResult {
  success: boolean;
  message?: string;
  addedMembers?: string[];
  removedMembers?: string[];
  warnings?: string[];
  errors?: string[];
}

export class UserAdministrationService {
  private client: AEMHttpClient;
  private logger: Logger;

  constructor(client: AEMHttpClient) {
    this.client = client;
    this.logger = Logger.getInstance();
  }

  /**
   * Create user using /libs/granite/security/post/authorizables
   */
  async createUser(userId: string, password: string, options: CreateUserOptions = {}): Promise<AEMResponse<UserOperationResult>> {
    try {
      this.logger.debug('Creating user', { userId, options });

      if (!userId || !password) {
        throw new AEMException(
          'User ID and password are required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Validate user ID format
      if (!this.isValidUserId(userId)) {
        throw new AEMException(
          'Invalid user ID format. User IDs must contain only alphanumeric characters, hyphens, and underscores',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('createUser', '');
      formData.append('authorizableId', userId);
      formData.append('rep:password', password);
      
      if (options.intermediatePath) {
        formData.append('intermediatePath', options.intermediatePath);
      }
      
      if (options.createHome !== undefined) {
        formData.append('createHome', options.createHome.toString());
      }

      // Add profile information
      if (options.profile) {
        for (const [key, value] of Object.entries(options.profile)) {
          if (value !== null && value !== undefined) {
            formData.append(`profile/${key}`, value.toString());
          }
        }
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'createUser',
          resource: userId
        }
      };

      const response = await this.client.post<any>(
        '/libs/granite/security/post/authorizables',
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to create user: ${userId}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseUserOperationResponse(response.data, userId);

      this.logger.debug('Successfully created user', { 
        userId,
        path: result.path
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
      this.logger.error('Failed to create user', error as Error, { userId });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while creating user: ${userId}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, userId }
      );
    }
  }

  /**
   * Create user with detailed profile information
   */
  async createUserWithProfile(userId: string, password: string, profile: UserProfile): Promise<AEMResponse<UserOperationResult>> {
    return this.createUser(userId, password, { profile, createHome: true });
  }

  /**
   * Delete user with safety checks
   */
  async deleteUser(userPath: string): Promise<AEMResponse<UserOperationResult>> {
    try {
      this.logger.debug('Deleting user', { userPath });

      if (!userPath) {
        throw new AEMException(
          'User path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Safety check: prevent deletion of system users
      if (this.isSystemUser(userPath)) {
        throw new AEMException(
          `Cannot delete system user: ${userPath}`,
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('deleteAuthorizable', '');

      const requestOptions: RequestOptions = {
        context: {
          operation: 'deleteUser',
          resource: userPath
        }
      };

      const response = await this.client.post<any>(
        userPath,
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to delete user: ${userPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseUserOperationResponse(response.data, userPath);

      this.logger.debug('Successfully deleted user', { 
        userPath,
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
      this.logger.error('Failed to delete user', error as Error, { userPath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while deleting user: ${userPath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, userPath }
      );
    }
  }

  /**
   * Create group
   */
  async createGroup(groupId: string, options: CreateGroupOptions = {}): Promise<AEMResponse<GroupOperationResult>> {
    try {
      this.logger.debug('Creating group', { groupId, options });

      if (!groupId) {
        throw new AEMException(
          'Group ID is required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Validate group ID format
      if (!this.isValidGroupId(groupId)) {
        throw new AEMException(
          'Invalid group ID format. Group IDs must contain only alphanumeric characters, hyphens, and underscores',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('createGroup', '');
      formData.append('authorizableId', groupId);
      
      if (options.intermediatePath) {
        formData.append('intermediatePath', options.intermediatePath);
      }

      // Add profile information
      if (options.profile) {
        for (const [key, value] of Object.entries(options.profile)) {
          if (value !== null && value !== undefined) {
            formData.append(`profile/${key}`, value.toString());
          }
        }
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'createGroup',
          resource: groupId
        }
      };

      const response = await this.client.post<any>(
        '/libs/granite/security/post/authorizables',
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to create group: ${groupId}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseGroupOperationResponse(response.data, groupId);

      this.logger.debug('Successfully created group', { 
        groupId,
        path: result.path
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
      this.logger.error('Failed to create group', error as Error, { groupId });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while creating group: ${groupId}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, groupId }
      );
    }
  }

  /**
   * Delete group with safety checks
   */
  async deleteGroup(groupPath: string): Promise<AEMResponse<GroupOperationResult>> {
    try {
      this.logger.debug('Deleting group', { groupPath });

      if (!groupPath) {
        throw new AEMException(
          'Group path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Safety check: prevent deletion of system groups
      if (this.isSystemGroup(groupPath)) {
        throw new AEMException(
          `Cannot delete system group: ${groupPath}`,
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('deleteAuthorizable', '');

      const requestOptions: RequestOptions = {
        context: {
          operation: 'deleteGroup',
          resource: groupPath
        }
      };

      const response = await this.client.post<any>(
        groupPath,
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to delete group: ${groupPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseGroupOperationResponse(response.data, groupPath);

      this.logger.debug('Successfully deleted group', { 
        groupPath,
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
      this.logger.error('Failed to delete group', error as Error, { groupPath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while deleting group: ${groupPath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, groupPath }
      );
    }
  }

  /**
   * Add user to group
   */
  async addUserToGroup(groupPath: string, userId: string): Promise<AEMResponse<MembershipResult>> {
    try {
      this.logger.debug('Adding user to group', { groupPath, userId });

      if (!groupPath || !userId) {
        throw new AEMException(
          'Group path and user ID are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('addMembers', userId);

      const requestOptions: RequestOptions = {
        context: {
          operation: 'addUserToGroup',
          resource: `${groupPath}/${userId}`
        }
      };

      const response = await this.client.post<any>(
        groupPath,
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to add user ${userId} to group: ${groupPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseMembershipResponse(response.data, [userId], []);

      this.logger.debug('Successfully added user to group', { 
        groupPath,
        userId
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
      this.logger.error('Failed to add user to group', error as Error, { groupPath, userId });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while adding user to group: ${userId}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, groupPath, userId }
      );
    }
  }

  /**
   * Add group to group (nested groups)
   */
  async addGroupToGroup(parentGroupPath: string, childGroupId: string): Promise<AEMResponse<MembershipResult>> {
    try {
      this.logger.debug('Adding group to group', { parentGroupPath, childGroupId });

      if (!parentGroupPath || !childGroupId) {
        throw new AEMException(
          'Parent group path and child group ID are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('addMembers', childGroupId);

      const requestOptions: RequestOptions = {
        context: {
          operation: 'addGroupToGroup',
          resource: `${parentGroupPath}/${childGroupId}`
        }
      };

      const response = await this.client.post<any>(
        parentGroupPath,
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to add group ${childGroupId} to group: ${parentGroupPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseMembershipResponse(response.data, [childGroupId], []);

      this.logger.debug('Successfully added group to group', { 
        parentGroupPath,
        childGroupId
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
      this.logger.error('Failed to add group to group', error as Error, { parentGroupPath, childGroupId });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while adding group to group: ${childGroupId}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, parentGroupPath, childGroupId }
      );
    }
  }

  /**
   * Remove user from group
   */
  async removeUserFromGroup(groupPath: string, userId: string): Promise<AEMResponse<MembershipResult>> {
    try {
      this.logger.debug('Removing user from group', { groupPath, userId });

      if (!groupPath || !userId) {
        throw new AEMException(
          'Group path and user ID are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('removeMembers', userId);

      const requestOptions: RequestOptions = {
        context: {
          operation: 'removeUserFromGroup',
          resource: `${groupPath}/${userId}`
        }
      };

      const response = await this.client.post<any>(
        groupPath,
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to remove user ${userId} from group: ${groupPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseMembershipResponse(response.data, [], [userId]);

      this.logger.debug('Successfully removed user from group', { 
        groupPath,
        userId
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
      this.logger.error('Failed to remove user from group', error as Error, { groupPath, userId });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while removing user from group: ${userId}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, groupPath, userId }
      );
    }
  }

  /**
   * Parse user operation response
   */
  private parseUserOperationResponse(data: any, userId: string): UserOperationResult {
    return {
      success: Boolean(data.success !== false),
      path: data.path || data.home,
      userId: data.authorizableId || userId,
      message: data.message || data.msg,
      warnings: Array.isArray(data.warnings) ? data.warnings : (data.warning ? [data.warning] : []),
      errors: Array.isArray(data.errors) ? data.errors : (data.error ? [data.error] : [])
    };
  }

  /**
   * Parse group operation response
   */
  private parseGroupOperationResponse(data: any, groupId: string): GroupOperationResult {
    return {
      success: Boolean(data.success !== false),
      path: data.path || data.home,
      groupId: data.authorizableId || groupId,
      message: data.message || data.msg,
      warnings: Array.isArray(data.warnings) ? data.warnings : (data.warning ? [data.warning] : []),
      errors: Array.isArray(data.errors) ? data.errors : (data.error ? [data.error] : [])
    };
  }

  /**
   * Parse membership operation response
   */
  private parseMembershipResponse(data: any, addedMembers: string[], removedMembers: string[]): MembershipResult {
    return {
      success: Boolean(data.success !== false),
      message: data.message || data.msg,
      addedMembers: addedMembers.length > 0 ? addedMembers : undefined,
      removedMembers: removedMembers.length > 0 ? removedMembers : undefined,
      warnings: Array.isArray(data.warnings) ? data.warnings : (data.warning ? [data.warning] : []),
      errors: Array.isArray(data.errors) ? data.errors : (data.error ? [data.error] : [])
    };
  }

  /**
   * Validate user ID format
   */
  private isValidUserId(userId: string): boolean {
    // AEM user ID restrictions
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    const reservedNames = ['admin', 'anonymous', 'system', 'service'];
    
    return validPattern.test(userId) && 
           userId.length > 0 && 
           userId.length <= 150 &&
           !reservedNames.includes(userId.toLowerCase()) &&
           !userId.startsWith('rep:') &&
           !userId.startsWith('jcr:');
  }

  /**
   * Validate group ID format
   */
  private isValidGroupId(groupId: string): boolean {
    // AEM group ID restrictions
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    const reservedNames = ['administrators', 'everyone', 'user-administrators', 'workflow-editors', 'workflow-users'];
    
    return validPattern.test(groupId) && 
           groupId.length > 0 && 
           groupId.length <= 150 &&
           !reservedNames.includes(groupId.toLowerCase()) &&
           !groupId.startsWith('rep:') &&
           !groupId.startsWith('jcr:');
  }

  /**
   * Check if user is a system user that should not be deleted
   */
  private isSystemUser(userPath: string): boolean {
    const systemUserPaths = [
      '/home/users/system',
      '/home/users/a/admin',
      '/home/users/a/anonymous'
    ];

    const systemUserNames = ['admin', 'anonymous', 'system'];
    const userName = userPath.split('/').pop()?.toLowerCase() || '';

    return systemUserPaths.some(path => userPath.startsWith(path)) ||
           systemUserNames.includes(userName);
  }

  /**
   * Check if group is a system group that should not be deleted
   */
  private isSystemGroup(groupPath: string): boolean {
    const systemGroupPaths = [
      '/home/groups/system'
    ];

    const systemGroupNames = ['administrators', 'everyone', 'user-administrators', 'workflow-editors', 'workflow-users'];
    const groupName = groupPath.split('/').pop()?.toLowerCase() || '';

    return systemGroupPaths.some(path => groupPath.startsWith(path)) ||
           systemGroupNames.includes(groupName);
  }
}
