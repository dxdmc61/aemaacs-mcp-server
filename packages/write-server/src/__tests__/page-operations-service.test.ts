/**
 * Unit tests for Page Operations Service
 */

import { PageOperationsService, CreatePageOptions, CopyPageOptions, MovePageOptions, DeletePageOptions, UpdatePagePropertiesOptions, BulkMoveOptions, PageOperationResult, LockResult, UnlockResult, BulkMoveResult } from '../services/page-operations-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('PageOperationsService', () => {
    let pageService: PageOperationsService;
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

        pageService = new PageOperationsService(mockClient);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createPage', () => {
        const mockCreateResponse = {
            success: true,
            data: {
                success: true,
                path: '/content/mysite/en/new-page',
                message: 'Page created successfully'
            },
            metadata: {
                timestamp: new Date(),
                requestId: 'test-request-id',
                duration: 150
            }
        };

        it('should create page successfully', async () => {
            const parentPath = '/content/mysite/en';
            const pageName = 'new-page';
            const options: CreatePageOptions = {
                template: '/conf/mysite/settings/wcm/templates/page-template',
                title: 'New Page',
                description: 'A new page for testing',
                tags: ['mysite:category/news', 'mysite:topic/technology'],
                properties: {
                    'customProperty': 'customValue',
                    'hideInNav': 'true'
                }
            };

            mockClient.post.mockResolvedValue(mockCreateResponse);

            const result = await pageService.createPage(parentPath, pageName, options);

            expect(result.success).toBe(true);
            expect(result.data!.success).toBe(true);
            expect(result.data!.path).toBe('/content/mysite/en/new-page');
            expect(result.data!.message).toBe('Page created successfully');

            expect(mockClient.post).toHaveBeenCalledWith(
                '/bin/wcmcommand',
                expect.any(Object), // FormData
                expect.objectContaining({
                    context: {
                        operation: 'createPage',
                        resource: '/content/mysite/en/new-page'
                    }
                })
            );
        });

        it('should throw validation error for missing required fields', async () => {
            await expect(pageService.createPage('', 'page', { template: '/template' })).rejects.toThrow(AEMException);
            await expect(pageService.createPage('/parent', '', { template: '/template' })).rejects.toThrow(AEMException);
            await expect(pageService.createPage('/parent', 'page', {} as CreatePageOptions)).rejects.toThrow(AEMException);
        });

        it('should throw validation error for invalid page name', async () => {
            const invalidNames = ['page<name', 'page>name', 'page:name', 'page"name', 'page/name', 'page\\name', 'page|name', 'page?name', 'page*name'];

            for (const invalidName of invalidNames) {
                await expect(pageService.createPage('/parent', invalidName, { template: '/template' })).rejects.toThrow(AEMException);
                await expect(pageService.createPage('/parent', invalidName, { template: '/template' })).rejects.toThrow('Invalid page name');
            }
        });

        it('should handle server errors gracefully', async () => {
            const errorResponse = {
                success: false,
                error: { code: 'SERVER_ERROR', message: 'Internal server error' }
            };
            mockClient.post.mockResolvedValue(errorResponse);

            await expect(pageService.createPage('/parent', 'page', { template: '/template' })).rejects.toThrow(AEMException);
            await expect(pageService.createPage('/parent', 'page', { template: '/template' })).rejects.toThrow('Failed to create page');
        });
    });

    describe('copyPage', () => {
        const mockCopyResponse = {
            success: true,
            data: {
                success: true,
                path: '/content/mysite/en/copied-page',
                message: 'Page copied successfully'
            },
            metadata: {
                timestamp: new Date(),
                requestId: 'test-request-id',
                duration: 200
            }
        };

        it('should copy page successfully', async () => {
            const srcPath = '/content/mysite/en/source-page';
            const destParentPath = '/content/mysite/en';
            const options: CopyPageOptions = {
                destName: 'copied-page',
                shallow: false,
                updateReferences: true,
                adjustTimestamp: true
            };

            mockClient.post.mockResolvedValue(mockCopyResponse);

            const result = await pageService.copyPage(srcPath, destParentPath, options);

            expect(result.success).toBe(true);
            expect(result.data!.success).toBe(true);
            expect(result.data!.path).toBe('/content/mysite/en/copied-page');

            expect(mockClient.post).toHaveBeenCalledWith(
                '/bin/wcmcommand',
                expect.any(Object), // FormData
                expect.objectContaining({
                    context: {
                        operation: 'copyPage',
                        resource: srcPath
                    }
                })
            );
        });

        it('should throw validation error for missing paths', async () => {
            await expect(pageService.copyPage('', '/dest')).rejects.toThrow(AEMException);
            await expect(pageService.copyPage('/src', '')).rejects.toThrow(AEMException);
        });
    });

    describe('movePage', () => {
        const mockMoveResponse = {
            success: true,
            data: {
                success: true,
                path: '/content/mysite/de/moved-page',
                message: 'Page moved successfully'
            },
            metadata: {
                timestamp: new Date(),
                requestId: 'test-request-id',
                duration: 300
            }
        };

        it('should move page successfully', async () => {
            const srcPath = '/content/mysite/en/source-page';
            const destParentPath = '/content/mysite/de';
            const options: MovePageOptions = {
                destName: 'moved-page',
                updateReferences: true,
                adjustTimestamp: true,
                force: false
            };

            mockClient.post.mockResolvedValue(mockMoveResponse);

            const result = await pageService.movePage(srcPath, destParentPath, options);

            expect(result.success).toBe(true);
            expect(result.data!.success).toBe(true);
            expect(result.data!.path).toBe('/content/mysite/de/moved-page');

            expect(mockClient.post).toHaveBeenCalledWith(
                '/bin/wcmcommand',
                expect.any(Object), // FormData
                expect.objectContaining({
                    context: {
                        operation: 'movePage',
                        resource: srcPath
                    }
                })
            );
        });

        it('should throw validation error for missing paths', async () => {
            await expect(pageService.movePage('', '/dest')).rejects.toThrow(AEMException);
            await expect(pageService.movePage('/src', '')).rejects.toThrow(AEMException);
        });
    });

    describe('bulkMovePage', () => {
        it('should move multiple pages in bulk successfully', async () => {
            const moves = [
                { srcPath: '/content/mysite/en/page1', destParentPath: '/content/mysite/de', destName: 'seite1' },
                { srcPath: '/content/mysite/en/page2', destParentPath: '/content/mysite/de', destName: 'seite2' },
                { srcPath: '/content/mysite/en/page3', destParentPath: '/content/mysite/de' }
            ];

            const mockMoveResponse = {
                success: true,
                data: {
                    success: true,
                    message: 'Page moved successfully'
                }
            };

            mockClient.post.mockResolvedValue(mockMoveResponse);

            const result = await pageService.bulkMovePage(moves);

            expect(result.success).toBe(true);
            expect(result.data!.totalPages).toBe(3);
            expect(result.data!.successfulMoves).toBe(3);
            expect(result.data!.failedMoves).toBe(0);
            expect(result.data!.results).toHaveLength(3);

            expect(mockClient.post).toHaveBeenCalledTimes(3);
        });

        it('should handle partial failures in bulk move', async () => {
            const moves = [
                { srcPath: '/content/mysite/en/page1', destParentPath: '/content/mysite/de' },
                { srcPath: '/content/mysite/en/page2', destParentPath: '/content/mysite/de' }
            ];

            mockClient.post
                .mockResolvedValueOnce({
                    success: true,
                    data: { success: true, message: 'Success' }
                })
                .mockRejectedValueOnce(new AEMException('Move failed', 'SERVER_ERROR', false));

            const result = await pageService.bulkMovePage(moves);

            expect(result.success).toBe(true);
            expect(result.data!.totalPages).toBe(2);
            expect(result.data!.successfulMoves).toBe(1);
            expect(result.data!.failedMoves).toBe(1);
            expect(result.data!.results[0].success).toBe(true);
            expect(result.data!.results[1].success).toBe(false);
            expect(result.data!.results[1].error).toBe('Move failed');
        });

        it('should throw validation error for empty moves array', async () => {
            await expect(pageService.bulkMovePage([])).rejects.toThrow(AEMException);
            await expect(pageService.bulkMovePage([])).rejects.toThrow('At least one page move operation is required');
        });
    });

    describe('deletePage', () => {
        const mockDeleteResponse = {
            success: true,
            data: {
                success: true,
                message: 'Page deleted successfully'
            },
            metadata: {
                timestamp: new Date(),
                requestId: 'test-request-id',
                duration: 100
            }
        };

        it('should delete page successfully', async () => {
            const pagePath = '/content/mysite/en/old-page';
            const options: DeletePageOptions = {
                force: true,
                checkReferences: true
            };

            mockClient.post.mockResolvedValue(mockDeleteResponse);

            const result = await pageService.deletePage(pagePath, options);

            expect(result.success).toBe(true);
            expect(result.data!.success).toBe(true);
            expect(result.data!.message).toBe('Page deleted successfully');

            expect(mockClient.post).toHaveBeenCalledWith(
                pagePath,
                expect.any(Object), // FormData
                expect.objectContaining({
                    context: {
                        operation: 'deletePage',
                        resource: pagePath
                    }
                })
            );
        });

        it('should throw validation error for empty page path', async () => {
            await expect(pageService.deletePage('')).rejects.toThrow(AEMException);
            await expect(pageService.deletePage('')).rejects.toThrow('Page path is required');
        });

        it('should prevent deletion of system pages', async () => {
            const systemPages = [
                '/content/dam/test',
                '/content/experience-fragments/test',
                '/etc/test',
                '/apps/test',
                '/libs/test',
                '/content'
            ];

            for (const systemPage of systemPages) {
                await expect(pageService.deletePage(systemPage)).rejects.toThrow(AEMException);
                await expect(pageService.deletePage(systemPage)).rejects.toThrow('Cannot delete system page');
            }
        });

        it('should allow deletion of regular content pages', async () => {
            const regularPages = [
                '/content/mysite/en/page',
                '/content/mycompany/de/artikel',
                '/content/blog/2024/post'
            ];

            mockClient.post.mockResolvedValue(mockDeleteResponse);

            for (const regularPage of regularPages) {
                const result = await pageService.deletePage(regularPage);
                expect(result.success).toBe(true);
                jest.clearAllMocks();
                mockClient.post.mockResolvedValue(mockDeleteResponse);
            }
        });
    });

    describe('lockPage', () => {
        const mockLockResponse = {
            success: true,
            data: {
                success: true,
                message: 'Page locked successfully',
                lockOwner: 'admin',
                lockCreated: '2024-01-15T10:30:00.000Z'
            },
            metadata: {
                timestamp: new Date(),
                requestId: 'test-request-id',
                duration: 50
            }
        };

        it('should lock page successfully', async () => {
            const pagePath = '/content/mysite/en/page';
            const deep = true;

            mockClient.post.mockResolvedValue(mockLockResponse);

            const result = await pageService.lockPage(pagePath, deep);

            expect(result.success).toBe(true);
            expect(result.data!.success).toBe(true);
            expect(result.data!.lockOwner).toBe('admin');
            expect(result.data!.lockDeep).toBe(true);
            expect(result.data!.lockCreated).toEqual(new Date('2024-01-15T10:30:00.000Z'));

            expect(mockClient.post).toHaveBeenCalledWith(
                '/bin/wcmcommand',
                expect.any(Object), // FormData
                expect.objectContaining({
                    context: {
                        operation: 'lockPage',
                        resource: pagePath
                    }
                })
            );
        });

        it('should throw validation error for empty page path', async () => {
            await expect(pageService.lockPage('')).rejects.toThrow(AEMException);
            await expect(pageService.lockPage('')).rejects.toThrow('Page path is required');
        });
    });

    describe('unlockPage', () => {
        const mockUnlockResponse = {
            success: true,
            data: {
                success: true,
                message: 'Page unlocked successfully',
                wasLocked: true,
                previousOwner: 'admin'
            },
            metadata: {
                timestamp: new Date(),
                requestId: 'test-request-id',
                duration: 50
            }
        };

        it('should unlock page successfully', async () => {
            const pagePath = '/content/mysite/en/page';
            const force = true;

            mockClient.post.mockResolvedValue(mockUnlockResponse);

            const result = await pageService.unlockPage(pagePath, force);

            expect(result.success).toBe(true);
            expect(result.data!.success).toBe(true);
            expect(result.data!.wasLocked).toBe(true);
            expect(result.data!.previousOwner).toBe('admin');

            expect(mockClient.post).toHaveBeenCalledWith(
                '/bin/wcmcommand',
                expect.any(Object), // FormData
                expect.objectContaining({
                    context: {
                        operation: 'unlockPage',
                        resource: pagePath
                    }
                })
            );
        });

        it('should throw validation error for empty page path', async () => {
            await expect(pageService.unlockPage('')).rejects.toThrow(AEMException);
            await expect(pageService.unlockPage('')).rejects.toThrow('Page path is required');
        });
    });

    describe('updatePageProperties', () => {
        const mockUpdateResponse = {
            success: true,
            data: {
                success: true,
                message: 'Page properties updated successfully'
            },
            metadata: {
                timestamp: new Date(),
                requestId: 'test-request-id',
                duration: 100
            }
        };

        it('should update page properties successfully', async () => {
            const pagePath = '/content/mysite/en/page';
            const properties = {
                'jcr:title': 'Updated Title',
                'jcr:description': 'Updated description',
                'cq:tags': ['mysite:category/news', 'mysite:topic/technology'],
                'hideInNav': true,
                'customProperty': 'customValue'
            };
            const options: UpdatePagePropertiesOptions = {
                merge: true,
                replaceProperties: false
            };

            mockClient.post.mockResolvedValue(mockUpdateResponse);

            const result = await pageService.updatePageProperties(pagePath, properties, options);

            expect(result.success).toBe(true);
            expect(result.data!.success).toBe(true);
            expect(result.data!.message).toBe('Page properties updated successfully');

            expect(mockClient.post).toHaveBeenCalledWith(
                `${pagePath}/jcr:content`,
                expect.any(Object), // FormData
                expect.objectContaining({
                    context: {
                        operation: 'updatePageProperties',
                        resource: `${pagePath}/jcr:content`
                    }
                })
            );
        });

        it('should handle array properties correctly', async () => {
            const pagePath = '/content/mysite/en/page';
            const properties = {
                'cq:tags': ['tag1', 'tag2', 'tag3'],
                'multiValueProperty': ['value1', 'value2']
            };

            mockClient.post.mockResolvedValue(mockUpdateResponse);

            const result = await pageService.updatePageProperties(pagePath, properties);

            expect(result.success).toBe(true);
            expect(mockClient.post).toHaveBeenCalled();
        });

        it('should throw validation error for missing required fields', async () => {
            await expect(pageService.updatePageProperties('', { prop: 'value' })).rejects.toThrow(AEMException);
            await expect(pageService.updatePageProperties('/path', {})).rejects.toThrow(AEMException);
            await expect(pageService.updatePageProperties('', {})).rejects.toThrow('Page path and properties are required');
        });
    });

    describe('error handling', () => {
        it('should handle network errors gracefully', async () => {
            const networkError = new Error('ECONNREFUSED');
            mockClient.post.mockRejectedValue(networkError);

            await expect(pageService.createPage('/parent', 'page', { template: '/template' })).rejects.toThrow(AEMException);
            await expect(pageService.createPage('/parent', 'page', { template: '/template' })).rejects.toThrow('Unexpected error while creating page');
        });

        it('should preserve original AEMException', async () => {
            const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
            mockClient.post.mockRejectedValue(originalError);

            await expect(pageService.copyPage('/src', '/dest')).rejects.toThrow('Original error');
        });

        it('should handle malformed responses', async () => {
            const malformedResponse = {
                success: false,
                data: null
            };
            mockClient.post.mockResolvedValue(malformedResponse);

            await expect(pageService.movePage('/src', '/dest')).rejects.toThrow(AEMException);
            await expect(pageService.movePage('/src', '/dest')).rejects.toThrow('Failed to move page');
        });
    });

    describe('page name validation', () => {
        it('should validate page names correctly', async () => {
            const validNames = ['page', 'my-page', 'page_123', 'page.html', 'page-with-dashes'];
            const invalidNames = ['page<name', 'page>name', 'page:name', 'page"name', 'page/name', 'page\\name', 'page|name', 'page?name', 'page*name', '.hidden', 'page.'];

            mockClient.post.mockResolvedValue({
                success: true,
                data: { success: true, message: 'Created' }
            });

            // Valid names should work
            for (const validName of validNames) {
                const result = await pageService.createPage('/parent', validName, { template: '/template' });
                expect(result.success).toBe(true);
                jest.clearAllMocks();
                mockClient.post.mockResolvedValue({
                    success: true,
                    data: { success: true, message: 'Created' }
                });
            }

            // Invalid names should throw errors
            for (const invalidName of invalidNames) {
                await expect(pageService.createPage('/parent', invalidName, { template: '/template' })).rejects.toThrow(AEMException);
            }
        });

        it('should reject reserved names', async () => {
            const reservedNames = ['con', 'prn', 'aux', 'nul', 'com1', 'lpt1'];

            for (const reservedName of reservedNames) {
                await expect(pageService.createPage('/parent', reservedName, { template: '/template' })).rejects.toThrow(AEMException);
                await expect(pageService.createPage('/parent', reservedName.toUpperCase(), { template: '/template' })).rejects.toThrow(AEMException);
            }
        });

        it('should reject names that are too long', async () => {
            const longName = 'a'.repeat(151); // Over 150 character limit
            await expect(pageService.createPage('/parent', longName, { template: '/template' })).rejects.toThrow(AEMException);
        });
    });

    describe('system page protection', () => {
        it('should identify system pages correctly', async () => {
            const systemPages = [
                '/content/dam/test',
                '/content/experience-fragments/test',
                '/content/forms/test',
                '/content/screens/test',
                '/etc/test',
                '/apps/test',
                '/libs/test',
                '/var/test',
                '/content' // Root content
            ];

            for (const systemPage of systemPages) {
                await expect(pageService.deletePage(systemPage)).rejects.toThrow('Cannot delete system page');
            }
        });

        it('should allow deletion of regular content pages', async () => {
            const regularPages = [
                '/content/mysite/en/page',
                '/content/mycompany/de/artikel',
                '/content/blog/2024/post',
                '/content/website/fr/accueil'
            ];

            mockClient.post.mockResolvedValue({
                success: true,
                data: { success: true, message: 'Deleted' }
            });

            for (const regularPage of regularPages) {
                const result = await pageService.deletePage(regularPage);
                expect(result.success).toBe(true);
                jest.clearAllMocks();
                mockClient.post.mockResolvedValue({
                    success: true,
                    data: { success: true, message: 'Deleted' }
                });
            }
        });
    });
});
