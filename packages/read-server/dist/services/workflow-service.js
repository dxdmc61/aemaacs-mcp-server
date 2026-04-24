/**
 * Workflow Service
 * Handles workflow-related read operations in AEM
 */
import { Logger } from '@aemaacs-mcp/shared';
export class WorkflowService {
    constructor(client) {
        this.client = client;
        this.logger = Logger.getInstance();
    }
    /**
     * List workflow instances
     */
    async listWorkflowInstances(options = {}) {
        this.logger.info('Listing workflow instances', { options });
        try {
            const params = {};
            if (options.modelPath)
                params.modelPath = options.modelPath;
            if (options.payloadPath)
                params.payloadPath = options.payloadPath;
            if (options.status)
                params.status = options.status;
            if (options.limit)
                params.limit = options.limit;
            if (options.offset)
                params.offset = options.offset;
            const response = await this.client.get('/etc/workflow/instances', params);
            if (!response.success) {
                return response;
            }
            const instances = (response.data?.instances || []).map((instance) => ({
                id: instance.id,
                modelPath: instance.modelPath,
                payloadPath: instance.payloadPath,
                state: instance.state,
                startTime: new Date(instance.startTime),
                endTime: instance.endTime ? new Date(instance.endTime) : undefined,
                initiator: instance.initiator
            }));
            return {
                success: true,
                data: instances,
                metadata: response.metadata
            };
        }
        catch (error) {
            this.logger.error('Failed to list workflow instances', error);
            return {
                success: false,
                error: {
                    code: 'WORKFLOW_LIST_ERROR',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    recoverable: true
                }
            };
        }
    }
    /**
     * Get workflow instance details
     */
    async getWorkflowInstance(instanceId, options = {}) {
        this.logger.info('Getting workflow instance', { instanceId, options });
        try {
            const response = await this.client.get(`/etc/workflow/instances/${instanceId}`);
            if (!response.success) {
                return response;
            }
            const instance = {
                id: response.data.id,
                modelPath: response.data.modelPath,
                payloadPath: response.data.payloadPath,
                state: response.data.state,
                startTime: new Date(response.data.startTime),
                endTime: response.data.endTime ? new Date(response.data.endTime) : undefined,
                initiator: response.data.initiator
            };
            return {
                success: true,
                data: instance,
                metadata: response.metadata
            };
        }
        catch (error) {
            this.logger.error('Failed to get workflow instance', error);
            return {
                success: false,
                error: {
                    code: 'WORKFLOW_GET_ERROR',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    recoverable: true
                }
            };
        }
    }
    /**
     * List available workflow models
     */
    async listWorkflowModels() {
        this.logger.info('Listing workflow models');
        try {
            const response = await this.client.get('/etc/workflow/models');
            if (!response.success) {
                return response;
            }
            const models = (response.data?.models || []).map((model) => ({
                path: model.path,
                title: model.title,
                description: model.description,
                version: model.version
            }));
            return {
                success: true,
                data: models,
                metadata: response.metadata
            };
        }
        catch (error) {
            this.logger.error('Failed to list workflow models', error);
            return {
                success: false,
                error: {
                    code: 'WORKFLOW_MODELS_ERROR',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    recoverable: true
                }
            };
        }
    }
}
//# sourceMappingURL=workflow-service.js.map