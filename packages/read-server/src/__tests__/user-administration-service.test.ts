/**
 * Unit tests for User Administration Service
 */

import { UserAdministrationService, ListUsersOptions, ListGroupsOptions, UserDetails, GroupDetails, GroupMembership, UserPermissions } from '../services/user-administration-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
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

  describe('listUsers', () => {
    const mockUserListResponse = {
      success: true,
      data: {
        hits: [
          {
            path: '/home/users/j/john-doe',
            'rep:principalName': 'john-doe',
            name: 'john-doe',
            'jcr:created': '2024-01-01T00:00:00.000Z',
            'jcr:lastModified': '2024-01-02T00:00:00.000Z',
            'rep:lastLogin': '2024-01-15T10:30:00.000Z',
            'rep:disabled': false,
            'rep:groups': ['authors', 'contributors'],
            profile: {
              givenName: 'John',
              familyName: 'Doe',
              email: 'john.doe@example.com',
              title: 'Content Author'
            }
          },
          {
            path: '/home/users/j/jane-smith',
            'rep:principalName': 'jane-smith',
            name: 'jane-smith',
            'jcr:created': '2024-01-03T00:00:00.000Z',
            'jcr:lastModified': '2024-01-04T00:00:00.000Z',
            'rep:disabled': true,
            'rep:disabledReason': 'Account suspended',
            'rep:groups': ['administrators'],
            profile: {
              givenName: 'Jane',
              familyName: 'Smith',
              email: 'jane.smith@example.com'
            }
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 120,
        cached: false
      }
    };

    it('should list users successfully', async () => {
      mockClient.get.mockResolvedValue(mockUserListResponse);

      const result = await userAdminService.listUsers();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      
      const johnDoe = result.data![0];
      expect(johnDoe.id).toBe('john-doe');
      expect(johnDoe.profile.givenName).toBe('John');
      expect(johnDoe.profile.email).toBe('john.doe@example.com');
      expect(johnDoe.groups).toEqual(['authors', 'contributors']);
      expect(johnDoe.disabled).toBe(false);
      expect(johnDoe.lastLogin).toEqual(new Date('2024-01-15T10:30:00.000Z'));

      const janeSmith = result.data![1];
      expect(janeSmith.id).toBe('jane-smith');
      expect(janeSmith.disabled).toBe(true);
      expect(janeSmith.reason).toBe('Account suspended');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        expect.objectContaining({
          'path': '/home/users',
          'type': 'rep:User',
          'p.limit': 50,
          'p.offset': 0
        }),
        expect.any(Object)
      );
    });

    it('should list users with custom options', async () => {
      mockClient.get.mockResolvedValue(mockUserListResponse);

      const options: ListUsersOptions = {
        path: '/home/users/custom',
        query: 'john',
        includeSystemUsers: true,
        orderBy: 'name',
        orderDirection: 'desc',
        limit: 10,
        offset: 5
      };

      await userAdminService.listUsers(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        expect.objectContaining({
          'path': '/home/users/custom',
          'fulltext': 'john',
          'orderby': '@rep:principalName',
          'orderby.sort': 'desc',
          'p.limit': 10,
          'p.offset': 5
        }),
        expect.any(Object)
      );
    });

    it('should filter out system users by default', async () => {
      mockClient.get.mockResolvedValue(mockUserListResponse);

      await userAdminService.listUsers();

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        expect.objectContaining({
          'property': 'rep:principalName',
          'property.operation': 'not',
          'property.value': 'system-%'
        }),
        expect.any(Object)
      );
    });

    it('should handle empty user list', async () => {
      const emptyResponse = {
        ...mockUserListResponse,
        data: { hits: [] }
      };
      mockClient.get.mockResolvedValue(emptyResponse);

      const result = await userAdminService.listUsers();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('listGroups', () => {
    const mockGroupListResponse = {
      success: true,
      data: {
        hits: [
          {
            path: '/home/groups/a/authors',
            'rep:principalName': 'authors',
            name: 'authors',
            'jcr:title': 'Content Authors',
            'jcr:description': 'Group for content authors',
            'jcr:created': '2024-01-01T00:00:00.000Z',
            'jcr:lastModified': '2024-01-02T00:00:00.000Z',
            'rep:members': ['john-doe', 'mary-jones'],
            'rep:groups': ['contributors']
          },
          {
            path: '/home/groups/a/administrators',
            'rep:principalName': 'administrators',
            name: 'administrators',
            'jcr:title': 'Administrators',
            'jcr:description': 'System administrators',
            'jcr:created': '2024-01-03T00:00:00.000Z',
            'rep:members': ['admin', 'jane-smith']
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100,
        cached: false
      }
    };

    it('should list groups successfully', async () => {
      mockClient.get.mockResolvedValue(mockGroupListResponse);

      const result = await userAdminService.listGroups();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      
      const authors = result.data![0];
      expect(authors.id).toBe('authors');
      expect(authors.title).toBe('Content Authors');
      expect(authors.description).toBe('Group for content authors');
      expect(authors.members).toEqual(['john-doe', 'mary-jones']);
      expect(authors.memberCount).toBe(2);
      expect(authors.nestedGroups).toEqual(['contributors']);

      const administrators = result.data![1];
      expect(administrators.id).toBe('administrators');
      expect(administrators.memberCount).toBe(2);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        expect.objectContaining({
          'path': '/home/groups',
          'type': 'rep:Group',
          'p.limit': 50,
          'p.offset': 0
        }),
        expect.any(Object)
      );
    });

    it('should list groups with custom options', async () => {
      mockClient.get.mockResolvedValue(mockGroupListResponse);

      const options: ListGroupsOptions = {
        query: 'admin',
        includeSystemGroups: true,
        orderBy: 'created',
        orderDirection: 'asc'
      };

      await userAdminService.listGroups(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/bin/querybuilder.json',
        expect.objectContaining({
          'fulltext': 'admin',
          'orderby': '@jcr:created',
          'orderby.sort': 'asc'
        }),
        expect.any(Object)
      );
    });
  });

  describe('getUserProfile', () => {
    const mockUserSearchResponse = {
      success: true,
      data: {
        hits: [
          {
            path: '/home/users/j/john-doe'
          }
        ]
      }
    };

    const mockUserProfileResponse = {
      success: true,
      data: {
        'rep:principalName': 'john-doe',
        'jcr:created': '2024-01-01T00:00:00.000Z',
        'jcr:lastModified': '2024-01-02T00:00:00.000Z',
        'rep:lastLogin': '2024-01-15T10:30:00.000Z',
        'rep:disabled': false,
        'rep:groups': ['authors', 'contributors'],
        profile: {
          givenName: 'John',
          familyName: 'Doe',
          email: 'john.doe@example.com',
          title: 'Content Author',
          department: 'Marketing'
        },
        preferences: {
          language: 'en',
          timezone: 'America/New_York'
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 80,
        cached: false
      }
    };

    it('should get user profile successfully', async () => {
      mockClient.get
        .mockResolvedValueOnce(mockUserSearchResponse) // findUserPath call
        .mockResolvedValueOnce(mockUserProfileResponse); // getUserProfile call

      const result = await userAdminService.getUserProfile('john-doe');

      expect(result.success).toBe(true);
      expect(result.data!.id).toBe('john-doe');
      expect(result.data!.profile.givenName).toBe('John');
      expect(result.data!.profile.department).toBe('Marketing');
      expect(result.data!.preferences.language).toBe('en');
      expect(result.data!.disabled).toBe(false);
      expect(result.data!.groups).toEqual(['authors', 'contributors']);

      expect(mockClient.get).toHaveBeenCalledTimes(2);
      expect(mockClient.get).toHaveBeenNthCalledWith(1,
        '/bin/querybuilder.json',
        expect.objectContaining({
          'property.value': 'john-doe'
        })
      );
      expect(mockClient.get).toHaveBeenNthCalledWith(2,
        '/home/users/j/john-doe.json',
        undefined,
        expect.any(Object)
      );
    });

    it('should throw validation error for empty user ID', async () => {
      await expect(userAdminService.getUserProfile('')).rejects.toThrow(AEMException);
      await expect(userAdminService.getUserProfile('')).rejects.toThrow('User ID is required');
    });

    it('should throw not found error for non-existent user', async () => {
      const notFoundResponse = {
        success: false,
        data: { hits: [] }
      };
      mockClient.get.mockResolvedValue(notFoundResponse);

      await expect(userAdminService.getUserProfile('non-existent')).rejects.toThrow(AEMException);
    });
  });

  describe('getGroupMembers', () => {
    const mockGroupSearchResponse = {
      success: true,
      data: {
        hits: [
          {
            path: '/home/groups/a/authors'
          }
        ]
      }
    };

    const mockGroupMembersResponse = {
      success: true,
      data: {
        'rep:principalName': 'authors',
        'rep:members': ['john-doe', 'jane-smith', 'bob-wilson']
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 60,
        cached: false
      }
    };

    it('should get group members successfully', async () => {
      mockClient.get
        .mockResolvedValueOnce(mockGroupSearchResponse) // findGroupPath call
        .mockResolvedValueOnce(mockGroupMembersResponse); // getGroupMembers call

      const result = await userAdminService.getGroupMembers('authors');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['john-doe', 'jane-smith', 'bob-wilson']);

      expect(mockClient.get).toHaveBeenCalledTimes(2);
    });

    it('should handle group with no members', async () => {
      const noMembersResponse = {
        ...mockGroupMembersResponse,
        data: {
          'rep:principalName': 'empty-group'
        }
      };
      
      mockClient.get
        .mockResolvedValueOnce(mockGroupSearchResponse)
        .mockResolvedValueOnce(noMembersResponse);

      const result = await userAdminService.getGroupMembers('empty-group');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getUserGroups', () => {
    const mockUserSearchResponse = {
      success: true,
      data: {
        hits: [
          {
            path: '/home/users/j/john-doe'
          }
        ]
      }
    };

    const mockUserGroupsResponse = {
      success: true,
      data: {
        'rep:principalName': 'john-doe',
        'rep:groups': ['authors', 'contributors']
      }
    };

    const mockGroupSearchResponses = [
      {
        success: true,
        data: {
          hits: [{ path: '/home/groups/a/authors' }]
        }
      },
      {
        success: true,
        data: {
          hits: [{ path: '/home/groups/c/contributors' }]
        }
      }
    ];

    const mockGroupDetailResponses = [
      {
        success: true,
        data: {
          'jcr:title': 'Content Authors'
        }
      },
      {
        success: true,
        data: {
          'jcr:title': 'Contributors'
        }
      }
    ];

    it('should get user groups successfully', async () => {
      mockClient.get
        .mockResolvedValueOnce(mockUserSearchResponse) // findUserPath call
        .mockResolvedValueOnce(mockUserGroupsResponse) // getUserGroups call
        .mockResolvedValueOnce(mockGroupSearchResponses[0]) // findGroupPath for authors
        .mockResolvedValueOnce(mockGroupDetailResponses[0]) // group details for authors
        .mockResolvedValueOnce(mockGroupSearchResponses[1]) // findGroupPath for contributors
        .mockResolvedValueOnce(mockGroupDetailResponses[1]); // group details for contributors

      const result = await userAdminService.getUserGroups('john-doe');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].groupId).toBe('authors');
      expect(result.data![0].groupTitle).toBe('Content Authors');
      expect(result.data![0].memberType).toBe('direct');
      expect(result.data![1].groupId).toBe('contributors');

      expect(mockClient.get).toHaveBeenCalledTimes(6);
    });
  });

  describe('getUserPermissions', () => {
    const mockUserSearchResponse = {
      success: true,
      data: {
        hits: [
          {
            path: '/home/users/j/john-doe'
          }
        ]
      }
    };

    const mockPermissionsResponse = {
      success: true,
      data: {
        permissions: [
          {
            path: '/content/mysite',
            privileges: ['jcr:read', 'jcr:write'],
            allow: true
          },
          {
            path: '/content/admin',
            privileges: ['jcr:all'],
            allow: false
          },
          {
            path: '/content/dam',
            privileges: ['jcr:read'],
            allow: true
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 150,
        cached: false
      }
    };

    it('should get user permissions successfully', async () => {
      mockClient.get
        .mockResolvedValueOnce(mockUserSearchResponse) // findUserPath call
        .mockResolvedValueOnce(mockPermissionsResponse); // getUserPermissions call

      const result = await userAdminService.getUserPermissions('john-doe');

      expect(result.success).toBe(true);
      expect(result.data!.userId).toBe('john-doe');
      expect(result.data!.userPath).toBe('/home/users/j/john-doe');
      expect(result.data!.permissions).toHaveLength(3);
      expect(result.data!.effectivePermissions).toHaveLength(2); // Only allowed permissions
      expect(result.data!.deniedPermissions).toHaveLength(1); // Only denied permissions

      const allowedPermission = result.data!.effectivePermissions[0];
      expect(allowedPermission.path).toBe('/content/mysite');
      expect(allowedPermission.privileges).toEqual(['jcr:read', 'jcr:write']);
      expect(allowedPermission.allow).toBe(true);

      const deniedPermission = result.data!.deniedPermissions[0];
      expect(deniedPermission.path).toBe('/content/admin');
      expect(deniedPermission.allow).toBe(false);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/libs/granite/security/currentuser.json',
        { userId: 'john-doe' },
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(userAdminService.listUsers()).rejects.toThrow(AEMException);
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.get.mockRejectedValue(originalError);

      await expect(userAdminService.listGroups()).rejects.toThrow('Original error');
    });

    it('should handle malformed response data', async () => {
      const malformedResponse = {
        success: true,
        data: 'invalid-data'
      };
      mockClient.get.mockResolvedValue(malformedResponse);

      const result = await userAdminService.listUsers();
      expect(result.data).toHaveLength(0);
    });
  });
});
