/**
 * Workflow Service
 * Handles workflow-related read operations in AEM
 */

import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { Logger } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';

export interface WorkflowInstance {
  id: string;
  modelPath: string;
  payloadPath: string;
  state: 'RUNNING' | 'COMPLETED' | 'ABORTED' | 'SUSPENDED';
  startTime: Date;
  endTime?: Date;
  initiator: string;
}

export interface WorkflowModel {
  path: string;
  title: string;
  description?: string;
  version: string;
}

export interface ListWorkflowsOptions {
  modelPath?: string;
  payloadPath?: string;
  status?: 'RUNNING' | 'COMPLETED' | 'ABORTED' | 'SUSPENDED';
  limit?: number;
  offset?: number;
}

export interface GetWorkflowOptions {
  includeHistory?: boolean;
}

export class WorkflowService {
  private client: AEMHttpClient;
  private logger: Logger;

  constructor(client: AEMHttpClient) {
    this.client = client;
    this.logger = Logger.getInstance();
  }

  /**
   * List workflow instances
   */
  async listWorkflowInstances(options: ListWorkflowsOptions = {}): Promise<AEMResponse<WorkflowInstance[]>> {
    this.logger.info('Listing workflow instances', { options });
    
    try {
      const params: Record<string, any> = {};
      if (options.modelPath) params.modelPath = options.modelPath;
      if (options.payloadPath) params.payloadPath = options.payloadPath;
      if (options.status) params.status = options.status;
      if (options.limit) params.limit = options.limit;
      if (options.offset) params.offset = options.offset;

      const response = await this.client.get<any>('/etc/workflow/instances', params);
      
      if (!response.success) {
        return response as AEMResponse<WorkflowInstance[]>;
      }

      const instances: WorkflowInstance[] = (response.data?.instances || []).map((instance: any) => ({
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
    } catch (error) {
      this.logger.error('Failed to list workflow instances', error as Error);
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
  async getWorkflowInstance(instanceId: string, options: GetWorkflowOptions = {}): Promise<AEMResponse<WorkflowInstance>> {
    this.logger.info('Getting workflow instance', { instanceId, options });
    
    try {
      const response = await this.client.get<any>(`/etc/workflow/instances/${instanceId}`);
      
      if (!response.success) {
        return response as AEMResponse<WorkflowInstance>;
      }

      const instance: WorkflowInstance = {
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
    } catch (error) {
      this.logger.error('Failed to get workflow instance', error as Error);
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
  async listWorkflowModels(): Promise<AEMResponse<WorkflowModel[]>> {
    this.logger.info('Listing workflow models');
    
    try {
      const response = await this.client.get<any>('/etc/workflow/models');
      
      if (!response.success) {
        return response as AEMResponse<WorkflowModel[]>;
      }

      const models: WorkflowModel[] = (response.data?.models || []).map((model: any) => ({
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
    } catch (error) {
      this.logger.error('Failed to list workflow models', error as Error);
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

