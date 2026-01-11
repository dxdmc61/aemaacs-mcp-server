/**
 * Workflow Operations Service for AEMaaCS write operations
 * Handles workflow starting, asset processing, and task completion
 */
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';
export class WorkflowOperationsService {
    constructor(client) {
        this.client = client;
        this.logger = Logger.getInstance();
    }
    /**
     * Start workflow using /etc/workflow/instances
     */
    async startWorkflow(modelPath, payloadPath, options = {}) {
        try {
            this.logger.debug('Starting workflow', { modelPath, payloadPath, options });
            if (!modelPath || !payloadPath) {
                throw new AEMException('Workflow model path and payload path are required', 'VALIDATION_ERROR', false);
            }
            const formData = new FormData();
            formData.append('model', modelPath);
            formData.append('payload', payloadPath);
            formData.append('payloadType', 'JCR_PATH');
            if (options.workflowTitle) {
                formData.append('workflowTitle', options.workflowTitle);
            }
            if (options.startComment) {
                formData.append('startComment', options.startComment);
            }
            // Add workflow data
            if (options.workflowData) {
                for (const [key, value] of Object.entries(options.workflowData)) {
                    formData.append(`workflowData.${key}`, value.toString());
                }
            }
            const requestOptions = {
                context: {
                    operation: 'startWorkflow',
                    resource: payloadPath
                }
            };
            const response = await this.client.post('/etc/workflow/instances', formData, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to start workflow for: ${payloadPath}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const workflowInstance = this.parseWorkflowInstanceResponse(response.data, modelPath, payloadPath);
            this.logger.debug('Successfully started workflow', {
                modelPath,
                payloadPath,
                workflowId: workflowInstance.id
            });
            return {
                success: true,
                data: workflowInstance,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to start workflow', error, { modelPath, payloadPath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while starting workflow: ${modelPath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, modelPath, payloadPath });
        }
    }
    /**
     * Start publish workflow for content publishing
     */
    async startPublishWorkflow(contentPath, options = {}) {
        try {
            this.logger.debug('Starting publish workflow', { contentPath, options });
            if (!contentPath) {
                throw new AEMException('Content path is required', 'VALIDATION_ERROR', false);
            }
            const modelPath = '/etc/workflow/models/publish-content-tree/jcr:content/model';
            const formData = new FormData();
            formData.append('model', modelPath);
            formData.append('payload', contentPath);
            formData.append('payloadType', 'JCR_PATH');
            const workflowTitle = options.workflowTitle || `Publish Content Tree - ${contentPath}`;
            formData.append('workflowTitle', workflowTitle);
            if (options.startComment) {
                formData.append('startComment', options.startComment);
            }
            // Add publish-specific workflow data
            if (options.replicateAsTree !== undefined) {
                formData.append('workflowData.replicateAsTree', options.replicateAsTree.toString());
            }
            if (options.activateTree !== undefined) {
                formData.append('workflowData.activateTree', options.activateTree.toString());
            }
            if (options.ignoreDeactivated !== undefined) {
                formData.append('workflowData.ignoreDeactivated', options.ignoreDeactivated.toString());
            }
            const requestOptions = {
                context: {
                    operation: 'startPublishWorkflow',
                    resource: contentPath
                }
            };
            const response = await this.client.post('/etc/workflow/instances', formData, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to start publish workflow for: ${contentPath}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const workflowInstance = this.parseWorkflowInstanceResponse(response.data, modelPath, contentPath);
            this.logger.debug('Successfully started publish workflow', {
                contentPath,
                workflowId: workflowInstance.id
            });
            return {
                success: true,
                data: workflowInstance,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to start publish workflow', error, { contentPath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while starting publish workflow: ${contentPath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, contentPath });
        }
    }
    /**
     * Process assets for asset workflow processing
     */
    async processAssets(folderPath, options = {}) {
        try {
            this.logger.debug('Processing assets', { folderPath, options });
            if (!folderPath) {
                throw new AEMException('Folder path is required', 'VALIDATION_ERROR', false);
            }
            // Validate folder path is in DAM
            if (!folderPath.startsWith('/content/dam/')) {
                throw new AEMException('Asset processing folder path must be in DAM (/content/dam/)', 'VALIDATION_ERROR', false);
            }
            const formData = new FormData();
            formData.append('folderPath', folderPath);
            if (options.profile) {
                formData.append('profile', options.profile);
            }
            else {
                formData.append('profile', 'dam-update-asset'); // Default processing profile
            }
            if (options.async !== undefined) {
                formData.append('async', options.async.toString());
            }
            else {
                formData.append('async', 'true'); // Default to async processing
            }
            if (options.batchSize) {
                formData.append('batchSize', options.batchSize.toString());
            }
            const requestOptions = {
                context: {
                    operation: 'processAssets',
                    resource: folderPath
                }
            };
            const response = await this.client.post('/bin/asynccommand', formData, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to process assets in: ${folderPath}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const processResult = this.parseProcessAssetsResponse(response.data, folderPath);
            this.logger.debug('Successfully initiated asset processing', {
                folderPath,
                jobId: processResult.jobId,
                status: processResult.status
            });
            // If wait option is true and processing is async, poll for completion
            if (options.wait && options.async !== false && processResult.jobId) {
                await this.waitForAssetProcessingCompletion(processResult.jobId);
                processResult.status = 'COMPLETED';
            }
            return {
                success: true,
                data: processResult,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to process assets', error, { folderPath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while processing assets: ${folderPath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, folderPath });
        }
    }
    /**
     * Complete workflow task for task completion
     */
    async completeWorkflowTask(taskId, action, options = {}) {
        try {
            this.logger.debug('Completing workflow task', { taskId, action, options });
            if (!taskId || !action) {
                throw new AEMException('Task ID and action are required', 'VALIDATION_ERROR', false);
            }
            const formData = new FormData();
            formData.append('item', taskId);
            formData.append('action', action);
            if (options.comment) {
                formData.append('comment', options.comment);
            }
            // Add workflow data
            if (options.workflowData) {
                for (const [key, value] of Object.entries(options.workflowData)) {
                    formData.append(`workflowData.${key}`, value.toString());
                }
            }
            const requestOptions = {
                context: {
                    operation: 'completeWorkflowTask',
                    resource: taskId
                }
            };
            const response = await this.client.post('/libs/granite/taskmanager/updatetask', formData, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to complete workflow task: ${taskId}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const taskResult = this.parseTaskCompletionResponse(response.data, taskId, action);
            this.logger.debug('Successfully completed workflow task', {
                taskId,
                action,
                success: taskResult.success
            });
            return {
                success: true,
                data: taskResult,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to complete workflow task', error, { taskId, action });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while completing workflow task: ${taskId}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, taskId, action });
        }
    }
    /**
     * Parse workflow instance response
     */
    parseWorkflowInstanceResponse(data, modelPath, payloadPath) {
        return {
            id: data.id || data.workflowId || '',
            title: data.title || data.workflowTitle,
            model: data.model || modelPath,
            payload: data.payload || payloadPath,
            payloadType: data.payloadType || 'JCR_PATH',
            initiator: data.initiator || data.userId,
            status: this.mapWorkflowStatus(data.status),
            startTime: data.startTime ? new Date(data.startTime) : new Date(),
            endTime: data.endTime ? new Date(data.endTime) : undefined,
            comment: data.comment || data.startComment,
            workflowData: data.workflowData || {}
        };
    }
    /**
     * Parse process assets response
     */
    parseProcessAssetsResponse(data, folderPath) {
        return {
            success: Boolean(data.success !== false),
            jobId: data.jobId || data.id,
            status: this.mapProcessStatus(data.status),
            processedItems: data.processedItems ? parseInt(data.processedItems) : undefined,
            totalItems: data.totalItems ? parseInt(data.totalItems) : undefined,
            errors: Array.isArray(data.errors) ? data.errors : (data.error ? [data.error] : []),
            warnings: Array.isArray(data.warnings) ? data.warnings : (data.warning ? [data.warning] : [])
        };
    }
    /**
     * Parse task completion response
     */
    parseTaskCompletionResponse(data, taskId, action) {
        const nextTasks = [];
        if (data.nextTasks && Array.isArray(data.nextTasks)) {
            for (const task of data.nextTasks) {
                nextTasks.push({
                    id: task.id || '',
                    workflowId: task.workflowId || '',
                    title: task.title,
                    description: task.description,
                    assignee: task.assignee,
                    status: this.mapTaskStatus(task.status),
                    created: task.created ? new Date(task.created) : undefined,
                    completed: task.completed ? new Date(task.completed) : undefined,
                    dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
                    priority: parseInt(task.priority) || 0,
                    formResourcePath: task.formResourcePath,
                    taskData: task.taskData || {}
                });
            }
        }
        return {
            success: Boolean(data.success !== false),
            taskId,
            action,
            message: data.message || data.msg,
            nextTasks: nextTasks.length > 0 ? nextTasks : undefined
        };
    }
    /**
     * Map workflow status string to enum
     */
    mapWorkflowStatus(status) {
        if (!status)
            return 'RUNNING';
        const statusUpper = status.toUpperCase();
        if (statusUpper === 'COMPLETED' || statusUpper === 'FINISHED')
            return 'COMPLETED';
        if (statusUpper === 'ABORTED' || statusUpper === 'CANCELLED')
            return 'ABORTED';
        if (statusUpper === 'SUSPENDED' || statusUpper === 'PAUSED')
            return 'SUSPENDED';
        return 'RUNNING';
    }
    /**
     * Map process status string to enum
     */
    mapProcessStatus(status) {
        if (!status)
            return 'INITIATED';
        const statusUpper = status.toUpperCase();
        if (statusUpper === 'RUNNING' || statusUpper === 'PROCESSING')
            return 'RUNNING';
        if (statusUpper === 'COMPLETED' || statusUpper === 'FINISHED')
            return 'COMPLETED';
        if (statusUpper === 'FAILED' || statusUpper === 'ERROR')
            return 'FAILED';
        return 'INITIATED';
    }
    /**
     * Map task status string to enum
     */
    mapTaskStatus(status) {
        if (!status)
            return 'ACTIVE';
        const statusUpper = status.toUpperCase();
        if (statusUpper === 'COMPLETED' || statusUpper === 'FINISHED')
            return 'COMPLETED';
        if (statusUpper === 'TERMINATED' || statusUpper === 'CANCELLED')
            return 'TERMINATED';
        return 'ACTIVE';
    }
    // ============================================================================
    // WORKFLOW DISCOVERY OPERATIONS
    // ============================================================================
    /**
     * List all available workflow models
     */
    async listWorkflowModels() {
        try {
            this.logger.debug('Listing workflow models');
            const requestOptions = {
                context: {
                    operation: 'listWorkflowModels',
                    resource: '/etc/workflow/models'
                }
            };
            const response = await this.client.get('/etc/workflow/models.json', requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to list workflow models', 'SERVER_ERROR', true, undefined, { response });
            }
            const models = [];
            if (response.data) {
                for (const [path, data] of Object.entries(response.data)) {
                    if (typeof data === 'object' && data !== null) {
                        const modelData = data;
                        models.push({
                            path,
                            title: modelData.title || modelData['jcr:title'],
                            description: modelData.description || modelData['jcr:description'],
                            version: modelData.version,
                            enabled: modelData.enabled !== false,
                            created: modelData['jcr:created'] ? new Date(modelData['jcr:created']) : undefined,
                            lastModified: modelData['jcr:lastModified'] ? new Date(modelData['jcr:lastModified']) : undefined,
                            createdBy: modelData['jcr:createdBy'],
                            lastModifiedBy: modelData['jcr:lastModifiedBy'],
                            nodes: this.parseWorkflowNodes(modelData.nodes),
                            transitions: this.parseWorkflowTransitions(modelData.transitions)
                        });
                    }
                }
            }
            this.logger.debug('Successfully listed workflow models', {
                modelCount: models.length
            });
            return {
                success: true,
                data: models,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to list workflow models', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while listing workflow models', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * Get workflow model details
     */
    async getWorkflowModel(modelPath) {
        try {
            this.logger.debug('Getting workflow model', { modelPath });
            if (!modelPath) {
                throw new AEMException('Model path is required', 'VALIDATION_ERROR', false);
            }
            const requestOptions = {
                context: {
                    operation: 'getWorkflowModel',
                    resource: modelPath
                }
            };
            const response = await this.client.get(`${modelPath}.json`, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to get workflow model: ${modelPath}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const modelData = response.data;
            const model = {
                path: modelPath,
                title: modelData.title || modelData['jcr:title'],
                description: modelData.description || modelData['jcr:description'],
                version: modelData.version,
                enabled: modelData.enabled !== false,
                created: modelData['jcr:created'] ? new Date(modelData['jcr:created']) : undefined,
                lastModified: modelData['jcr:lastModified'] ? new Date(modelData['jcr:lastModified']) : undefined,
                createdBy: modelData['jcr:createdBy'],
                lastModifiedBy: modelData['jcr:lastModifiedBy'],
                nodes: this.parseWorkflowNodes(modelData.nodes),
                transitions: this.parseWorkflowTransitions(modelData.transitions)
            };
            this.logger.debug('Successfully retrieved workflow model', { modelPath });
            return {
                success: true,
                data: model,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get workflow model', error, { modelPath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting workflow model: ${modelPath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, modelPath });
        }
    }
    // ============================================================================
    // WORKFLOW INSTANCE MANAGEMENT OPERATIONS
    // ============================================================================
    /**
     * Get workflow instances with query options
     */
    async getWorkflowInstances(query = {}) {
        try {
            this.logger.debug('Getting workflow instances', { query });
            const queryParams = {};
            if (query.model)
                queryParams.model = query.model;
            if (query.status)
                queryParams.status = query.status;
            if (query.initiator)
                queryParams.initiator = query.initiator;
            if (query.payload)
                queryParams.payload = query.payload;
            if (query.startDate)
                queryParams.startDate = query.startDate.toISOString();
            if (query.endDate)
                queryParams.endDate = query.endDate.toISOString();
            if (query.limit)
                queryParams.limit = query.limit.toString();
            if (query.offset)
                queryParams.offset = query.offset.toString();
            const requestOptions = {
                context: {
                    operation: 'getWorkflowInstances',
                    resource: '/etc/workflow/instances'
                }
            };
            const response = await this.client.get(`/etc/workflow/instances.json?${new URLSearchParams(queryParams).toString()}`, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to get workflow instances', 'SERVER_ERROR', true, undefined, { response });
            }
            const instances = [];
            const data = response.data;
            if (data.instances && Array.isArray(data.instances)) {
                for (const instanceData of data.instances) {
                    instances.push(this.parseWorkflowInstanceFromData(instanceData));
                }
            }
            const result = {
                instances,
                total: data.total || instances.length,
                offset: data.offset || query.offset || 0,
                limit: data.limit || query.limit || instances.length
            };
            this.logger.debug('Successfully retrieved workflow instances', {
                instanceCount: instances.length,
                total: result.total
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
            this.logger.error('Failed to get workflow instances', error, { query });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while getting workflow instances', 'UNKNOWN_ERROR', false, undefined, { originalError: error, query });
        }
    }
    /**
     * Get specific workflow instance
     */
    async getWorkflowInstance(instanceId) {
        try {
            this.logger.debug('Getting workflow instance', { instanceId });
            if (!instanceId) {
                throw new AEMException('Instance ID is required', 'VALIDATION_ERROR', false);
            }
            const requestOptions = {
                context: {
                    operation: 'getWorkflowInstance',
                    resource: instanceId
                }
            };
            const response = await this.client.get(`/etc/workflow/instances/${instanceId}.json`, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to get workflow instance: ${instanceId}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const instance = this.parseWorkflowInstanceFromData(response.data);
            this.logger.debug('Successfully retrieved workflow instance', { instanceId });
            return {
                success: true,
                data: instance,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get workflow instance', error, { instanceId });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting workflow instance: ${instanceId}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, instanceId });
        }
    }
    /**
     * Abort workflow instance
     */
    async abortWorkflowInstance(instanceId, comment) {
        try {
            this.logger.debug('Aborting workflow instance', { instanceId, comment });
            if (!instanceId) {
                throw new AEMException('Instance ID is required', 'VALIDATION_ERROR', false);
            }
            const formData = new FormData();
            formData.append('action', 'abort');
            if (comment) {
                formData.append('comment', comment);
            }
            const requestOptions = {
                context: {
                    operation: 'abortWorkflowInstance',
                    resource: instanceId
                }
            };
            const response = await this.client.post(`/etc/workflow/instances/${instanceId}`, formData, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to abort workflow instance: ${instanceId}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const instance = this.parseWorkflowInstanceFromData(response.data);
            this.logger.debug('Successfully aborted workflow instance', { instanceId });
            return {
                success: true,
                data: instance,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to abort workflow instance', error, { instanceId });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while aborting workflow instance: ${instanceId}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, instanceId });
        }
    }
    /**
     * Suspend workflow instance
     */
    async suspendWorkflowInstance(instanceId, comment) {
        try {
            this.logger.debug('Suspending workflow instance', { instanceId, comment });
            if (!instanceId) {
                throw new AEMException('Instance ID is required', 'VALIDATION_ERROR', false);
            }
            const formData = new FormData();
            formData.append('action', 'suspend');
            if (comment) {
                formData.append('comment', comment);
            }
            const requestOptions = {
                context: {
                    operation: 'suspendWorkflowInstance',
                    resource: instanceId
                }
            };
            const response = await this.client.post(`/etc/workflow/instances/${instanceId}`, formData, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to suspend workflow instance: ${instanceId}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const instance = this.parseWorkflowInstanceFromData(response.data);
            this.logger.debug('Successfully suspended workflow instance', { instanceId });
            return {
                success: true,
                data: instance,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to suspend workflow instance', error, { instanceId });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while suspending workflow instance: ${instanceId}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, instanceId });
        }
    }
    /**
     * Resume workflow instance
     */
    async resumeWorkflowInstance(instanceId, comment) {
        try {
            this.logger.debug('Resuming workflow instance', { instanceId, comment });
            if (!instanceId) {
                throw new AEMException('Instance ID is required', 'VALIDATION_ERROR', false);
            }
            const formData = new FormData();
            formData.append('action', 'resume');
            if (comment) {
                formData.append('comment', comment);
            }
            const requestOptions = {
                context: {
                    operation: 'resumeWorkflowInstance',
                    resource: instanceId
                }
            };
            const response = await this.client.post(`/etc/workflow/instances/${instanceId}`, formData, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to resume workflow instance: ${instanceId}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const instance = this.parseWorkflowInstanceFromData(response.data);
            this.logger.debug('Successfully resumed workflow instance', { instanceId });
            return {
                success: true,
                data: instance,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to resume workflow instance', error, { instanceId });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while resuming workflow instance: ${instanceId}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, instanceId });
        }
    }
    // ============================================================================
    // ENHANCED TASK MANAGEMENT OPERATIONS
    // ============================================================================
    /**
     * Get workflow tasks with query options
     */
    async getWorkflowTasks(query = {}) {
        try {
            this.logger.debug('Getting workflow tasks', { query });
            const queryParams = {};
            if (query.workflowId)
                queryParams.workflowId = query.workflowId;
            if (query.assignee)
                queryParams.assignee = query.assignee;
            if (query.status)
                queryParams.status = query.status;
            if (query.createdDate)
                queryParams.createdDate = query.createdDate.toISOString();
            if (query.dueDate)
                queryParams.dueDate = query.dueDate.toISOString();
            if (query.limit)
                queryParams.limit = query.limit.toString();
            if (query.offset)
                queryParams.offset = query.offset.toString();
            const requestOptions = {
                context: {
                    operation: 'getWorkflowTasks',
                    resource: '/libs/granite/taskmanager'
                }
            };
            const response = await this.client.get(`/libs/granite/taskmanager/tasks.json?${new URLSearchParams(queryParams).toString()}`, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to get workflow tasks', 'SERVER_ERROR', true, undefined, { response });
            }
            const tasks = [];
            const data = response.data;
            if (data.tasks && Array.isArray(data.tasks)) {
                for (const taskData of data.tasks) {
                    tasks.push(this.parseWorkflowTaskFromData(taskData));
                }
            }
            const result = {
                tasks,
                total: data.total || tasks.length,
                offset: data.offset || query.offset || 0,
                limit: data.limit || query.limit || tasks.length
            };
            this.logger.debug('Successfully retrieved workflow tasks', {
                taskCount: tasks.length,
                total: result.total
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
            this.logger.error('Failed to get workflow tasks', error, { query });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while getting workflow tasks', 'UNKNOWN_ERROR', false, undefined, { originalError: error, query });
        }
    }
    /**
     * Get specific workflow task
     */
    async getWorkflowTask(taskId) {
        try {
            this.logger.debug('Getting workflow task', { taskId });
            if (!taskId) {
                throw new AEMException('Task ID is required', 'VALIDATION_ERROR', false);
            }
            const requestOptions = {
                context: {
                    operation: 'getWorkflowTask',
                    resource: taskId
                }
            };
            const response = await this.client.get(`/libs/granite/taskmanager/tasks/${taskId}.json`, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to get workflow task: ${taskId}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const task = this.parseWorkflowTaskFromData(response.data);
            this.logger.debug('Successfully retrieved workflow task', { taskId });
            return {
                success: true,
                data: task,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get workflow task', error, { taskId });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting workflow task: ${taskId}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, taskId });
        }
    }
    // ============================================================================
    // PRIVATE HELPER METHODS
    // ============================================================================
    /**
     * Parse workflow nodes from data
     */
    parseWorkflowNodes(nodesData) {
        const nodes = [];
        if (nodesData && typeof nodesData === 'object') {
            for (const [id, nodeData] of Object.entries(nodesData)) {
                if (typeof nodeData === 'object' && nodeData !== null) {
                    const node = nodeData;
                    nodes.push({
                        id,
                        title: node.title,
                        type: node.type || 'PROCESS',
                        description: node.description,
                        assignee: node.assignee,
                        formResourcePath: node.formResourcePath,
                        script: node.script,
                        properties: node.properties || {}
                    });
                }
            }
        }
        return nodes;
    }
    /**
     * Parse workflow transitions from data
     */
    parseWorkflowTransitions(transitionsData) {
        const transitions = [];
        if (transitionsData && Array.isArray(transitionsData)) {
            for (const transitionData of transitionsData) {
                transitions.push({
                    from: transitionData.from || '',
                    to: transitionData.to || '',
                    title: transitionData.title,
                    condition: transitionData.condition,
                    script: transitionData.script
                });
            }
        }
        return transitions;
    }
    /**
     * Parse workflow instance from raw data
     */
    parseWorkflowInstanceFromData(data) {
        return {
            id: data.id || data.workflowId || '',
            title: data.title || data.workflowTitle,
            model: data.model || data.modelPath || '',
            payload: data.payload || data.payloadPath || '',
            payloadType: data.payloadType || 'JCR_PATH',
            initiator: data.initiator || data.userId,
            status: this.mapWorkflowStatus(data.status),
            startTime: data.startTime ? new Date(data.startTime) : undefined,
            endTime: data.endTime ? new Date(data.endTime) : undefined,
            comment: data.comment || data.startComment,
            workflowData: data.workflowData || {}
        };
    }
    /**
     * Parse workflow task from raw data
     */
    parseWorkflowTaskFromData(data) {
        return {
            id: data.id || data.taskId || '',
            workflowId: data.workflowId || '',
            title: data.title || data.taskTitle,
            description: data.description,
            assignee: data.assignee,
            status: this.mapTaskStatus(data.status),
            created: data.created ? new Date(data.created) : undefined,
            completed: data.completed ? new Date(data.completed) : undefined,
            dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
            priority: parseInt(data.priority) || 0,
            formResourcePath: data.formResourcePath,
            taskData: data.taskData || {}
        };
    }
    /**
     * Wait for asset processing completion
     */
    async waitForAssetProcessingCompletion(jobId, maxAttempts = 30, delayMs = 2000) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await this.client.get(`/bin/asynccommand?optype=GETSTATUS&jobid=${jobId}`);
                if (response.success && response.data) {
                    const status = this.mapProcessStatus(response.data.status);
                    if (status === 'COMPLETED' || status === 'FAILED') {
                        return; // Processing complete
                    }
                }
            }
            catch (error) {
                this.logger.warn('Error checking asset processing status', { jobId, error: error.message });
            }
            // Wait before next check
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        this.logger.warn(`Asset processing timed out after ${maxAttempts} attempts`, { jobId });
    }
}
//# sourceMappingURL=workflow-operations-service.js.map