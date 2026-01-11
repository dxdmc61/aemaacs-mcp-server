/**
 * User Administration Service for AEMaaCS write operations
 * Handles user and group creation, deletion, and membership management
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
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
export declare class UserAdministrationService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Create user using /libs/granite/security/post/authorizables
     */
    createUser(userId: string, password: string, options?: CreateUserOptions): Promise<AEMResponse<UserOperationResult>>;
    /**
     * Create user with detailed profile information
     */
    createUserWithProfile(userId: string, password: string, profile: UserProfile): Promise<AEMResponse<UserOperationResult>>;
    /**
     * Delete user with safety checks
     */
    deleteUser(userPath: string): Promise<AEMResponse<UserOperationResult>>;
    /**
     * Create group
     */
    createGroup(groupId: string, options?: CreateGroupOptions): Promise<AEMResponse<GroupOperationResult>>;
    /**
     * Delete group with safety checks
     */
    deleteGroup(groupPath: string): Promise<AEMResponse<GroupOperationResult>>;
    /**
     * Add user to group
     */
    addUserToGroup(groupPath: string, userId: string): Promise<AEMResponse<MembershipResult>>;
    /**
     * Add group to group (nested groups)
     */
    addGroupToGroup(parentGroupPath: string, childGroupId: string): Promise<AEMResponse<MembershipResult>>;
    /**
     * Remove user from group
     */
    removeUserFromGroup(groupPath: string, userId: string): Promise<AEMResponse<MembershipResult>>;
    /**
     * Parse user operation response
     */
    private parseUserOperationResponse;
    /**
     * Parse group operation response
     */
    private parseGroupOperationResponse;
    /**
     * Parse membership operation response
     */
    private parseMembershipResponse;
    /**
     * Validate user ID format
     */
    private isValidUserId;
    /**
     * Validate group ID format
     */
    private isValidGroupId;
    /**
     * Check if user is a system user that should not be deleted
     */
    private isSystemUser;
    /**
     * Check if group is a system group that should not be deleted
     */
    private isSystemGroup;
}
//# sourceMappingURL=user-administration-service.d.ts.map