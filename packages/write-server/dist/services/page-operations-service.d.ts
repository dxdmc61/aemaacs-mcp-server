/**
 * Page Operations Service for AEMaaCS write operations
 * Handles page creation, copying, moving, deletion, locking, and property updates
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
export interface CreatePageOptions {
    template: string;
    title?: string;
    description?: string;
    tags?: string[];
    properties?: Record<string, any>;
    parentResourceType?: string;
}
export interface CopyPageOptions {
    shallow?: boolean;
    destName?: string;
    updateReferences?: boolean;
    adjustTimestamp?: boolean;
}
export interface MovePageOptions {
    destName?: string;
    adjustTimestamp?: boolean;
    updateReferences?: boolean;
    force?: boolean;
}
export interface DeletePageOptions {
    force?: boolean;
    checkReferences?: boolean;
}
export interface UpdatePagePropertiesOptions {
    merge?: boolean;
    replaceProperties?: boolean;
}
export interface PageOperationResult {
    success: boolean;
    path?: string;
    message?: string;
    warnings?: string[];
    errors?: string[];
}
export interface LockResult extends PageOperationResult {
    lockOwner?: string;
    lockCreated?: Date;
    lockDeep?: boolean;
}
export interface UnlockResult extends PageOperationResult {
    wasLocked?: boolean;
    previousOwner?: string;
}
export interface BulkMoveOptions {
    updateReferences?: boolean;
    adjustTimestamp?: boolean;
    force?: boolean;
    batchSize?: number;
}
export interface BulkMoveResult {
    totalPages: number;
    successfulMoves: number;
    failedMoves: number;
    results: Array<{
        srcPath: string;
        destPath: string;
        success: boolean;
        error?: string;
    }>;
}
export declare class PageOperationsService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Create page with template integration
     */
    createPage(parentPath: string, pageName: string, options: CreatePageOptions): Promise<AEMResponse<PageOperationResult>>;
    /**
     * Copy page using /bin/wcmcommand
     */
    copyPage(srcPath: string, destParentPath: string, options?: CopyPageOptions): Promise<AEMResponse<PageOperationResult>>;
    /**
     * Move page with bulk operation support
     */
    movePage(srcPath: string, destParentPath: string, options?: MovePageOptions): Promise<AEMResponse<PageOperationResult>>;
    /**
     * Move multiple pages in bulk
     */
    bulkMovePage(moves: Array<{
        srcPath: string;
        destParentPath: string;
        destName?: string;
    }>, options?: BulkMoveOptions): Promise<AEMResponse<BulkMoveResult>>;
    /**
     * Delete page with force option and safety checks
     */
    deletePage(pagePath: string, options?: DeletePageOptions): Promise<AEMResponse<PageOperationResult>>;
    /**
     * Lock page
     */
    lockPage(pagePath: string, deep?: boolean): Promise<AEMResponse<LockResult>>;
    /**
     * Unlock page
     */
    unlockPage(pagePath: string, force?: boolean): Promise<AEMResponse<UnlockResult>>;
    /**
     * Update page properties for metadata updates
     */
    updatePageProperties(pagePath: string, properties: Record<string, any>, options?: UpdatePagePropertiesOptions): Promise<AEMResponse<PageOperationResult>>;
    /**
     * Parse page operation response
     */
    private parsePageOperationResponse;
    /**
     * Parse lock response
     */
    private parseLockResponse;
    /**
     * Parse unlock response
     */
    private parseUnlockResponse;
    /**
     * Validate page name
     */
    private isValidPageName;
    /**
     * Check if page is a system page that should not be deleted
     */
    private isSystemPage;
}
//# sourceMappingURL=page-operations-service.d.ts.map