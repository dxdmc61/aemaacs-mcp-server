/**
 * Replication Operations Service for AEMaaCS write operations
 * Handles content publishing, unpublishing, activation, and replication queue management
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
export interface PublishOptions {
    deep?: boolean;
    onlyModified?: boolean;
    onlyActivated?: boolean;
    ignoreDeactivated?: boolean;
    force?: boolean;
    synchronous?: boolean;
}
export interface UnpublishOptions {
    deep?: boolean;
    force?: boolean;
    synchronous?: boolean;
}
export interface WorkflowOptions {
    model?: string;
    payload?: string;
    payloadType?: 'JCR_PATH' | 'JCR_UUID';
    title?: string;
    comment?: string;
    initiator?: string;
}
export interface QueueOptions {
    agent?: string;
    force?: boolean;
}
export interface ReplicationQueueStatus {
    agentName: string;
    queueSize: number;
    pendingItems: number;
    failedItems: number;
    lastProcessed?: Date;
    status: 'active' | 'inactive' | 'error';
    errors?: string[];
}
export interface ReplicationAgent {
    name: string;
    title: string;
    type: 'publish' | 'reverse' | 'flush' | 'distribution';
    status: 'active' | 'inactive' | 'error';
    enabled: boolean;
    uri?: string;
    userId?: string;
    logLevel?: string;
    retryDelay?: number;
    serializationType?: string;
    queueProcessingEnabled?: boolean;
    queueMaxParallelJobs?: number;
    queueBatchSize?: number;
    queueBatchWaitTime?: number;
    lastModified?: Date;
}
export interface ScheduledPublishOptions {
    scheduleDate: Date;
    timezone?: string;
    deep?: boolean;
    onlyModified?: boolean;
    onlyActivated?: boolean;
    ignoreDeactivated?: boolean;
    force?: boolean;
    workflowModel?: string;
    comment?: string;
    initiator?: string;
}
export interface ScheduledPublishJob {
    id: string;
    contentPath: string;
    scheduleDate: Date;
    status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
    createdBy: string;
    createdAt: Date;
    lastModified: Date;
    options: ScheduledPublishOptions;
    result?: PublishResult;
    error?: string;
}
export interface ReplicationResult {
    success: boolean;
    path?: string;
    action?: string;
    status?: string;
    message?: string;
    warnings?: string[];
    errors?: string[];
}
export interface PublishResult extends ReplicationResult {
    publishedPaths?: string[];
    skippedPaths?: string[];
    failedPaths?: string[];
}
export interface WorkflowResult extends ReplicationResult {
    workflowId?: string;
    workflowModel?: string;
    workflowStatus?: string;
}
export interface QueueResult extends ReplicationResult {
    queueId?: string;
    itemsCleared?: number;
    itemsDeleted?: number;
}
export declare class ReplicationOperationsService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Publish content using /bin/replicate.json
     */
    publishContent(contentPath: string, options?: PublishOptions): Promise<AEMResponse<PublishResult>>;
    /**
     * Unpublish content with tree support
     */
    unpublishContent(contentPath: string, options?: UnpublishOptions): Promise<AEMResponse<PublishResult>>;
    /**
     * Activate page (legacy method for backward compatibility)
     */
    activatePage(pagePath: string, options?: PublishOptions): Promise<AEMResponse<ReplicationResult>>;
    /**
     * Deactivate page (legacy method for backward compatibility)
     */
    deactivatePage(pagePath: string, options?: UnpublishOptions): Promise<AEMResponse<ReplicationResult>>;
    /**
     * Trigger publish workflow for workflow-based publishing
     */
    triggerPublishWorkflow(contentPath: string, options?: WorkflowOptions): Promise<AEMResponse<WorkflowResult>>;
    /**
     * Trigger custom workflow for custom workflows
     */
    triggerCustomWorkflow(workflowModel: string, payload: string, options?: Omit<WorkflowOptions, 'model' | 'payload'>): Promise<AEMResponse<WorkflowResult>>;
    /**
     * Clear replication queue
     */
    clearReplicationQueue(agentName?: string, options?: QueueOptions): Promise<AEMResponse<QueueResult>>;
    /**
     * Delete specific queue item
     */
    deleteQueueItem(agentName: string, itemId: string, options?: QueueOptions): Promise<AEMResponse<QueueResult>>;
    /**
     * Get replication queue status for all agents
     */
    getReplicationQueueStatus(): Promise<AEMResponse<ReplicationQueueStatus[]>>;
    /**
     * Get specific agent queue status
     */
    getAgentQueueStatus(agentName: string): Promise<AEMResponse<ReplicationQueueStatus>>;
    /**
     * List all replication agents
     */
    listReplicationAgents(): Promise<AEMResponse<ReplicationAgent[]>>;
    /**
     * Get specific replication agent details
     */
    getReplicationAgent(agentName: string): Promise<AEMResponse<ReplicationAgent>>;
    /**
     * Update replication agent configuration
     */
    updateReplicationAgent(agentName: string, updates: Partial<ReplicationAgent>): Promise<AEMResponse<ReplicationAgent>>;
    /**
     * Schedule content for future publishing
     */
    schedulePublish(contentPath: string, options: ScheduledPublishOptions): Promise<AEMResponse<ScheduledPublishJob>>;
    /**
     * Get scheduled publish jobs
     */
    getScheduledPublishJobs(): Promise<AEMResponse<ScheduledPublishJob[]>>;
    /**
     * Cancel scheduled publish job
     */
    cancelScheduledPublish(jobId: string): Promise<AEMResponse<boolean>>;
    /**
     * Parse publish/unpublish response
     */
    private parsePublishResponse;
    /**
     * Parse queue status response
     */
    private parseQueueStatusResponse;
    /**
     * Parse agent queue status
     */
    private parseAgentQueueStatus;
    /**
     * Parse replication agents response
     */
    private parseReplicationAgentsResponse;
    /**
     * Parse replication agent response
     */
    private parseReplicationAgentResponse;
    /**
     * Determine agent type from name
     */
    private determineAgentType;
    /**
     * Parse scheduled publish jobs response
     */
    private parseScheduledPublishJobsResponse;
}
//# sourceMappingURL=replication-operations-service.d.ts.map