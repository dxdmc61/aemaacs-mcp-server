/**
 * System Operations Service for AEMaaCS write operations
 * Handles ACL configuration, async job management, and JCR property manipulation
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
export interface ACLEntry {
    principal: string;
    privileges: string[];
    allow: boolean;
    restrictions?: Record<string, string>;
}
export interface ACLConfig {
    path: string;
    entries: ACLEntry[];
    merge?: boolean;
    replaceExisting?: boolean;
}
export interface JCRPropertyOperation {
    path: string;
    property: string;
    value?: any;
    type?: 'String' | 'Long' | 'Double' | 'Boolean' | 'Date' | 'Binary' | 'Reference' | 'WeakReference' | 'URI' | 'Decimal';
    multiple?: boolean;
    operation: 'set' | 'delete' | 'add' | 'remove';
}
export interface SystemOperationResult {
    success: boolean;
    path?: string;
    message?: string;
    warnings?: string[];
    errors?: string[];
}
export interface ACLResult extends SystemOperationResult {
    appliedEntries?: number;
    skippedEntries?: number;
    failedEntries?: number;
}
export interface JobResult extends SystemOperationResult {
    jobId?: string;
    jobStatus?: string;
    deletedJobs?: number;
}
export interface PropertyResult extends SystemOperationResult {
    property?: string;
    oldValue?: any;
    newValue?: any;
    propertyType?: string;
}
export declare class SystemOperationsService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Apply ACL configuration for permission management
     */
    applyACLConfig(config: ACLConfig): Promise<AEMResponse<ACLResult>>;
    /**
     * Delete async job for job cleanup
     */
    deleteAsyncJob(jobId: string): Promise<AEMResponse<JobResult>>;
    /**
     * Manipulate JCR property for property management
     */
    manipulateJCRProperty(operation: JCRPropertyOperation): Promise<AEMResponse<PropertyResult>>;
    /**
     * Apply single ACL entry
     */
    private applyACLEntry;
    /**
     * Clear existing ACL
     */
    private clearACL;
    /**
     * Validate JCR path format
     */
    private isValidJCRPath;
    /**
     * Validate property name format
     */
    private isValidPropertyName;
    /**
     * Check if property is a system property that should not be manipulated
     */
    private isSystemProperty;
    /**
     * Format property value based on type
     */
    private formatPropertyValue;
}
//# sourceMappingURL=system-operations-service.d.ts.map