/**
 * Content Fragment Operations Service for AEMaaCS write operations
 * Handles content fragment creation, updating, and deletion
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
export interface CreateContentFragmentOptions {
    model: string;
    title: string;
    description?: string;
    elements?: Record<string, any>;
    tags?: string[];
    properties?: Record<string, any>;
}
export interface UpdateContentFragmentOptions {
    elements?: Record<string, any>;
    title?: string;
    description?: string;
    tags?: string[];
    properties?: Record<string, any>;
    merge?: boolean;
}
export interface DeleteContentFragmentOptions {
    force?: boolean;
    checkReferences?: boolean;
}
export interface ContentFragmentOperationResult {
    success: boolean;
    path?: string;
    message?: string;
    warnings?: string[];
    errors?: string[];
}
export interface ContentFragment {
    path: string;
    name: string;
    title?: string;
    description?: string;
    model: string;
    elements: Record<string, any>;
    tags?: string[];
    created?: Date;
    lastModified?: Date;
    createdBy?: string;
    lastModifiedBy?: string;
    properties: Record<string, any>;
}
export interface ContentFragmentModel {
    path: string;
    name: string;
    title?: string;
    description?: string;
    elements: ContentFragmentModelElement[];
    created?: Date;
    lastModified?: Date;
    createdBy?: string;
    lastModifiedBy?: string;
}
export interface ContentFragmentModelElement {
    name: string;
    type: 'text' | 'number' | 'boolean' | 'date' | 'multitext' | 'contentreference' | 'fragmentreference' | 'json';
    title?: string;
    description?: string;
    required?: boolean;
    validation?: Record<string, any>;
    defaultValue?: any;
}
export interface CreateContentFragmentModelOptions {
    title: string;
    description?: string;
    elements: ContentFragmentModelElement[];
    properties?: Record<string, any>;
}
export interface ContentFragmentVariation {
    name: string;
    title?: string;
    description?: string;
    elements: Record<string, any>;
    isMaster?: boolean;
    created?: Date;
    lastModified?: Date;
    createdBy?: string;
    lastModifiedBy?: string;
}
export interface CreateContentFragmentVariationOptions {
    title?: string;
    description?: string;
    elements?: Record<string, any>;
    isMaster?: boolean;
}
export interface ContentFragmentReference {
    type: 'contentreference' | 'fragmentreference' | 'assetreference';
    path: string;
    title?: string;
    description?: string;
}
export interface ContentFragmentReferenceResult {
    fragmentPath: string;
    references: ContentFragmentReference[];
    referencedBy: ContentFragmentReference[];
}
export declare class ContentFragmentOperationsService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Create content fragment using /api/assets/
     */
    createContentFragment(parentPath: string, fragmentName: string, options: CreateContentFragmentOptions): Promise<AEMResponse<ContentFragmentOperationResult>>;
    /**
     * Update content fragment for element updates
     */
    updateContentFragment(fragmentPath: string, options: UpdateContentFragmentOptions): Promise<AEMResponse<ContentFragmentOperationResult>>;
    /**
     * Delete content fragment with safety checks
     */
    deleteContentFragment(fragmentPath: string, options?: DeleteContentFragmentOptions): Promise<AEMResponse<ContentFragmentOperationResult>>;
    /**
     * Parse content fragment operation response
     */
    private parseContentFragmentOperationResponse;
    /**
     * Format fragment elements for storage
     */
    private formatFragmentElements;
    /**
     * Validate fragment name
     */
    private isValidFragmentName;
    /**
     * Check if fragment is a system fragment that should not be deleted
     */
    private isSystemFragment;
    /**
     * Create a new content fragment model
     */
    createContentFragmentModel(parentPath: string, modelName: string, options: CreateContentFragmentModelOptions): Promise<AEMResponse<ContentFragmentOperationResult>>;
    /**
     * Get content fragment model information
     */
    getContentFragmentModel(modelPath: string): Promise<AEMResponse<ContentFragmentModel>>;
    /**
     * List all content fragment models
     */
    listContentFragmentModels(confPath?: string): Promise<AEMResponse<ContentFragmentModel[]>>;
    /**
     * Create a new variation for a content fragment
     */
    createContentFragmentVariation(fragmentPath: string, variationName: string, options: CreateContentFragmentVariationOptions): Promise<AEMResponse<ContentFragmentOperationResult>>;
    /**
     * Update a content fragment variation
     */
    updateContentFragmentVariation(fragmentPath: string, variationName: string, options: CreateContentFragmentVariationOptions): Promise<AEMResponse<ContentFragmentOperationResult>>;
    /**
     * Delete a content fragment variation
     */
    deleteContentFragmentVariation(fragmentPath: string, variationName: string): Promise<AEMResponse<ContentFragmentOperationResult>>;
    /**
     * List all variations for a content fragment
     */
    listContentFragmentVariations(fragmentPath: string): Promise<AEMResponse<ContentFragmentVariation[]>>;
    /**
     * Get references for a content fragment
     */
    getContentFragmentReferences(fragmentPath: string): Promise<AEMResponse<ContentFragmentReferenceResult>>;
    /**
     * Format model elements for storage
     */
    private formatModelElements;
    /**
     * Parse content fragment model from response
     */
    private parseContentFragmentModel;
    /**
     * Check if a path is a valid reference
     */
    private isValidReference;
    /**
     * Get reference type based on path
     */
    private getReferenceType;
}
//# sourceMappingURL=content-fragment-operations-service.d.ts.map