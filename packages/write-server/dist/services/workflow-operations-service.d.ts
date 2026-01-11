/**
 * Workflow Operations Service for AEMaaCS write operations
 * Handles workflow starting, asset processing, and task completion
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
export interface StartWorkflowOptions {
    workflowTitle?: string;
    startComment?: string;
    workflowData?: Record<string, any>;
}
export interface StartPublishWorkflowOptions {
    workflowTitle?: string;
    startComment?: string;
    replicateAsTree?: boolean;
    activateTree?: boolean;
    ignoreDeactivated?: boolean;
}
export interface ProcessAssetsOptions {
    profile?: string;
    async?: boolean;
    wait?: boolean;
    batchSize?: number;
}
export interface CompleteWorkflowTaskOptions {
    comment?: string;
    workflowData?: Record<string, any>;
}
export interface WorkflowInstance {
    id: string;
    title?: string;
    model: string;
    payload: string;
    payloadType: string;
    initiator?: string;
    status: 'RUNNING' | 'COMPLETED' | 'ABORTED' | 'SUSPENDED';
    startTime?: Date;
    endTime?: Date;
    comment?: string;
    workflowData?: Record<string, any>;
}
export interface WorkflowTask {
    id: string;
    workflowId: string;
    title?: string;
    description?: string;
    assignee?: string;
    status: 'ACTIVE' | 'COMPLETED' | 'TERMINATED';
    created?: Date;
    completed?: Date;
    dueDate?: Date;
    priority: number;
    formResourcePath?: string;
    taskData?: Record<string, any>;
}
export interface ProcessResult {
    success: boolean;
    jobId?: string;
    status: 'INITIATED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    processedItems?: number;
    totalItems?: number;
    errors?: string[];
    warnings?: string[];
}
export interface TaskResult {
    success: boolean;
    taskId: string;
    action: string;
    message?: string;
    nextTasks?: WorkflowTask[];
}
export interface WorkflowModel {
    path: string;
    title?: string;
    description?: string;
    version?: string;
    enabled?: boolean;
    created?: Date;
    lastModified?: Date;
    createdBy?: string;
    lastModifiedBy?: string;
    nodes?: WorkflowNode[];
    transitions?: WorkflowTransition[];
}
export interface WorkflowNode {
    id: string;
    title?: string;
    type: 'START' | 'END' | 'PARTICIPANT' | 'PROCESS' | 'SPLIT' | 'OR_SPLIT' | 'AND_SPLIT' | 'MERGE' | 'OR_MERGE' | 'AND_MERGE';
    description?: string;
    assignee?: string;
    formResourcePath?: string;
    script?: string;
    properties?: Record<string, any>;
}
export interface WorkflowTransition {
    from: string;
    to: string;
    title?: string;
    condition?: string;
    script?: string;
}
export interface WorkflowInstanceQuery {
    model?: string;
    status?: 'RUNNING' | 'COMPLETED' | 'ABORTED' | 'SUSPENDED';
    initiator?: string;
    payload?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}
export interface WorkflowInstanceResult {
    instances: WorkflowInstance[];
    total: number;
    offset: number;
    limit: number;
}
export interface WorkflowTaskQuery {
    workflowId?: string;
    assignee?: string;
    status?: 'ACTIVE' | 'COMPLETED' | 'TERMINATED';
    createdDate?: Date;
    dueDate?: Date;
    limit?: number;
    offset?: number;
}
export interface WorkflowTaskResult {
    tasks: WorkflowTask[];
    total: number;
    offset: number;
    limit: number;
}
export declare class WorkflowOperationsService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Start workflow using /etc/workflow/instances
     */
    startWorkflow(modelPath: string, payloadPath: string, options?: StartWorkflowOptions): Promise<AEMResponse<WorkflowInstance>>;
    /**
     * Start publish workflow for content publishing
     */
    startPublishWorkflow(contentPath: string, options?: StartPublishWorkflowOptions): Promise<AEMResponse<WorkflowInstance>>;
    /**
     * Process assets for asset workflow processing
     */
    processAssets(folderPath: string, options?: ProcessAssetsOptions): Promise<AEMResponse<ProcessResult>>;
    /**
     * Complete workflow task for task completion
     */
    completeWorkflowTask(taskId: string, action: string, options?: CompleteWorkflowTaskOptions): Promise<AEMResponse<TaskResult>>;
    /**
     * Parse workflow instance response
     */
    private parseWorkflowInstanceResponse;
    /**
     * Parse process assets response
     */
    private parseProcessAssetsResponse;
    /**
     * Parse task completion response
     */
    private parseTaskCompletionResponse;
    /**
     * Map workflow status string to enum
     */
    private mapWorkflowStatus;
    /**
     * Map process status string to enum
     */
    private mapProcessStatus;
    /**
     * Map task status string to enum
     */
    private mapTaskStatus;
    /**
     * List all available workflow models
     */
    listWorkflowModels(): Promise<AEMResponse<WorkflowModel[]>>;
    /**
     * Get workflow model details
     */
    getWorkflowModel(modelPath: string): Promise<AEMResponse<WorkflowModel>>;
    /**
     * Get workflow instances with query options
     */
    getWorkflowInstances(query?: WorkflowInstanceQuery): Promise<AEMResponse<WorkflowInstanceResult>>;
    /**
     * Get specific workflow instance
     */
    getWorkflowInstance(instanceId: string): Promise<AEMResponse<WorkflowInstance>>;
    /**
     * Abort workflow instance
     */
    abortWorkflowInstance(instanceId: string, comment?: string): Promise<AEMResponse<WorkflowInstance>>;
    /**
     * Suspend workflow instance
     */
    suspendWorkflowInstance(instanceId: string, comment?: string): Promise<AEMResponse<WorkflowInstance>>;
    /**
     * Resume workflow instance
     */
    resumeWorkflowInstance(instanceId: string, comment?: string): Promise<AEMResponse<WorkflowInstance>>;
    /**
     * Get workflow tasks with query options
     */
    getWorkflowTasks(query?: WorkflowTaskQuery): Promise<AEMResponse<WorkflowTaskResult>>;
    /**
     * Get specific workflow task
     */
    getWorkflowTask(taskId: string): Promise<AEMResponse<WorkflowTask>>;
    /**
     * Parse workflow nodes from data
     */
    private parseWorkflowNodes;
    /**
     * Parse workflow transitions from data
     */
    private parseWorkflowTransitions;
    /**
     * Parse workflow instance from raw data
     */
    private parseWorkflowInstanceFromData;
    /**
     * Parse workflow task from raw data
     */
    private parseWorkflowTaskFromData;
    /**
     * Wait for asset processing completion
     */
    private waitForAssetProcessingCompletion;
}
//# sourceMappingURL=workflow-operations-service.d.ts.map