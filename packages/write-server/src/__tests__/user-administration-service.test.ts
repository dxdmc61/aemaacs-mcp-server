/**
 * Unit tests for User Administration Service
 */

import { UserAdministrationService, UserProfile, CreateUserOptions, CreateGroupOptions, UserOperationResult, GroupOperationResult, MembershipResult } from '../services/user-administration-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('UserAdministrationService', () => {
  let userAdminService: UserAdministrationService;
  let mockClient: jest.Mocked<AEMHttpClient>;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      upload: jest.fn(),
      getStats: jest.fn(),
      clearCache: jest.fn(),
      resetCircuitBreaker: jest.fn(),
      close: jest.fn()
    } as unknown as jest.Mocked<AEMHttpClient>;

    userAdminService = new UserAdministrationService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    const mockCreateUserResponse = {
      success: true,
      data: {
        success: true,
        path: '/home/users/t/testuser',
        authorizableId: 'testuser',
        message: 'User created successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 150
      }
    };

    it('should create user successfully', async () => {
      const userId = 'testuser';
      const password = 'password123';
      const options: CreateUserOptions = {
        profile: {
          givenName: 'Test',
          familyName: 'User',
          email: 'test.user@example.com',
          jobTitle: 'Developer'
        },
        intermediatePath: 't',
        createHome: true
      };

      mockClient.post.mockResolvedValue(mockCreateUserResponse);

      const result = await userAdminService.createUser(userId, password, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe('/home/users/t/testuser');
      expect(result.data!.userId).toBe('testuser');
      expect(result.data!.message).toBe('User created successfully');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/libs/granite/security/post/authorizables',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'createUser',
            resource: userId
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('createUser')).toBe('');
      expect(formData.get('authorizableId')).toBe(userId);
      expect(formData.get('rep:password')).toBe(password);
      expect(formData.get('intermediatePath')).toBe('t');
      expect(formData.get('createHome')).toBe('true');
      expect(formData.get('profile/givenName')).toBe('Test');
      expect(formData.get('profile/email')).toBe('test.user@example.com');
    });

    it('should throw validation error for missing required fields', async () => {
      await expect(userAdminService.createUser('', 'password')).rejects.toThrow(AEMException);
      await expect(userAdminService.createUser('user', '')).rejects.toThrow(AEMException);
      await expect(userAdminService.createUser('', '')).rejects.toThrow('User ID and password are required');
    });

    it('should throw validation error for invalid user ID', async () => {
      const invalidUserIds = ['user@name', 'user name', 'user.name', 'user/name', 'user\\name', 'user:name', 'admin', 'system', 'rep:user'];
      
      for (const invalidUserId of invalidUserIds) {
        await expect(userAdminService.createUser(invalidUserId, 'password')).rejects.toThrow(AEMException);
        await expect(userAdminService.createUser(invalidUserId, 'password')).rejects.toThrow('Invalid user ID format');
      }
    });

    it('should handle server errors gracefully', async () => {
      const errorResponse = {
        success: false,
        error: { 
          code: 'SERVER_ERROR', 
          message: 'Internal server error',
          recoverable: true
        }
      };
      mockClient.post.mockResolvedValue(errorResponse);

      await expect(userAdminService.createUser('testuser', 'password')).rejects.toThrow(AEMException);
      await expect(userAdminService.createUser('testuser', 'password')).rejects.toThrow('Failed to create user');
    });
  });

  describe('createUserWithProfile', () => {
    it('should create user with profile successfully', async () => {
      const userId = 'testuser';
      const password = 'password123';
      const profile: UserProfile = {
        givenName: 'Test',
        familyName: 'User',
        email: 'test.user@example.com',
        jobTitle: 'Developer',
        phoneNumber: '+1-555-0123'
      };

      const mockResponse = {
        success: true,
        data: {
          success: true,
          path: '/home/users/t/testuser',
          authorizableId: 'testuser'
        }
      };

      mockClient.post.mockResolvedValue(mockResponse);

      const result = await userAdminService.createUserWithProfile(userId, password, profile);

      expect(result.success).toBe(true);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/libs/granite/security/post/authorizables',
        expect.any(Object),
        expect.any(Object)
      );
      
      // Verify profile data was passed
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('createHome')).toBe('true');
      expect(formData.get('profile/givenName')).toBe('Test');
      expect(formData.get('profile/familyName')).toBe('User');
      expect(formData.get('profile/email')).toBe('test.user@example.com');
      expect(formData.get('profile/jobTitle')).toBe('Developer');
      expect(formData.get('profile/phoneNumber')).toBe('+1-555-0123');
    });
  });

  describe('deleteUser', () => {
    const mockDeleteUserResponse = {
      success: true,
      data: {
        success: true,
        message: 'User deleted successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100
      }
    };

    it('should delete user successfully', async () => {
      const userPath = '/home/users/t/testuser';

      mockClient.post.mockResolvedValue(mockDeleteUserResponse);

      const result = await userAdminService.deleteUser(userPath);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.message).toBe('User deleted successfully');

      expect(mockClient.post).toHaveBeenCalledWith(
        userPath,
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'deleteUser',
            resource: userPath
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('deleteAuthorizable')).toBe('');
    });

    it('should throw validation error for empty user path', async () => {
      await expect(userAdminService.deleteUser('')).rejects.toThrow(AEMException);
      await expect(userAdminService.deleteUser('')).rejects.toThrow('User path is required');
    });

    it('should prevent deletion of system users', async () => {
      const systemUsers = [
        '/home/users/system/test',
        '/home/users/a/admin',
        '/home/users/a/anonymous',
        '/home/users/s/system'
      ];

      for (const systemUser of systemUsers) {
        await expect(userAdminService.deleteUser(systemUser)).rejects.toThrow(AEMException);
        await expect(userAdminService.deleteUser(systemUser)).rejects.toThrow('Cannot delete system user');
      }
    });

    it('should allow deletion of regular users', async () => {
      const regularUsers = [
        '/home/users/t/testuser',
        '/home/users/j/john-doe',
        '/home/users/m/mary-smith'
      ];

      mockClient.post.mockResolvedValue(mockDeleteUserResponse);

      for (const regularUser of regularUsers) {
        const result = await userAdminService.deleteUser(regularUser);
        expect(result.success).toBe(true);
        jest.clearAllMocks();
        mockClient.post.mockResolvedValue(mockDeleteUserResponse);
      }
    });
  });

  describe('createGroup', () => {
    const mockCreateGroupResponse = {
      success: true,
      data: {
        success: true,
        path: '/home/groups/t/testgroup',
        authorizableId: 'testgroup',
        message: 'Group created successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 120
      }
    };

    it('should create group successfully', async () => {
      const groupId = 'testgroup';
      const options: CreateGroupOptions = {
        intermediatePath: 't',
        profile: {
          'jcr:title': 'Test Group',
          'jcr:description': 'A test group for developers'
        }
      };

      mockClient.post.mockResolvedValue(mockCreateGroupResponse);

      const result = await userAdminService.createGroup(groupId, options);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.path).toBe('/home/groups/t/testgroup');
      expect(result.data!.groupId).toBe('testgroup');
      expect(result.data!.message).toBe('Group created successfully');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/libs/granite/security/post/authorizables',
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'createGroup',
            resource: groupId
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('createGroup')).toBe('');
      expect(formData.get('authorizableId')).toBe(groupId);
      expect(formData.get('intermediatePath')).toBe('t');
      expect(formData.get('profile/jcr:title')).toBe('Test Group');
      expect(formData.get('profile/jcr:description')).toBe('A test group for developers');
    });

    it('should throw validation error for missing group ID', async () => {
      await expect(userAdminService.createGroup('')).rejects.toThrow(AEMException);
      await expect(userAdminService.createGroup('')).rejects.toThrow('Group ID is required');
    });

    it('should throw validation error for invalid group ID', async () => {
      const invalidGroupIds = ['group@name', 'group name', 'group.name', 'group/name', 'group\\name', 'administrators', 'everyone', 'rep:group'];
      
      for (const invalidGroupId of invalidGroupIds) {
        await expect(userAdminService.createGroup(invalidGroupId)).rejects.toThrow(AEMException);
        await expect(userAdminService.createGroup(invalidGroupId)).rejects.toThrow('Invalid group ID format');
      }
    });
  });

  describe('deleteGroup', () => {
    const mockDeleteGroupResponse = {
      success: true,
      data: {
        success: true,
        message: 'Group deleted successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100
      }
    };

    it('should delete group successfully', async () => {
      const groupPath = '/home/groups/t/testgroup';

      mockClient.post.mockResolvedValue(mockDeleteGroupResponse);

      const result = await userAdminService.deleteGroup(groupPath);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.message).toBe('Group deleted successfully');

      expect(mockClient.post).toHaveBeenCalledWith(
        groupPath,
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'deleteGroup',
            resource: groupPath
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('deleteAuthorizable')).toBe('');
    });

    it('should throw validation error for empty group path', async () => {
      await expect(userAdminService.deleteGroup('')).rejects.toThrow(AEMException);
      await expect(userAdminService.deleteGroup('')).rejects.toThrow('Group path is required');
    });

    it('should prevent deletion of system groups', async () => {
      const systemGroups = [
        '/home/groups/system/test',
        '/home/groups/a/administrators',
        '/home/groups/e/everyone',
        '/home/groups/u/user-administrators'
      ];

      for (const systemGroup of systemGroups) {
        await expect(userAdminService.deleteGroup(systemGroup)).rejects.toThrow(AEMException);
        await expect(userAdminService.deleteGroup(systemGroup)).rejects.toThrow('Cannot delete system group');
      }
    });

    it('should allow deletion of regular groups', async () => {
      const regularGroups = [
        '/home/groups/t/testgroup',
        '/home/groups/d/developers',
        '/home/groups/c/content-authors'
      ];

      mockClient.post.mockResolvedValue(mockDeleteGroupResponse);

      for (const regularGroup of regularGroups) {
        const result = await userAdminService.deleteGroup(regularGroup);
        expect(result.success).toBe(true);
        jest.clearAllMocks();
        mockClient.post.mockResolvedValue(mockDeleteGroupResponse);
      }
    });
  });

  describe('addUserToGroup', () => {
    const mockMembershipResponse = {
      success: true,
      data: {
        success: true,
        message: 'User added to group successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 80
      }
    };

    it('should add user to group successfully', async () => {
      const groupPath = '/home/groups/t/testgroup';
      const userId = 'testuser';

      mockClient.post.mockResolvedValue(mockMembershipResponse);

      const result = await userAdminService.addUserToGroup(groupPath, userId);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.message).toBe('User added to group successfully');
      expect(result.data!.addedMembers).toEqual(['testuser']);

      expect(mockClient.post).toHaveBeenCalledWith(
        groupPath,
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'addUserToGroup',
            resource: `${groupPath}/${userId}`
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('addMembers')).toBe(userId);
    });

    it('should throw validation error for missing required fields', async () => {
      await expect(userAdminService.addUserToGroup('', 'user')).rejects.toThrow(AEMException);
      await expect(userAdminService.addUserToGroup('/group', '')).rejects.toThrow(AEMException);
      await expect(userAdminService.addUserToGroup('', '')).rejects.toThrow('Group path and user ID are required');
    });
  });

  describe('addGroupToGroup', () => {
    const mockMembershipResponse = {
      success: true,
      data: {
        success: true,
        message: 'Group added to group successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 80
      }
    };

    it('should add group to group successfully', async () => {
      const parentGroupPath = '/home/groups/p/parentgroup';
      const childGroupId = 'childgroup';

      mockClient.post.mockResolvedValue(mockMembershipResponse);

      const result = await userAdminService.addGroupToGroup(parentGroupPath, childGroupId);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.message).toBe('Group added to group successfully');
      expect(result.data!.addedMembers).toEqual(['childgroup']);

      expect(mockClient.post).toHaveBeenCalledWith(
        parentGroupPath,
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'addGroupToGroup',
            resource: `${parentGroupPath}/${childGroupId}`
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('addMembers')).toBe(childGroupId);
    });

    it('should throw validation error for missing required fields', async () => {
      await expect(userAdminService.addGroupToGroup('', 'group')).rejects.toThrow(AEMException);
      await expect(userAdminService.addGroupToGroup('/group', '')).rejects.toThrow(AEMException);
      await expect(userAdminService.addGroupToGroup('', '')).rejects.toThrow('Parent group path and child group ID are required');
    });
  });

  describe('removeUserFromGroup', () => {
    const mockMembershipResponse = {
      success: true,
      data: {
        success: true,
        message: 'User removed from group successfully'
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 80
      }
    };

    it('should remove user from group successfully', async () => {
      const groupPath = '/home/groups/t/testgroup';
      const userId = 'testuser';

      mockClient.post.mockResolvedValue(mockMembershipResponse);

      const result = await userAdminService.removeUserFromGroup(groupPath, userId);

      expect(result.success).toBe(true);
      expect(result.data!.success).toBe(true);
      expect(result.data!.message).toBe('User removed from group successfully');
      expect(result.data!.removedMembers).toEqual(['testuser']);

      expect(mockClient.post).toHaveBeenCalledWith(
        groupPath,
        expect.any(Object), // FormData
        expect.objectContaining({
          context: {
            operation: 'removeUserFromGroup',
            resource: `${groupPath}/${userId}`
          }
        })
      );
      
      // Verify form data
      const formData = mockClient.post.mock.calls[0][1] as FormData;
      expect(formData.get('removeMembers')).toBe(userId);
    });

    it('should throw validation error for missing required fields', async () => {
      await expect(userAdminService.removeUserFromGroup('', 'user')).rejects.toThrow(AEMException);
      await expect(userAdminService.removeUserFromGroup('/group', '')).rejects.toThrow(AEMException);
      await expect(userAdminService.removeUserFromGroup('', '')).rejects.toThrow('Group path and user ID are required');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockClient.post.mockRejectedValue(networkError);

      await expect(userAdminService.createUser('testuser', 'password')).rejects.toThrow(AEMException);
      await expect(userAdminService.createUser('testuser', 'password')).rejects.toThrow('Unexpected error while creating user');
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.post.mockRejectedValue(originalError);

      await expect(userAdminService.createGroup('testgroup')).rejects.toThrow('Original error');
    });

    it('should handle malformed responses', async () => {
      const malformedResponse = {
        success: false,
        data: null
      };
      mockClient.post.mockResolvedValue(malformedResponse);

      await expect(userAdminService.deleteUser('/home/users/t/testuser')).rejects.toThrow(AEMException);
      await expect(userAdminService.deleteUser('/home/users/t/testuser')).rejects.toThrow('Failed to delete user');
    });
  });

  describe('validation', () => {
    it('should validate user IDs correctly', async () => {
      const validUserIds = ['testuser', 'test-user', 'test_user', 'user123'];
      const invalidUserIds = ['test user', 'test@user', 'test.user', 'test/user', 'test\\user', 'admin', 'system', 'anonymous', 'rep:user', 'jcr:user'];

      const mockResponse = {
        success: true,
        data: { success: true }
      };

      mockClient.post.mockResolvedValue(mockResponse);

      // Valid user IDs should work
      for (const validUserId of validUserIds) {
        const result = await userAdminService.createUser(validUserId, 'password');
        expect(result.success).toBe(true);
        jest.clearAllMocks();
        mockClient.post.mockResolvedValue(mockResponse);
      }

      // Invalid user IDs should throw errors
      for (const invalidUserId of invalidUserIds) {
        await expect(userAdminService.createUser(invalidUserId, 'password')).rejects.toThrow(AEMException);
      }
    });

    it('should validate group IDs correctly', async () => {
      const validGroupIds = ['testgroup', 'test-group', 'test_group', 'group123'];
      const invalidGroupIds = ['test group', 'test@group', 'test.group', 'test/group', 'test\\group', 'administrators', 'everyone', 'user-administrators', 'rep:group', 'jcr:group'];

      const mockResponse = {
        success: true,
        data: { success: true }
      };

      mockClient.post.mockResolvedValue(mockResponse);

      // Valid group IDs should work
      for (const validGroupId of validGroupIds) {
        const result = await userAdminService.createGroup(validGroupId);
        expect(result.success).toBe(true);
        jest.clearAllMocks();
        mockClient.post.mockResolvedValue(mockResponse);
      }

      // Invalid group IDs should throw errors
      for (const invalidGroupId of invalidGroupIds) {
        await expect(userAdminService.createGroup(invalidGroupId)).rejects.toThrow(AEMException);
      }
    });

    it('should reject names that are too long', async () => {
      const longUserId = 'a'.repeat(151); // Over 150 character limit
      const longGroupId = 'g'.repeat(151); // Over 150 character limit
      
      await expect(userAdminService.createUser(longUserId, 'password')).rejects.toThrow(AEMException);
      await expect(userAdminService.createGroup(longGroupId)).rejects.toThrow(AEMException);
    });
  });

  describe('system protection', () => {
    it('should identify system users correctly', async () => {
      const systemUsers = [
        '/home/users/system/test',
        '/home/users/a/admin',
        '/home/users/a/anonymous',
        '/home/users/s/system'
      ];

      for (const systemUser of systemUsers) {
        await expect(userAdminService.deleteUser(systemUser)).rejects.toThrow('Cannot delete system user');
      }
    });

    it('should identify system groups correctly', async () => {
      const systemGroups = [
        '/home/groups/system/test',
        '/home/groups/a/administrators',
        '/home/groups/e/everyone',
        '/home/groups/u/user-administrators',
        '/home/groups/w/workflow-editors',
        '/home/groups/w/workflow-users'
      ];

      for (const systemGroup of systemGroups) {
        await expect(userAdminService.deleteGroup(systemGroup)).rejects.toThrow('Cannot delete system group');
      }
    });

    it('should allow deletion of regular users and groups', async () => {
      const regularUsers = [
        '/home/users/t/testuser',
        '/home/users/j/john-doe',
        '/home/users/m/mary-smith'
      ];

      const regularGroups = [
        '/home/groups/t/testgroup',
        '/home/groups/d/developers',
        '/home/groups/c/content-authors'
      ];

      const mockResponse = {
        success: true,
        data: { success: true, message: 'Deleted' }
      };

      mockClient.post.mockResolvedValue(mockResponse);

      for (const regularUser of regularUsers) {
        const result = await userAdminService.deleteUser(regularUser);
        expect(result.success).toBe(true);
        jest.clearAllMocks();
        mockClient.post.mockResolvedValue(mockResponse);
      }

      for (const regularGroup of regularGroups) {
        const result = await userAdminService.deleteGroup(regularGroup);
        expect(result.success).toBe(true);
        jest.clearAllMocks();
        mockClient.post.mockResolvedValue(mockResponse);
      }
    });
  });
});
