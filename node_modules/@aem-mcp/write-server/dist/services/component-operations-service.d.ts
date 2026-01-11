/**
 * Component Operations Service for AEMaaCS write operations
 * Handles component creation, updating, deletion, bulk updates, validation, and image path updates
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
export interface CreateComponentOptions {
    resourceType: string;
    name?: string;
    properties?: Record<string, any>;
    insertBefore?: string;
    insertAfter?: string;
}
export interface UpdateComponentOptions {
    merge?: boolean;
    replaceProperties?: boolean;
    validateBeforeUpdate?: boolean;
}
export interface DeleteComponentOptions {
    force?: boolean;
    checkReferences?: boolean;
}
export interface BulkUpdateOptions {
    batchSize?: number;
    continueOnError?: boolean;
    rollbackOnFailure?: boolean;
    validateBeforeUpdate?: boolean;
}
export interface ComponentUpdate {
    componentPath: string;
    properties: Record<string, any>;
    options?: UpdateComponentOptions;
}
export interface ValidationOptions {
    strict?: boolean;
    checkResourceType?: boolean;
    validateProperties?: boolean;
}
export interface ComponentOperationResult {
    success: boolean;
    path?: string;
    message?: string;
    warnings?: string[];
    errors?: string[];
}
export interface BulkUpdateResult {
    totalComponents: number;
    successfulUpdates: number;
    failedUpdates: number;
    results: Array<{
        componentPath: string;
        success: boolean;
        error?: string;
    }>;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    suggestions?: string[];
}
export declare class ComponentOperationsService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Create component for component creation
     */
    createComponent(pagePath: string, containerPath: string, options: CreateComponentOptions): Promise<AEMResponse<ComponentOperationResult>>;
    /**
     * Update component with validation
     */
    updateComponent(componentPath: string, properties: Record<string, any>, options?: UpdateComponentOptions): Promise<AEMResponse<ComponentOperationResult>>;
    /**
     * Delete component with safety checks
     */
    deleteComponent(componentPath: string, options?: DeleteComponentOptions): Promise<AEMResponse<ComponentOperationResult>>;
    /**
     * Bulk update components with rollback support
     */
    bulkUpdateComponents(updates: ComponentUpdate[], options?: BulkUpdateOptions): Promise<AEMResponse<BulkUpdateResult>>;
    /**
     * Validate component for pre-validation
     */
    validateComponent(componentPath: string, properties: Record<string, any>, options?: ValidationOptions): Promise<ValidationResult>;
    /**
     * Update image path for image reference updates
     */
    updateImagePath(componentPath: string, newImagePath: string, imageProperty?: string): Promise<AEMResponse<ComponentOperationResult>>;
    /**
     * Parse component operation response
     */
    private parseComponentOperationResponse;
    /**
     * Generate component name from resource type
     */
    private generateComponentName;
    /**
     * Check if component is critical and should not be deleted
     */
    private isCriticalComponent;
    /**
     * Validate resource type format
     */
    private isValidResourceType;
    /**
     * Check if property name is reserved
     */
    private isReservedProperty;
    /**
     * Check if property is required
     */
    private isRequiredProperty;
    /**
     * Get component state for rollback
     */
    private getComponentState;
    /**
     * Restore component state for rollback
     */
    private restoreComponentState;
    /**
     * Perform rollback operations
     */
    private performRollback;
}
//# sourceMappingURL=component-operations-service.d.ts.map