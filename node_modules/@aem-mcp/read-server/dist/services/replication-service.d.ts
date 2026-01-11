/**
 * Replication Service for AEMaaCS read operations
 * Handles distribution agents, publish logs, replication status, and queue monitoring
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
export interface DistributionAgent {
    id: string;
    name: string;
    title?: string;
    description?: string;
    enabled: boolean;
    type: 'publish' | 'unpublish' | 'invalidate' | 'test';
    transportUri?: string;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    queueProcessing: boolean;
    queueSize: number;
    status: 'idle' | 'running' | 'blocked' | 'paused';
    lastActivity?: Date;
    properties: Record<string, any>;
}
export interface PublishAgentLog {
    timestamp: Date;
    level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
    message: string;
    path?: string;
    action?: string;
    status?: string;
    details?: Record<string, any>;
}
export interface ReplicationStatus {
    path: string;
    status: 'published' | 'unpublished' | 'modified' | 'never-published';
    lastPublished?: Date;
    lastModified?: Date;
    publishedBy?: string;
    replicationAction?: 'activate' | 'deactivate' | 'delete';
    agents: AgentStatus[];
}
export interface AgentStatus {
    agentId: string;
    agentName?: string;
    status: 'success' | 'error' | 'pending' | 'blocked';
    lastReplication?: Date;
    errorMessage?: string;
    retryCount?: number;
}
export interface ReplicationQueueItem {
    id: string;
    path: string;
    action: 'activate' | 'deactivate' | 'delete' | 'test';
    agentId: string;
    created: Date;
    status: 'pending' | 'processing' | 'success' | 'error' | 'blocked';
    attempts: number;
    lastAttempt?: Date;
    errorMessage?: string;
    size?: number;
    priority: number;
}
export interface ReplicationQueue {
    agentId: string;
    agentName?: string;
    totalItems: number;
    pendingItems: number;
    processingItems: number;
    errorItems: number;
    blockedItems: number;
    items: ReplicationQueueItem[];
    lastProcessed?: Date;
    isProcessing: boolean;
}
export interface GetPublishAgentLogsOptions {
    agentId?: string;
    level?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
}
export interface GetReplicationQueueOptions {
    agentId?: string;
    status?: 'pending' | 'processing' | 'success' | 'error' | 'blocked';
    limit?: number;
    offset?: number;
}
export declare class ReplicationService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Get distribution agents for agent discovery
     */
    getDistributionAgents(): Promise<AEMResponse<DistributionAgent[]>>;
    /**
     * Get publish agent logs for log access
     */
    getPublishAgentLogs(options?: GetPublishAgentLogsOptions): Promise<AEMResponse<PublishAgentLog[]>>;
    /**
     * Get replication status for content status
     */
    getReplicationStatus(contentPath: string): Promise<AEMResponse<ReplicationStatus>>;
    /**
     * Get replication queue for queue monitoring
     */
    getReplicationQueue(options?: GetReplicationQueueOptions): Promise<AEMResponse<ReplicationQueue[]>>;
    /**
     * Parse distribution agents response
     */
    private parseDistributionAgentsResponse;
    /**
     * Parse publish agent logs response
     */
    private parsePublishAgentLogsResponse;
    /**
     * Parse replication status response
     */
    private parseReplicationStatusResponse;
    /**
     * Parse replication queue response
     */
    private parseReplicationQueueResponse;
    /**
     * Map data to DistributionAgent
     */
    private mapToDistributionAgent;
    /**
     * Map data to ReplicationQueue
     */
    private mapToReplicationQueue;
    /**
     * Map log level string to enum
     */
    private mapLogLevel;
    /**
     * Map agent status string to enum
     */
    private mapAgentStatus;
    /**
     * Map replication status string to enum
     */
    private mapReplicationStatus;
    /**
     * Map replication action string to enum
     */
    private mapReplicationAction;
    /**
     * Map agent type string to enum
     */
    private mapAgentType;
    /**
     * Map agent running status string to enum
     */
    private mapAgentRunningStatus;
    /**
     * Map queue item status string to enum
     */
    private mapQueueItemStatus;
}
//# sourceMappingURL=replication-service.d.ts.map