/**
 * Tag Operations Service for AEMaaCS write operations
 * Handles tag namespace creation, tag creation, editing, moving, and deletion
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
export interface CreateTagNamespaceOptions {
    title?: string;
    description?: string;
    properties?: Record<string, any>;
}
export interface CreateTagOptions {
    title?: string;
    description?: string;
    parentTagId?: string;
    properties?: Record<string, any>;
}
export interface MoveTagOptions {
    newParentTagId?: string;
    newName?: string;
}
export interface EditTagOptions {
    title?: string;
    description?: string;
    properties?: Record<string, any>;
    translations?: Record<string, {
        title?: string;
        description?: string;
    }>;
}
export interface DeleteTagOptions {
    force?: boolean;
    recursive?: boolean;
}
export interface TagOperationResult {
    success: boolean;
    tagId?: string;
    tagPath?: string;
    message?: string;
    warnings?: string[];
    errors?: string[];
}
export interface NamespaceResult extends TagOperationResult {
    namespace?: string;
    namespacePath?: string;
}
export interface TagResult extends TagOperationResult {
    title?: string;
    description?: string;
    parentTagId?: string;
}
export interface MoveResult extends TagOperationResult {
    oldPath?: string;
    newPath?: string;
    newTagId?: string;
}
export declare class TagOperationsService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Create tag namespace using /bin/tagcommand
     */
    createTagNamespace(namespace: string, options?: CreateTagNamespaceOptions): Promise<AEMResponse<NamespaceResult>>;
    /**
     * Create tag with parent tag support
     */
    createTag(tagId: string, options?: CreateTagOptions): Promise<AEMResponse<TagResult>>;
    /**
     * Move tag for tag reorganization
     */
    moveTag(tagId: string, options?: MoveTagOptions): Promise<AEMResponse<MoveResult>>;
    /**
     * Edit tag for property and translation updates
     */
    editTag(tagId: string, options?: EditTagOptions): Promise<AEMResponse<TagResult>>;
    /**
     * Delete tag with safety checks
     */
    deleteTag(tagId: string, options?: DeleteTagOptions): Promise<AEMResponse<TagOperationResult>>;
    /**
     * Validate namespace format
     */
    private isValidNamespace;
    /**
     * Validate tag ID format
     */
    private isValidTagId;
    /**
     * Build tag path from tag ID
     */
    private buildTagPath;
    /**
     * Build new tag ID after move operation
     */
    private buildNewTagId;
    /**
     * Check if tag is a system tag that should not be deleted
     */
    private isSystemTag;
}
//# sourceMappingURL=tag-operations-service.d.ts.map