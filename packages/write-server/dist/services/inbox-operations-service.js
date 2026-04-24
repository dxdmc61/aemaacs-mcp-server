/**
 * Inbox Operations Service for AEMaaCS write operations
 * Handles inbox task completion, status updates, and cleanup operations
 */
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';
export class InboxOperationsService {
    constructor(client) {
        this.client = client;
        this.logger = Logger.getInstance();
    }
    /**
     * Complete inbox task for task completion
     */
    async completeInboxTask(taskId, action, options = {}) {
        try {
            this.logger.debug('Completing inbox task', { taskId, action, options });
            if (!taskId || !action) {
                throw new AEMException('Task ID and action are required', 'VALIDATION_ERROR', false);
            }
            const formData = new FormData();
            formData.append('item', taskId);
            formData.append('action', action);
            if (options.comment) {
                formData.append('comment', options.comment);
            }
            if (options.notifyAssignee !== undefined) {
                formData.append('notifyAssignee', options.notifyAssignee.toString());
            }
            // Add task data
            if (options.taskData) {
                for (const [key, value] of Object.entries(options.taskData)) {
                    formData.append(`taskData.${key}`, value.toString());
                }
            }
            const requestOptions = {
                context: {
                    operation: 'completeInboxTask',
                    resource: taskId
                }
            };
            const response = await this.client.post('/libs/granite/taskmanager/updatetask', formData, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to complete inbox task: ${taskId}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const result = this.parseInboxTaskOperationResponse(response.data, taskId);
            this.logger.debug('Successfully completed inbox task', {
                taskId,
                action,
                success: result.success
            });
            return {
                success: true,
                data: result,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to complete inbox task', error, { taskId, action });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while completing inbox task: ${taskId}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, taskId, action });
        }
    }
    /**
     * Update task status for status updates
     */
    async updateTaskStatus(taskId, status, options = {}) {
        try {
            this.logger.debug('Updating task status', { taskId, status, options });
            if (!taskId || !status) {
                throw new AEMException('Task ID and status are required', 'VALIDATION_ERROR', false);
            }
            const formData = new FormData();
            formData.append('item', taskId);
            formData.append('status', status);
            if (options.comment) {
                formData.append('comment', options.comment);
            }
            if (options.assignee) {
                formData.append('assignee', options.assignee);
            }
            if (options.dueDate) {
                formData.append('dueDate', options.dueDate.toISOString());
            }
            if (options.priority !== undefined) {
                formData.append('priority', options.priority.toString());
            }
            // Add task data
            if (options.taskData) {
                for (const [key, value] of Object.entries(options.taskData)) {
                    formData.append(`taskData.${key}`, value.toString());
                }
            }
            const requestOptions = {
                context: {
                    operation: 'updateTaskStatus',
                    resource: taskId
                }
            };
            const response = await this.client.post('/libs/granite/taskmanager/updatetask', formData, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to update task status: ${taskId}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const result = this.parseTaskStatusUpdateResponse(response.data, taskId, status);
            this.logger.debug('Successfully updated task status', {
                taskId,
                status,
                success: result.success
            });
            return {
                success: true,
                data: result,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to update task status', error, { taskId, status });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while updating task status: ${taskId}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, taskId, status });
        }
    }
    /**
     * Cleanup page move items for page move success cleanup
     */
    async cleanupPageMoveItems(options = {}) {
        try {
            this.logger.debug('Cleaning up page move items', { options });
            const cleanupResult = await this.performCleanup('PAGE_MOVE', options);
            this.logger.debug('Successfully cleaned up page move items', {
                itemsProcessed: cleanupResult.itemsProcessed,
                itemsRemoved: cleanupResult.itemsRemoved
            });
            return {
                success: true,
                data: cleanupResult,
                metadata: {
                    timestamp: new Date(),
                    requestId: '',
                    duration: 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to cleanup page move items', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while cleaning up page move items', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * Cleanup rollout items for rollout success cleanup
     */
    async cleanupRolloutItems(options = {}) {
        try {
            this.logger.debug('Cleaning up rollout items', { options });
            const cleanupResult = await this.performCleanup('ROLLOUT', options);
            this.logger.debug('Successfully cleaned up rollout items', {
                itemsProcessed: cleanupResult.itemsProcessed,
                itemsRemoved: cleanupResult.itemsRemoved
            });
            return {
                success: true,
                data: cleanupResult,
                metadata: {
                    timestamp: new Date(),
                    requestId: '',
                    duration: 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to cleanup rollout items', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while cleaning up rollout items', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * Perform cleanup operation
     */
    async performCleanup(itemType, options) {
        const batchSize = options.batchSize || 50;
        const maxAge = options.maxAge || 30; // 30 days default
        const status = options.status || 'SUCCESS';
        // Get items to cleanup
        const items = await this.getCleanupItems(itemType, maxAge, status, batchSize);
        const results = [];
        let itemsProcessed = 0;
        let itemsRemoved = 0;
        let itemsFailed = 0;
        // Process items in batches
        for (const item of items) {
            try {
                itemsProcessed++;
                const success = await this.cleanupItem(item);
                if (success) {
                    itemsRemoved++;
                    results.push({
                        itemId: item.id,
                        itemType: item.type,
                        path: item.path,
                        success: true
                    });
                }
                else {
                    itemsFailed++;
                    results.push({
                        itemId: item.id,
                        itemType: item.type,
                        path: item.path,
                        success: false,
                        error: 'Failed to cleanup item'
                    });
                }
            }
            catch (error) {
                itemsFailed++;
                results.push({
                    itemId: item.id,
                    itemType: item.type,
                    path: item.path,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        return {
            success: true,
            itemsProcessed,
            itemsRemoved,
            itemsFailed,
            details: results,
            message: `Processed ${itemsProcessed} items, removed ${itemsRemoved}, failed ${itemsFailed}`
        };
    }
    /**
     * Get items to cleanup
     */
    async getCleanupItems(itemType, maxAge, status, limit) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxAge);
            const params = {
                'type': itemType,
                status,
                'createdBefore': cutoffDate.toISOString(),
                'p.limit': limit.toString()
            };
            const response = await this.client.get('/libs/granite/taskmanager/content/taskmanager.json', params);
            if (response.success && response.data && response.data.items) {
                return response.data.items.map((item) => ({
                    id: item.id || item.path,
                    type: item.type || itemType,
                    path: item.path,
                    created: item.created ? new Date(item.created) : new Date(),
                    status: item.status
                }));
            }
            return [];
        }
        catch (error) {
            this.logger.warn('Failed to get cleanup items', { itemType, status, error: error.message });
            return [];
        }
    }
    /**
     * Cleanup individual item
     */
    async cleanupItem(item) {
        try {
            const formData = new FormData();
            formData.append('item', item.id);
            formData.append('action', 'SUCCESS');
            formData.append('comment', 'Automated cleanup');
            const response = await this.client.post('/libs/granite/taskmanager/updatetask', formData);
            return response.success && response.data && response.data.success !== false;
        }
        catch (error) {
            this.logger.warn('Failed to cleanup item', { itemId: item.id, error: error.message });
            return false;
        }
    }
    /**
     * Parse inbox task operation response
     */
    parseInboxTaskOperationResponse(data, taskId) {
        return {
            success: Boolean(data.success !== false),
            taskId,
            message: data.message || data.msg,
            warnings: Array.isArray(data.warnings) ? data.warnings : (data.warning ? [data.warning] : []),
            errors: Array.isArray(data.errors) ? data.errors : (data.error ? [data.error] : [])
        };
    }
    /**
     * Parse task status update response
     */
    parseTaskStatusUpdateResponse(data, taskId, newStatus) {
        return {
            success: Boolean(data.success !== false),
            taskId,
            message: data.message || data.msg,
            previousStatus: data.previousStatus,
            newStatus,
            assignee: data.assignee,
            warnings: Array.isArray(data.warnings) ? data.warnings : (data.warning ? [data.warning] : []),
            errors: Array.isArray(data.errors) ? data.errors : (data.error ? [data.error] : [])
        };
    }
}
//# sourceMappingURL=inbox-operations-service.js.map