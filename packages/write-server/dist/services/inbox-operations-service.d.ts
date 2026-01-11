/**
 * Inbox Operations Service for AEMaaCS write operations
 * Handles inbox task completion, status updates, and cleanup operations
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
export interface CompleteInboxTaskOptions {
    comment?: string;
    taskData?: Record<string, any>;
    notifyAssignee?: boolean;
}
export interface UpdateTaskStatusOptions {
    comment?: string;
    assignee?: string;
    dueDate?: Date;
    priority?: number;
    taskData?: Record<string, any>;
}
export interface CleanupOptions {
    batchSize?: number;
    maxAge?: number;
    status?: 'SUCCESS' | 'FAILED' | 'ALL';
}
export interface InboxTaskOperationResult {
    success: boolean;
    taskId?: string;
    message?: string;
    warnings?: string[];
    errors?: string[];
}
export interface TaskStatusUpdateResult extends InboxTaskOperationResult {
    previousStatus?: string;
    newStatus?: string;
    assignee?: string;
}
export interface CleanupResult extends InboxTaskOperationResult {
    itemsProcessed: number;
    itemsRemoved: number;
    itemsFailed: number;
    details: CleanupItemResult[];
}
export interface CleanupItemResult {
    itemId: string;
    itemType: string;
    path?: string;
    success: boolean;
    error?: string;
}
export interface InboxTask {
    id: string;
    title?: string;
    description?: string;
    type: string;
    status: 'ACTIVE' | 'COMPLETED' | 'TERMINATED' | 'SUSPENDED';
    assignee?: string;
    created: Date;
    dueDate?: Date;
    completed?: Date;
    priority: number;
    workflowId?: string;
    payload?: string;
    formResourcePath?: string;
    taskData: Record<string, any>;
}
export declare class InboxOperationsService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Complete inbox task for task completion
     */
    completeInboxTask(taskId: string, action: string, options?: CompleteInboxTaskOptions): Promise<AEMResponse<InboxTaskOperationResult>>;
    /**
     * Update task status for status updates
     */
    updateTaskStatus(taskId: string, status: string, options?: UpdateTaskStatusOptions): Promise<AEMResponse<TaskStatusUpdateResult>>;
    /**
     * Cleanup page move items for page move success cleanup
     */
    cleanupPageMoveItems(options?: CleanupOptions): Promise<AEMResponse<CleanupResult>>;
    /**
     * Cleanup rollout items for rollout success cleanup
     */
    cleanupRolloutItems(options?: CleanupOptions): Promise<AEMResponse<CleanupResult>>;
    /**
     * Perform cleanup operation
     */
    private performCleanup;
    /**
     * Get items to cleanup
     */
    private getCleanupItems;
    /**
     * Cleanup individual item
     */
    private cleanupItem;
    /**
     * Parse inbox task operation response
     */
    private parseInboxTaskOperationResponse;
    /**
     * Parse task status update response
     */
    private parseTaskStatusUpdateResponse;
}
//# sourceMappingURL=inbox-operations-service.d.ts.map