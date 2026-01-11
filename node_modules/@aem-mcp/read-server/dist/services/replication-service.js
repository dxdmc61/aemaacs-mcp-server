/**
 * Replication Service for AEMaaCS read operations
 * Handles distribution agents, publish logs, replication status, and queue monitoring
 */
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';
export class ReplicationService {
    constructor(client) {
        this.client = client;
        this.logger = Logger.getInstance();
    }
    /**
     * Get distribution agents for agent discovery
     */
    async getDistributionAgents() {
        try {
            this.logger.debug('Getting distribution agents');
            const requestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'getDistributionAgents',
                    resource: '/libs/sling/distribution/services/agents'
                }
            };
            // Get distribution agents
            const response = await this.client.get('/libs/sling/distribution/services/agents.json', undefined, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to get distribution agents', 'SERVER_ERROR', true, undefined, { response });
            }
            const agents = this.parseDistributionAgentsResponse(response.data);
            this.logger.debug('Successfully retrieved distribution agents', {
                agentCount: agents.length
            });
            return {
                success: true,
                data: agents,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get distribution agents', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while getting distribution agents', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * Get publish agent logs for log access
     */
    async getPublishAgentLogs(options = {}) {
        try {
            this.logger.debug('Getting publish agent logs', { options });
            const params = {
                'p.limit': options.limit || 100,
                'p.offset': options.offset || 0
            };
            // Add agent filter
            if (options.agentId) {
                params['agent'] = options.agentId;
            }
            // Add level filter
            if (options.level) {
                params['level'] = options.level;
            }
            // Add time range filters
            if (options.startTime) {
                params['startTime'] = options.startTime.toISOString();
            }
            if (options.endTime) {
                params['endTime'] = options.endTime.toISOString();
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 60000, // Cache for 1 minute (logs change frequently)
                context: {
                    operation: 'getPublishAgentLogs',
                    resource: '/var/replication/agents.publish'
                }
            };
            const response = await this.client.get('/bin/replication/agents.publish/log.json', params, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to get publish agent logs', 'SERVER_ERROR', true, undefined, { response });
            }
            const logs = this.parsePublishAgentLogsResponse(response.data);
            this.logger.debug('Successfully retrieved publish agent logs', {
                logCount: logs.length
            });
            return {
                success: true,
                data: logs,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get publish agent logs', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while getting publish agent logs', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * Get replication status for content status
     */
    async getReplicationStatus(contentPath) {
        try {
            this.logger.debug('Getting replication status', { contentPath });
            if (!contentPath) {
                throw new AEMException('Content path is required', 'VALIDATION_ERROR', false);
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 180000, // Cache for 3 minutes
                context: {
                    operation: 'getReplicationStatus',
                    resource: contentPath
                }
            };
            // Get replication status
            const response = await this.client.get('/bin/replicate.json', { path: contentPath, cmd: 'status' }, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to get replication status for ${contentPath}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const replicationStatus = this.parseReplicationStatusResponse(response.data, contentPath);
            this.logger.debug('Successfully retrieved replication status', {
                contentPath,
                status: replicationStatus.status
            });
            return {
                success: true,
                data: replicationStatus,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get replication status', error, { contentPath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting replication status for ${contentPath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, contentPath });
        }
    }
    /**
     * Get replication queue for queue monitoring
     */
    async getReplicationQueue(options = {}) {
        try {
            this.logger.debug('Getting replication queue', { options });
            const params = {
                'p.limit': options.limit || 50,
                'p.offset': options.offset || 0
            };
            // Add agent filter
            if (options.agentId) {
                params['agent'] = options.agentId;
            }
            // Add status filter
            if (options.status) {
                params['status'] = options.status;
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 30000, // Cache for 30 seconds (queue changes frequently)
                context: {
                    operation: 'getReplicationQueue',
                    resource: '/var/replication/agents'
                }
            };
            const response = await this.client.get('/bin/replication/queue.json', params, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to get replication queue', 'SERVER_ERROR', true, undefined, { response });
            }
            const queues = this.parseReplicationQueueResponse(response.data);
            this.logger.debug('Successfully retrieved replication queue', {
                queueCount: queues.length
            });
            return {
                success: true,
                data: queues,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get replication queue', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while getting replication queue', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * Parse distribution agents response
     */
    parseDistributionAgentsResponse(data) {
        const agents = [];
        if (Array.isArray(data)) {
            for (const agent of data) {
                agents.push(this.mapToDistributionAgent(agent));
            }
        }
        else if (typeof data === 'object') {
            // Handle object format where agents are properties
            for (const [key, value] of Object.entries(data)) {
                if (typeof value === 'object' && value !== null) {
                    const agent = this.mapToDistributionAgent(value, key);
                    agents.push(agent);
                }
            }
        }
        return agents;
    }
    /**
     * Parse publish agent logs response
     */
    parsePublishAgentLogsResponse(data) {
        const logs = [];
        if (Array.isArray(data)) {
            for (const log of data) {
                logs.push({
                    timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
                    level: this.mapLogLevel(log.level),
                    message: log.message || '',
                    path: log.path,
                    action: log.action,
                    status: log.status,
                    details: log.details || {}
                });
            }
        }
        else if (data.logs && Array.isArray(data.logs)) {
            for (const log of data.logs) {
                logs.push({
                    timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
                    level: this.mapLogLevel(log.level),
                    message: log.message || '',
                    path: log.path,
                    action: log.action,
                    status: log.status,
                    details: log.details || {}
                });
            }
        }
        // Sort by timestamp (newest first)
        logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return logs;
    }
    /**
     * Parse replication status response
     */
    parseReplicationStatusResponse(data, contentPath) {
        const agents = [];
        // Parse agent statuses
        if (data.agents && Array.isArray(data.agents)) {
            for (const agent of data.agents) {
                agents.push({
                    agentId: agent.id || agent.name || 'unknown',
                    agentName: agent.name || agent.title,
                    status: this.mapAgentStatus(agent.status),
                    lastReplication: agent.lastReplication ? new Date(agent.lastReplication) : undefined,
                    errorMessage: agent.error || agent.errorMessage,
                    retryCount: agent.retryCount ? parseInt(agent.retryCount) : undefined
                });
            }
        }
        return {
            path: contentPath,
            status: this.mapReplicationStatus(data.status),
            lastPublished: data.lastPublished ? new Date(data.lastPublished) : undefined,
            lastModified: data.lastModified ? new Date(data.lastModified) : undefined,
            publishedBy: data.publishedBy,
            replicationAction: this.mapReplicationAction(data.action),
            agents
        };
    }
    /**
     * Parse replication queue response
     */
    parseReplicationQueueResponse(data) {
        const queues = [];
        if (Array.isArray(data)) {
            for (const queue of data) {
                queues.push(this.mapToReplicationQueue(queue));
            }
        }
        else if (typeof data === 'object') {
            // Handle object format where queues are properties
            for (const [key, value] of Object.entries(data)) {
                if (typeof value === 'object' && value !== null) {
                    const queue = this.mapToReplicationQueue(value, key);
                    queues.push(queue);
                }
            }
        }
        return queues;
    }
    /**
     * Map data to DistributionAgent
     */
    mapToDistributionAgent(data, id) {
        return {
            id: id || data.id || data.name || 'unknown',
            name: data.name || data.title || id || 'unknown',
            title: data.title,
            description: data.description,
            enabled: Boolean(data.enabled !== false),
            type: this.mapAgentType(data.type),
            transportUri: data.transportUri || data.endpoint,
            logLevel: this.mapLogLevel(data.logLevel),
            queueProcessing: Boolean(data.queueProcessing !== false),
            queueSize: parseInt(data.queueSize) || 0,
            status: this.mapAgentRunningStatus(data.status),
            lastActivity: data.lastActivity ? new Date(data.lastActivity) : undefined,
            properties: { ...data }
        };
    }
    /**
     * Map data to ReplicationQueue
     */
    mapToReplicationQueue(data, agentId) {
        const items = [];
        if (data.items && Array.isArray(data.items)) {
            for (const item of data.items) {
                items.push({
                    id: item.id || item.path || 'unknown',
                    path: item.path || '',
                    action: this.mapReplicationAction(item.action) || 'activate',
                    agentId: agentId || item.agentId || 'unknown',
                    created: item.created ? new Date(item.created) : new Date(),
                    status: this.mapQueueItemStatus(item.status),
                    attempts: parseInt(item.attempts) || 0,
                    lastAttempt: item.lastAttempt ? new Date(item.lastAttempt) : undefined,
                    errorMessage: item.error || item.errorMessage,
                    size: item.size ? parseInt(item.size) : undefined,
                    priority: parseInt(item.priority) || 0
                });
            }
        }
        return {
            agentId: agentId || data.agentId || 'unknown',
            agentName: data.agentName || data.name,
            totalItems: parseInt(data.totalItems) || items.length,
            pendingItems: parseInt(data.pendingItems) || items.filter(i => i.status === 'pending').length,
            processingItems: parseInt(data.processingItems) || items.filter(i => i.status === 'processing').length,
            errorItems: parseInt(data.errorItems) || items.filter(i => i.status === 'error').length,
            blockedItems: parseInt(data.blockedItems) || items.filter(i => i.status === 'blocked').length,
            items,
            lastProcessed: data.lastProcessed ? new Date(data.lastProcessed) : undefined,
            isProcessing: Boolean(data.isProcessing)
        };
    }
    /**
     * Map log level string to enum
     */
    mapLogLevel(level) {
        if (!level)
            return 'INFO';
        const levelUpper = level.toUpperCase();
        if (levelUpper === 'ERROR')
            return 'ERROR';
        if (levelUpper === 'WARN' || levelUpper === 'WARNING')
            return 'WARN';
        if (levelUpper === 'DEBUG')
            return 'DEBUG';
        return 'INFO';
    }
    /**
     * Map agent status string to enum
     */
    mapAgentStatus(status) {
        if (!status)
            return 'pending';
        const statusLower = status.toLowerCase();
        if (statusLower === 'success' || statusLower === 'ok')
            return 'success';
        if (statusLower === 'error' || statusLower === 'failed')
            return 'error';
        if (statusLower === 'blocked')
            return 'blocked';
        return 'pending';
    }
    /**
     * Map replication status string to enum
     */
    mapReplicationStatus(status) {
        if (!status)
            return 'never-published';
        const statusLower = status.toLowerCase();
        if (statusLower === 'published' || statusLower === 'activated')
            return 'published';
        if (statusLower === 'unpublished' || statusLower === 'deactivated')
            return 'unpublished';
        if (statusLower === 'modified' || statusLower === 'outdated')
            return 'modified';
        return 'never-published';
    }
    /**
     * Map replication action string to enum
     */
    mapReplicationAction(action) {
        if (!action)
            return undefined;
        const actionLower = action.toLowerCase();
        if (actionLower === 'activate' || actionLower === 'publish')
            return 'activate';
        if (actionLower === 'deactivate' || actionLower === 'unpublish')
            return 'deactivate';
        if (actionLower === 'delete')
            return 'delete';
        return 'activate';
    }
    /**
     * Map agent type string to enum
     */
    mapAgentType(type) {
        if (!type)
            return 'publish';
        const typeLower = type.toLowerCase();
        if (typeLower === 'unpublish' || typeLower === 'deactivate')
            return 'unpublish';
        if (typeLower === 'invalidate' || typeLower === 'flush')
            return 'invalidate';
        if (typeLower === 'test')
            return 'test';
        return 'publish';
    }
    /**
     * Map agent running status string to enum
     */
    mapAgentRunningStatus(status) {
        if (!status)
            return 'idle';
        const statusLower = status.toLowerCase();
        if (statusLower === 'running' || statusLower === 'active')
            return 'running';
        if (statusLower === 'blocked')
            return 'blocked';
        if (statusLower === 'paused' || statusLower === 'stopped')
            return 'paused';
        return 'idle';
    }
    /**
     * Map queue item status string to enum
     */
    mapQueueItemStatus(status) {
        if (!status)
            return 'pending';
        const statusLower = status.toLowerCase();
        if (statusLower === 'processing' || statusLower === 'running')
            return 'processing';
        if (statusLower === 'success' || statusLower === 'completed')
            return 'success';
        if (statusLower === 'error' || statusLower === 'failed')
            return 'error';
        if (statusLower === 'blocked')
            return 'blocked';
        return 'pending';
    }
}
//# sourceMappingURL=replication-service.js.map