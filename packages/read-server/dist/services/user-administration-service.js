/**
 * User Administration Service for AEMaaCS read operations
 * Handles user and group management, profile information, and permissions
 */
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';
export class UserAdministrationService {
    constructor(client) {
        this.client = client;
        this.logger = Logger.getInstance();
    }
    /**
     * List users with profile information
     */
    async listUsers(options = {}) {
        try {
            this.logger.debug('Listing users', { options });
            const params = {
                'path': options.path || '/home/users',
                'type': 'rep:User',
                'p.limit': options.limit || 50,
                'p.offset': options.offset || 0
            };
            // Add query filter
            if (options.query) {
                params['fulltext'] = options.query;
            }
            // Filter system users if not requested
            if (!options.includeSystemUsers) {
                params['property'] = 'rep:principalName';
                params['property.operation'] = 'not';
                params['property.value'] = 'system-%';
            }
            // Add ordering
            if (options.orderBy) {
                switch (options.orderBy) {
                    case 'name':
                        params['orderby'] = '@rep:principalName';
                        break;
                    case 'created':
                        params['orderby'] = '@jcr:created';
                        break;
                    case 'lastModified':
                        params['orderby'] = '@jcr:lastModified';
                        break;
                }
                if (options.orderDirection) {
                    params['orderby.sort'] = options.orderDirection;
                }
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'listUsers',
                    resource: options.path || '/home/users'
                }
            };
            const response = await this.client.get('/bin/querybuilder.json', params, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to list users', 'SERVER_ERROR', true, undefined, { response });
            }
            const users = this.parseUserListResponse(response.data);
            this.logger.debug('Successfully listed users', {
                userCount: users.length
            });
            return {
                success: true,
                data: users,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to list users', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while listing users', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * List groups with membership details
     */
    async listGroups(options = {}) {
        try {
            this.logger.debug('Listing groups', { options });
            const params = {
                'path': options.path || '/home/groups',
                'type': 'rep:Group',
                'p.limit': options.limit || 50,
                'p.offset': options.offset || 0
            };
            // Add query filter
            if (options.query) {
                params['fulltext'] = options.query;
            }
            // Filter system groups if not requested
            if (!options.includeSystemGroups) {
                params['property'] = 'rep:principalName';
                params['property.operation'] = 'not';
                params['property.value'] = 'system-%';
            }
            // Add ordering
            if (options.orderBy) {
                switch (options.orderBy) {
                    case 'name':
                        params['orderby'] = '@rep:principalName';
                        break;
                    case 'created':
                        params['orderby'] = '@jcr:created';
                        break;
                    case 'lastModified':
                        params['orderby'] = '@jcr:lastModified';
                        break;
                }
                if (options.orderDirection) {
                    params['orderby.sort'] = options.orderDirection;
                }
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'listGroups',
                    resource: options.path || '/home/groups'
                }
            };
            const response = await this.client.get('/bin/querybuilder.json', params, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to list groups', 'SERVER_ERROR', true, undefined, { response });
            }
            const groups = this.parseGroupListResponse(response.data);
            this.logger.debug('Successfully listed groups', {
                groupCount: groups.length
            });
            return {
                success: true,
                data: groups,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to list groups', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while listing groups', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * Get detailed user information
     */
    async getUserProfile(userId) {
        try {
            this.logger.debug('Getting user profile', { userId });
            if (!userId) {
                throw new AEMException('User ID is required', 'VALIDATION_ERROR', false);
            }
            // Find user path first
            const userPath = await this.findUserPath(userId);
            const requestOptions = {
                cache: true,
                cacheTtl: 180000, // Cache for 3 minutes
                context: {
                    operation: 'getUserProfile',
                    resource: userPath
                }
            };
            // Get user details
            const response = await this.client.get(`${userPath}.json`, undefined, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`User not found: ${userId}`, 'NOT_FOUND_ERROR', false, undefined, { userId });
            }
            const userDetails = this.parseUserDetailsResponse(response.data, userPath);
            this.logger.debug('Successfully retrieved user profile', {
                userId,
                userPath
            });
            return {
                success: true,
                data: userDetails,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get user profile', error, { userId });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting user profile for ${userId}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, userId });
        }
    }
    /**
     * Get group members
     */
    async getGroupMembers(groupId) {
        try {
            this.logger.debug('Getting group members', { groupId });
            if (!groupId) {
                throw new AEMException('Group ID is required', 'VALIDATION_ERROR', false);
            }
            // Find group path first
            const groupPath = await this.findGroupPath(groupId);
            const requestOptions = {
                cache: true,
                cacheTtl: 180000, // Cache for 3 minutes
                context: {
                    operation: 'getGroupMembers',
                    resource: groupPath
                }
            };
            // Get group details
            const response = await this.client.get(`${groupPath}.json`, undefined, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Group not found: ${groupId}`, 'NOT_FOUND_ERROR', false, undefined, { groupId });
            }
            const members = this.parseGroupMembersResponse(response.data);
            this.logger.debug('Successfully retrieved group members', {
                groupId,
                memberCount: members.length
            });
            return {
                success: true,
                data: members,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get group members', error, { groupId });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting group members for ${groupId}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, groupId });
        }
    }
    /**
     * Get user groups
     */
    async getUserGroups(userId) {
        try {
            this.logger.debug('Getting user groups', { userId });
            if (!userId) {
                throw new AEMException('User ID is required', 'VALIDATION_ERROR', false);
            }
            // Find user path first
            const userPath = await this.findUserPath(userId);
            const requestOptions = {
                cache: true,
                cacheTtl: 180000, // Cache for 3 minutes
                context: {
                    operation: 'getUserGroups',
                    resource: userPath
                }
            };
            // Get user details to find groups
            const response = await this.client.get(`${userPath}.json`, undefined, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`User not found: ${userId}`, 'NOT_FOUND_ERROR', false, undefined, { userId });
            }
            const groupMemberships = await this.parseUserGroupsResponse(response.data, userId);
            this.logger.debug('Successfully retrieved user groups', {
                userId,
                groupCount: groupMemberships.length
            });
            return {
                success: true,
                data: groupMemberships,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get user groups', error, { userId });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting user groups for ${userId}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, userId });
        }
    }
    /**
     * Get user permissions
     */
    async getUserPermissions(userId) {
        try {
            this.logger.debug('Getting user permissions', { userId });
            if (!userId) {
                throw new AEMException('User ID is required', 'VALIDATION_ERROR', false);
            }
            // Find user path first
            const userPath = await this.findUserPath(userId);
            const requestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'getUserPermissions',
                    resource: userPath
                }
            };
            // Get user permissions using the security API
            const response = await this.client.get('/libs/granite/security/currentuser.json', { userId }, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to get permissions for user: ${userId}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const userPermissions = this.parseUserPermissionsResponse(response.data, userId, userPath);
            this.logger.debug('Successfully retrieved user permissions', {
                userId,
                permissionCount: userPermissions.permissions.length
            });
            return {
                success: true,
                data: userPermissions,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get user permissions', error, { userId });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting user permissions for ${userId}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, userId });
        }
    }
    /**
     * Find user path by user ID
     */
    async findUserPath(userId) {
        const params = {
            'path': '/home/users',
            'type': 'rep:User',
            'property': 'rep:principalName',
            'property.value': userId,
            'p.limit': 1
        };
        const response = await this.client.get('/bin/querybuilder.json', params);
        if (!response.success || !response.data || !response.data.hits || response.data.hits.length === 0) {
            throw new AEMException(`User not found: ${userId}`, 'NOT_FOUND_ERROR', false, undefined, { userId });
        }
        return response.data.hits[0].path;
    }
    /**
     * Find group path by group ID
     */
    async findGroupPath(groupId) {
        const params = {
            'path': '/home/groups',
            'type': 'rep:Group',
            'property': 'rep:principalName',
            'property.value': groupId,
            'p.limit': 1
        };
        const response = await this.client.get('/bin/querybuilder.json', params);
        if (!response.success || !response.data || !response.data.hits || response.data.hits.length === 0) {
            throw new AEMException(`Group not found: ${groupId}`, 'NOT_FOUND_ERROR', false, undefined, { groupId });
        }
        return response.data.hits[0].path;
    }
    /**
     * Parse user list response
     */
    parseUserListResponse(data) {
        const hits = data.hits || [];
        return hits.map((hit) => ({
            id: hit['rep:principalName'] || hit.name || hit.path.split('/').pop(),
            path: hit.path,
            profile: this.parseUserProfile(hit),
            groups: hit['rep:groups'] || [],
            permissions: [], // Would need separate call to get permissions
            created: hit['jcr:created'] ? new Date(hit['jcr:created']) : undefined,
            lastModified: hit['jcr:lastModified'] ? new Date(hit['jcr:lastModified']) : undefined,
            lastLogin: hit['rep:lastLogin'] ? new Date(hit['rep:lastLogin']) : undefined,
            disabled: Boolean(hit['rep:disabled']),
            reason: hit['rep:disabledReason'],
            preferences: hit.preferences || {}
        }));
    }
    /**
     * Parse group list response
     */
    parseGroupListResponse(data) {
        const hits = data.hits || [];
        return hits.map((hit) => ({
            id: hit['rep:principalName'] || hit.name || hit.path.split('/').pop(),
            path: hit.path,
            title: hit['jcr:title'] || hit['rep:principalName'] || hit.name,
            description: hit['jcr:description'],
            members: hit['rep:members'] || [],
            created: hit['jcr:created'] ? new Date(hit['jcr:created']) : undefined,
            lastModified: hit['jcr:lastModified'] ? new Date(hit['jcr:lastModified']) : undefined,
            memberCount: hit['rep:members'] ? hit['rep:members'].length : 0,
            nestedGroups: hit['rep:groups'] || []
        }));
    }
    /**
     * Parse user details response
     */
    parseUserDetailsResponse(data, userPath) {
        return {
            id: data['rep:principalName'] || data.name || userPath.split('/').pop(),
            path: userPath,
            profile: this.parseUserProfile(data),
            groups: data['rep:groups'] || [],
            permissions: [], // Would need separate call to get permissions
            created: data['jcr:created'] ? new Date(data['jcr:created']) : undefined,
            lastModified: data['jcr:lastModified'] ? new Date(data['jcr:lastModified']) : undefined,
            lastLogin: data['rep:lastLogin'] ? new Date(data['rep:lastLogin']) : undefined,
            disabled: Boolean(data['rep:disabled']),
            reason: data['rep:disabledReason'],
            preferences: data.preferences || {}
        };
    }
    /**
     * Parse user profile from data
     */
    parseUserProfile(data) {
        const profile = data.profile || {};
        return {
            givenName: profile.givenName || data['profile/givenName'],
            familyName: profile.familyName || data['profile/familyName'],
            email: profile.email || data['profile/email'],
            title: profile.title || data['profile/title'],
            ...profile
        };
    }
    /**
     * Parse group members response
     */
    parseGroupMembersResponse(data) {
        return data['rep:members'] || [];
    }
    /**
     * Parse user groups response
     */
    async parseUserGroupsResponse(data, userId) {
        const groups = data['rep:groups'] || [];
        const memberships = [];
        for (const groupId of groups) {
            try {
                const groupPath = await this.findGroupPath(groupId);
                // Get group details for title
                const groupResponse = await this.client.get(`${groupPath}.json`);
                const groupTitle = groupResponse.data?.['jcr:title'] || groupId;
                memberships.push({
                    groupId,
                    groupPath,
                    groupTitle,
                    memberType: 'direct' // For now, assume all are direct memberships
                });
            }
            catch (error) {
                // Skip groups that can't be found
                this.logger.warn(`Could not find group: ${groupId}`, error);
            }
        }
        return memberships;
    }
    /**
     * Parse user permissions response
     */
    parseUserPermissionsResponse(data, userId, userPath) {
        const permissions = [];
        const effectivePermissions = [];
        const deniedPermissions = [];
        // Parse permissions from the response
        if (data.permissions && Array.isArray(data.permissions)) {
            for (const perm of data.permissions) {
                const permission = {
                    path: perm.path || '/',
                    privileges: perm.privileges || [],
                    allow: Boolean(perm.allow)
                };
                permissions.push(permission);
                if (permission.allow) {
                    effectivePermissions.push(permission);
                }
                else {
                    deniedPermissions.push(permission);
                }
            }
        }
        return {
            userId,
            userPath,
            permissions,
            effectivePermissions,
            deniedPermissions
        };
    }
}
//# sourceMappingURL=user-administration-service.js.map