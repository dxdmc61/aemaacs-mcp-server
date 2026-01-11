/**
 * User Administration Service for AEMaaCS read operations
 * Handles user and group management, profile information, and permissions
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse, User, Group, Permission } from '@aemaacs-mcp/shared';
export interface ListUsersOptions {
    path?: string;
    query?: string;
    includeSystemUsers?: boolean;
    includeServiceUsers?: boolean;
    orderBy?: 'name' | 'created' | 'lastModified';
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}
export interface ListGroupsOptions {
    path?: string;
    query?: string;
    includeSystemGroups?: boolean;
    orderBy?: 'name' | 'created' | 'lastModified';
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}
export interface UserDetails extends User {
    created?: Date;
    lastModified?: Date;
    lastLogin?: Date;
    disabled?: boolean;
    reason?: string;
    preferences?: Record<string, any>;
}
export interface GroupDetails extends Group {
    created?: Date;
    lastModified?: Date;
    memberCount?: number;
    nestedGroups?: string[];
}
export interface GroupMembership {
    groupId: string;
    groupPath: string;
    groupTitle?: string;
    memberType: 'direct' | 'inherited';
    inheritedFrom?: string;
}
export interface UserPermissions {
    userId: string;
    userPath: string;
    permissions: Permission[];
    effectivePermissions: Permission[];
    deniedPermissions: Permission[];
}
export declare class UserAdministrationService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * List users with profile information
     */
    listUsers(options?: ListUsersOptions): Promise<AEMResponse<UserDetails[]>>;
    /**
     * List groups with membership details
     */
    listGroups(options?: ListGroupsOptions): Promise<AEMResponse<GroupDetails[]>>;
    /**
     * Get detailed user information
     */
    getUserProfile(userId: string): Promise<AEMResponse<UserDetails>>;
    /**
     * Get group members
     */
    getGroupMembers(groupId: string): Promise<AEMResponse<string[]>>;
    /**
     * Get user groups
     */
    getUserGroups(userId: string): Promise<AEMResponse<GroupMembership[]>>;
    /**
     * Get user permissions
     */
    getUserPermissions(userId: string): Promise<AEMResponse<UserPermissions>>;
    /**
     * Find user path by user ID
     */
    private findUserPath;
    /**
     * Find group path by group ID
     */
    private findGroupPath;
    /**
     * Parse user list response
     */
    private parseUserListResponse;
    /**
     * Parse group list response
     */
    private parseGroupListResponse;
    /**
     * Parse user details response
     */
    private parseUserDetailsResponse;
    /**
     * Parse user profile from data
     */
    private parseUserProfile;
    /**
     * Parse group members response
     */
    private parseGroupMembersResponse;
    /**
     * Parse user groups response
     */
    private parseUserGroupsResponse;
    /**
     * Parse user permissions response
     */
    private parseUserPermissionsResponse;
}
//# sourceMappingURL=user-administration-service.d.ts.map