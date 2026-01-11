/**
 * MCP Protocol Handler for Write Server
 * Handles MCP tool discovery, schema generation, and tool execution for write operations
 */

import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';
import { AEMHttpClient } from '@aemaacs-mcp/shared';

// Import all write services
import { PackageService } from '../services/package-service.js';
import { PageOperationsService } from '../services/page-operations-service.js';
import { ComponentOperationsService } from '../services/component-operations-service.js';
import { ContentOperationsService } from '../services/content-operations-service.js';
import { ReplicationOperationsService } from '../services/replication-operations-service.js';
import { UserAdministrationService } from '../services/user-administration-service.js';
import { AssetManagementService } from '../services/asset-management-service.js';
import { TagOperationsService } from '../services/tag-operations-service.js';
import { ContentFragmentOperationsService } from '../services/content-fragment-operations-service.js';
import { WorkflowOperationsService } from '../services/workflow-operations-service.js';
import { InboxOperationsService } from '../services/inbox-operations-service.js';
import { SystemOperationsService } from '../services/system-operations-service.js';
import { VersionManagementService } from '../services/version-management-service.js';
import { PermissionManagementService } from '../services/permission-management-service.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPRequest {
  method: string;
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}

export interface MCPResponse {
  content?: Array<{
    type: 'text' | 'resource';
    text?: string;
    resource?: {
      uri: string;
      mimeType?: string;
    };
  }>;
  isError?: boolean;
}

export class MCPHandler {
  private logger: Logger;
  private client: AEMHttpClient;
  private services: {
    package: PackageService;
    pageOperations: PageOperationsService;
    componentOperations: ComponentOperationsService;
    contentOperations: ContentOperationsService;
    replicationOperations: ReplicationOperationsService;
    userAdministration: UserAdministrationService;
    assetManagement: AssetManagementService;
    tagOperations: TagOperationsService;
    contentFragmentOperations: ContentFragmentOperationsService;
    workflowOperations: WorkflowOperationsService;
    inboxOperations: InboxOperationsService;
    systemOperations: SystemOperationsService;
    versionManagement: VersionManagementService;
    permissionManagement: PermissionManagementService;
  };

  constructor(client: AEMHttpClient) {
    this.logger = Logger.getInstance();
    this.client = client;
    
    // Initialize all services
    this.services = {
      package: new PackageService(client),
      pageOperations: new PageOperationsService(client),
      componentOperations: new ComponentOperationsService(client),
      contentOperations: new ContentOperationsService(client),
      replicationOperations: new ReplicationOperationsService(client),
      userAdministration: new UserAdministrationService(client),
      assetManagement: new AssetManagementService(client),
      tagOperations: new TagOperationsService(client),
      contentFragmentOperations: new ContentFragmentOperationsService(client),
      workflowOperations: new WorkflowOperationsService(client),
      inboxOperations: new InboxOperationsService(client),
      systemOperations: new SystemOperationsService(client),
      versionManagement: new VersionManagementService(client),
      permissionManagement: new PermissionManagementService(client)
    };
  }

  /**
   * Get list of available MCP tools for write operations
   */
  public getTools(): MCPTool[] {
    return [
      // Package Management Tools
      {
        name: 'aem_create_package',
        description: 'Create a new package in AEM',
        inputSchema: {
          type: 'object',
          properties: {
            groupName: { type: 'string', description: 'Package group name' },
            packageName: { type: 'string', description: 'Package name' },
            version: { type: 'string', description: 'Package version', default: '1.0.0' },
            description: { type: 'string', description: 'Package description' }
          },
          required: ['groupName', 'packageName']
        }
      },
      {
        name: 'aem_install_package',
        description: 'Install a package in AEM',
        inputSchema: {
          type: 'object',
          properties: {
            packagePath: { type: 'string', description: 'Path to the package' },
            recursive: { type: 'boolean', description: 'Install recursively', default: false }
          },
          required: ['packagePath']
        }
      },
      {
        name: 'aem_delete_package',
        description: 'Delete a package from AEM',
        inputSchema: {
          type: 'object',
          properties: {
            packagePath: { type: 'string', description: 'Path to the package' },
            force: { type: 'boolean', description: 'Force deletion', default: false }
          },
          required: ['packagePath']
        }
      },

      // Page Operations Tools
      {
        name: 'aem_create_page',
        description: 'Create a new page in AEM',
        inputSchema: {
          type: 'object',
          properties: {
            parentPath: { type: 'string', description: 'Parent page path' },
            pageName: { type: 'string', description: 'Page name' },
            title: { type: 'string', description: 'Page title' },
            template: { type: 'string', description: 'Page template path' },
            properties: { type: 'object', description: 'Additional page properties' }
          },
          required: ['parentPath', 'pageName', 'title', 'template']
        }
      },
      {
        name: 'aem_copy_page',
        description: 'Copy a page in AEM',
        inputSchema: {
          type: 'object',
          properties: {
            sourcePath: { type: 'string', description: 'Source page path' },
            destinationPath: { type: 'string', description: 'Destination path' },
            shallow: { type: 'boolean', description: 'Shallow copy', default: false }
          },
          required: ['sourcePath', 'destinationPath']
        }
      },
      {
        name: 'aem_move_page',
        description: 'Move a page in AEM',
        inputSchema: {
          type: 'object',
          properties: {
            sourcePath: { type: 'string', description: 'Source page path' },
            destinationPath: { type: 'string', description: 'Destination path' }
          },
          required: ['sourcePath', 'destinationPath']
        }
      },
      {
        name: 'aem_delete_page',
        description: 'Delete a page in AEM',
        inputSchema: {
          type: 'object',
          properties: {
            pagePath: { type: 'string', description: 'Page path to delete' },
            force: { type: 'boolean', description: 'Force deletion', default: false }
          },
          required: ['pagePath']
        }
      },

      // Content Operations Tools
      {
        name: 'aem_create_folder',
        description: 'Create a folder in AEM',
        inputSchema: {
          type: 'object',
          properties: {
            parentPath: { type: 'string', description: 'Parent path' },
            folderName: { type: 'string', description: 'Folder name' },
            title: { type: 'string', description: 'Folder title' },
            ordered: { type: 'boolean', description: 'Create as ordered folder', default: false }
          },
          required: ['parentPath', 'folderName']
        }
      },
      {
        name: 'aem_upload_file',
        description: 'Upload a file to AEM',
        inputSchema: {
          type: 'object',
          properties: {
            parentPath: { type: 'string', description: 'Parent path' },
            fileName: { type: 'string', description: 'File name' },
            fileContent: { type: 'string', description: 'Base64 encoded file content' },
            mimeType: { type: 'string', description: 'MIME type' }
          },
          required: ['parentPath', 'fileName', 'fileContent']
        }
      },

      // Asset Management Tools
      {
        name: 'aem_upload_asset',
        description: 'Upload an asset to DAM',
        inputSchema: {
          type: 'object',
          properties: {
            parentPath: { type: 'string', description: 'DAM parent path' },
            fileName: { type: 'string', description: 'Asset file name' },
            fileContent: { type: 'string', description: 'Base64 encoded file content' },
            metadata: { type: 'object', description: 'Asset metadata' }
          },
          required: ['parentPath', 'fileName', 'fileContent']
        }
      },
      {
        name: 'aem_update_asset',
        description: 'Update asset metadata',
        inputSchema: {
          type: 'object',
          properties: {
            assetPath: { type: 'string', description: 'Asset path' },
            metadata: { type: 'object', description: 'Updated metadata' }
          },
          required: ['assetPath', 'metadata']
        }
      },
      {
        name: 'aem_delete_asset',
        description: 'Delete an asset from DAM',
        inputSchema: {
          type: 'object',
          properties: {
            assetPath: { type: 'string', description: 'Asset path to delete' }
          },
          required: ['assetPath']
        }
      },
      {
        name: 'aem_get_asset_processing_status',
        description: 'Get asset processing status',
        inputSchema: {
          type: 'object',
          properties: {
            assetPath: { type: 'string', description: 'Asset path to check processing status' }
          },
          required: ['assetPath']
        }
      },
      {
        name: 'aem_create_custom_rendition',
        description: 'Create a custom rendition for an asset',
        inputSchema: {
          type: 'object',
          properties: {
            assetPath: { type: 'string', description: 'Asset path' },
            name: { type: 'string', description: 'Rendition name' },
            width: { type: 'number', description: 'Rendition width' },
            height: { type: 'number', description: 'Rendition height' },
            quality: { type: 'number', description: 'Rendition quality (1-100)' },
            format: { type: 'string', description: 'Rendition format' }
          },
          required: ['assetPath', 'name']
        }
      },
      {
        name: 'aem_apply_smart_crop',
        description: 'Apply smart crop to an asset',
        inputSchema: {
          type: 'object',
          properties: {
            assetPath: { type: 'string', description: 'Asset path' },
            width: { type: 'number', description: 'Target width' },
            height: { type: 'number', description: 'Target height' },
            algorithm: { type: 'string', enum: ['face-detection', 'saliency', 'center-weighted'], description: 'Smart crop algorithm' },
            renditionName: { type: 'string', description: 'Custom rendition name' },
            quality: { type: 'number', description: 'Output quality (1-100)' }
          },
          required: ['assetPath', 'width', 'height']
        }
      },
      {
        name: 'aem_process_video_asset',
        description: 'Process video asset with thumbnails and metadata extraction',
        inputSchema: {
          type: 'object',
          properties: {
            assetPath: { type: 'string', description: 'Video asset path' },
            generateThumbnails: { type: 'boolean', description: 'Generate thumbnails', default: true },
            thumbnailCount: { type: 'number', description: 'Number of thumbnails to generate' },
            generatePreview: { type: 'boolean', description: 'Generate video preview', default: false },
            previewQuality: { type: 'number', description: 'Preview quality (1-100)' },
            extractMetadata: { type: 'boolean', description: 'Extract video metadata', default: true }
          },
          required: ['assetPath']
        }
      },

      // User Administration Tools
      {
        name: 'aem_create_user',
        description: 'Create a new user in AEM',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'User ID' },
            password: { type: 'string', description: 'User password' },
            profile: { type: 'object', description: 'User profile information' }
          },
          required: ['userId']
        }
      },
      {
        name: 'aem_create_group',
        description: 'Create a new group in AEM',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: { type: 'string', description: 'Group ID' },
            description: { type: 'string', description: 'Group description' }
          },
          required: ['groupId']
        }
      },
      {
        name: 'aem_add_user_to_group',
        description: 'Add a user to a group',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'User ID' },
            groupId: { type: 'string', description: 'Group ID' }
          },
          required: ['userId', 'groupId']
        }
      },

      // Tag Operations Tools
      {
        name: 'aem_create_tag_namespace',
        description: 'Create a new tag namespace',
        inputSchema: {
          type: 'object',
          properties: {
            namespace: { type: 'string', description: 'Namespace name' },
            title: { type: 'string', description: 'Namespace title' },
            description: { type: 'string', description: 'Namespace description' }
          },
          required: ['namespace']
        }
      },
      {
        name: 'aem_create_tag',
        description: 'Create a new tag',
        inputSchema: {
          type: 'object',
          properties: {
            tagId: { type: 'string', description: 'Tag ID (namespace:tagname)' },
            title: { type: 'string', description: 'Tag title' },
            description: { type: 'string', description: 'Tag description' }
          },
          required: ['tagId']
        }
      },

      // Replication Tools
      {
        name: 'aem_publish_content',
        description: 'Publish content to publish tier',
        inputSchema: {
          type: 'object',
          properties: {
            contentPath: { type: 'string', description: 'Content path to publish' },
            deep: { type: 'boolean', description: 'Deep publish', default: false }
          },
          required: ['contentPath']
        }
      },
      {
        name: 'aem_unpublish_content',
        description: 'Unpublish content from publish tier',
        inputSchema: {
          type: 'object',
          properties: {
            contentPath: { type: 'string', description: 'Content path to unpublish' },
            deep: { type: 'boolean', description: 'Deep unpublish', default: false }
          },
          required: ['contentPath']
        }
      },
      {
        name: 'aem_get_replication_queue_status',
        description: 'Get replication queue status for all agents',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'aem_get_agent_queue_status',
        description: 'Get specific agent queue status',
        inputSchema: {
          type: 'object',
          properties: {
            agentName: { type: 'string', description: 'Agent name' }
          },
          required: ['agentName']
        }
      },
      {
        name: 'aem_list_replication_agents',
        description: 'List all replication agents',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'aem_get_replication_agent',
        description: 'Get specific replication agent details',
        inputSchema: {
          type: 'object',
          properties: {
            agentName: { type: 'string', description: 'Agent name' }
          },
          required: ['agentName']
        }
      },
      {
        name: 'aem_update_replication_agent',
        description: 'Update replication agent configuration',
        inputSchema: {
          type: 'object',
          properties: {
            agentName: { type: 'string', description: 'Agent name' },
            updates: { type: 'object', description: 'Agent configuration updates' }
          },
          required: ['agentName', 'updates']
        }
      },
      {
        name: 'aem_schedule_publish',
        description: 'Schedule content for future publishing',
        inputSchema: {
          type: 'object',
          properties: {
            contentPath: { type: 'string', description: 'Content path to schedule' },
            scheduleDate: { type: 'string', description: 'ISO date string for scheduled publish' },
            timezone: { type: 'string', description: 'Timezone for scheduled publish' },
            deep: { type: 'boolean', description: 'Deep publish', default: false },
            onlyModified: { type: 'boolean', description: 'Only publish modified content', default: false },
            onlyActivated: { type: 'boolean', description: 'Only publish activated content', default: false },
            ignoreDeactivated: { type: 'boolean', description: 'Ignore deactivated content', default: false },
            force: { type: 'boolean', description: 'Force publish', default: false },
            workflowModel: { type: 'string', description: 'Workflow model to use' },
            comment: { type: 'string', description: 'Publish comment' },
            initiator: { type: 'string', description: 'Publish initiator' }
          },
          required: ['contentPath', 'scheduleDate']
        }
      },
      {
        name: 'aem_get_scheduled_publish_jobs',
        description: 'Get scheduled publish jobs',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'aem_cancel_scheduled_publish',
        description: 'Cancel scheduled publish job',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: { type: 'string', description: 'Job ID to cancel' }
          },
          required: ['jobId']
        }
      },

      // Workflow Tools
      {
        name: 'aem_start_workflow',
        description: 'Start a workflow instance',
        inputSchema: {
          type: 'object',
          properties: {
            workflowModel: { type: 'string', description: 'Workflow model path' },
            payload: { type: 'string', description: 'Workflow payload path' },
            title: { type: 'string', description: 'Workflow title' }
          },
          required: ['workflowModel', 'payload']
        }
      },
      {
        name: 'aem_list_workflow_models',
        description: 'List all available workflow models',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'aem_get_workflow_model',
        description: 'Get workflow model details',
        inputSchema: {
          type: 'object',
          properties: {
            modelPath: { type: 'string', description: 'Workflow model path' }
          },
          required: ['modelPath']
        }
      },
      {
        name: 'aem_get_workflow_instances',
        description: 'Get workflow instances with query options',
        inputSchema: {
          type: 'object',
          properties: {
            model: { type: 'string', description: 'Filter by workflow model' },
            status: { type: 'string', enum: ['RUNNING', 'COMPLETED', 'ABORTED', 'SUSPENDED'], description: 'Filter by status' },
            initiator: { type: 'string', description: 'Filter by initiator' },
            payload: { type: 'string', description: 'Filter by payload path' },
            startDate: { type: 'string', description: 'Filter by start date (ISO string)' },
            endDate: { type: 'string', description: 'Filter by end date (ISO string)' },
            limit: { type: 'number', description: 'Limit number of results' },
            offset: { type: 'number', description: 'Offset for pagination' }
          }
        }
      },
      {
        name: 'aem_get_workflow_instance',
        description: 'Get specific workflow instance',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'Workflow instance ID' }
          },
          required: ['instanceId']
        }
      },
      {
        name: 'aem_abort_workflow_instance',
        description: 'Abort a workflow instance',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'Workflow instance ID' },
            comment: { type: 'string', description: 'Abort comment' }
          },
          required: ['instanceId']
        }
      },
      {
        name: 'aem_suspend_workflow_instance',
        description: 'Suspend a workflow instance',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'Workflow instance ID' },
            comment: { type: 'string', description: 'Suspend comment' }
          },
          required: ['instanceId']
        }
      },
      {
        name: 'aem_resume_workflow_instance',
        description: 'Resume a suspended workflow instance',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'Workflow instance ID' },
            comment: { type: 'string', description: 'Resume comment' }
          },
          required: ['instanceId']
        }
      },
      {
        name: 'aem_get_workflow_tasks',
        description: 'Get workflow tasks with query options',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: 'Filter by workflow ID' },
            assignee: { type: 'string', description: 'Filter by assignee' },
            status: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'TERMINATED'], description: 'Filter by task status' },
            createdDate: { type: 'string', description: 'Filter by creation date (ISO string)' },
            dueDate: { type: 'string', description: 'Filter by due date (ISO string)' },
            limit: { type: 'number', description: 'Limit number of results' },
            offset: { type: 'number', description: 'Offset for pagination' }
          }
        }
      },
      {
        name: 'aem_get_workflow_task',
        description: 'Get specific workflow task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Workflow task ID' }
          },
          required: ['taskId']
        }
      },
      {
        name: 'aem_complete_workflow_task',
        description: 'Complete a workflow task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID' },
            action: { type: 'string', description: 'Action to take' },
            comment: { type: 'string', description: 'Task completion comment' },
            workflowData: { type: 'object', description: 'Additional workflow data' }
          },
          required: ['taskId', 'action']
        }
      },
      {
        name: 'aem_start_publish_workflow',
        description: 'Start a publish workflow for content',
        inputSchema: {
          type: 'object',
          properties: {
            contentPath: { type: 'string', description: 'Content path to publish' },
            workflowTitle: { type: 'string', description: 'Workflow title' },
            startComment: { type: 'string', description: 'Start comment' },
            replicateAsTree: { type: 'boolean', description: 'Replicate as tree' },
            activateTree: { type: 'boolean', description: 'Activate tree' },
            ignoreDeactivated: { type: 'boolean', description: 'Ignore deactivated content' }
          },
          required: ['contentPath']
        }
      },
      {
        name: 'aem_process_assets',
        description: 'Process assets in a folder',
        inputSchema: {
          type: 'object',
          properties: {
            folderPath: { type: 'string', description: 'DAM folder path' },
            profile: { type: 'string', description: 'Processing profile' },
            async: { type: 'boolean', description: 'Process asynchronously' },
            wait: { type: 'boolean', description: 'Wait for completion' },
            batchSize: { type: 'number', description: 'Batch size for processing' }
          },
          required: ['folderPath']
        }
      },

      // Content Fragment Tools
      {
        name: 'aem_create_content_fragment',
        description: 'Create a new content fragment',
        inputSchema: {
          type: 'object',
          properties: {
            parentPath: { type: 'string', description: 'Parent path in DAM' },
            fragmentName: { type: 'string', description: 'Fragment name' },
            model: { type: 'string', description: 'Content fragment model path' },
            title: { type: 'string', description: 'Fragment title' },
            description: { type: 'string', description: 'Fragment description' },
            elements: { type: 'object', description: 'Fragment elements' },
            tags: { type: 'array', description: 'Fragment tags' },
            properties: { type: 'object', description: 'Additional properties' }
          },
          required: ['parentPath', 'fragmentName', 'model', 'title']
        }
      },
      {
        name: 'aem_update_content_fragment',
        description: 'Update a content fragment',
        inputSchema: {
          type: 'object',
          properties: {
            fragmentPath: { type: 'string', description: 'Fragment path' },
            elements: { type: 'object', description: 'Updated elements' },
            title: { type: 'string', description: 'Updated title' },
            description: { type: 'string', description: 'Updated description' },
            tags: { type: 'array', description: 'Updated tags' },
            properties: { type: 'object', description: 'Additional properties' },
            merge: { type: 'boolean', description: 'Merge with existing data' }
          },
          required: ['fragmentPath']
        }
      },
      {
        name: 'aem_delete_content_fragment',
        description: 'Delete a content fragment',
        inputSchema: {
          type: 'object',
          properties: {
            fragmentPath: { type: 'string', description: 'Fragment path to delete' },
            force: { type: 'boolean', description: 'Force deletion', default: false },
            checkReferences: { type: 'boolean', description: 'Check for references', default: true }
          },
          required: ['fragmentPath']
        }
      },
      {
        name: 'aem_create_content_fragment_model',
        description: 'Create a content fragment model',
        inputSchema: {
          type: 'object',
          properties: {
            parentPath: { type: 'string', description: 'Parent path in conf' },
            modelName: { type: 'string', description: 'Model name' },
            title: { type: 'string', description: 'Model title' },
            description: { type: 'string', description: 'Model description' },
            elements: { type: 'array', description: 'Model elements definition' },
            properties: { type: 'object', description: 'Additional properties' }
          },
          required: ['parentPath', 'modelName', 'title', 'elements']
        }
      },
      {
        name: 'aem_get_content_fragment_model',
        description: 'Get content fragment model information',
        inputSchema: {
          type: 'object',
          properties: {
            modelPath: { type: 'string', description: 'Model path' }
          },
          required: ['modelPath']
        }
      },
      {
        name: 'aem_list_content_fragment_models',
        description: 'List all content fragment models',
        inputSchema: {
          type: 'object',
          properties: {
            confPath: { type: 'string', description: 'Configuration path', default: '/conf' }
          }
        }
      },
      {
        name: 'aem_create_content_fragment_variation',
        description: 'Create a content fragment variation',
        inputSchema: {
          type: 'object',
          properties: {
            fragmentPath: { type: 'string', description: 'Fragment path' },
            variationName: { type: 'string', description: 'Variation name' },
            title: { type: 'string', description: 'Variation title' },
            description: { type: 'string', description: 'Variation description' },
            elements: { type: 'object', description: 'Variation elements' },
            isMaster: { type: 'boolean', description: 'Is master variation', default: false }
          },
          required: ['fragmentPath', 'variationName']
        }
      },
      {
        name: 'aem_update_content_fragment_variation',
        description: 'Update a content fragment variation',
        inputSchema: {
          type: 'object',
          properties: {
            fragmentPath: { type: 'string', description: 'Fragment path' },
            variationName: { type: 'string', description: 'Variation name' },
            title: { type: 'string', description: 'Updated title' },
            description: { type: 'string', description: 'Updated description' },
            elements: { type: 'object', description: 'Updated elements' },
            isMaster: { type: 'boolean', description: 'Is master variation' }
          },
          required: ['fragmentPath', 'variationName']
        }
      },
      {
        name: 'aem_delete_content_fragment_variation',
        description: 'Delete a content fragment variation',
        inputSchema: {
          type: 'object',
          properties: {
            fragmentPath: { type: 'string', description: 'Fragment path' },
            variationName: { type: 'string', description: 'Variation name' }
          },
          required: ['fragmentPath', 'variationName']
        }
      },
      {
        name: 'aem_list_content_fragment_variations',
        description: 'List all variations for a content fragment',
        inputSchema: {
          type: 'object',
          properties: {
            fragmentPath: { type: 'string', description: 'Fragment path' }
          },
          required: ['fragmentPath']
        }
      },
      {
        name: 'aem_get_content_fragment_references',
        description: 'Get references for a content fragment',
        inputSchema: {
          type: 'object',
          properties: {
            fragmentPath: { type: 'string', description: 'Fragment path' }
          },
          required: ['fragmentPath']
        }
      },

      // Version Management Tools
      {
        name: 'aem_create_version',
        description: 'Create a new version of a resource',
        inputSchema: {
          type: 'object',
          properties: {
            resourcePath: { type: 'string', description: 'Resource path' },
            comment: { type: 'string', description: 'Version comment' },
            label: { type: 'string', description: 'Version label' },
            autoSave: { type: 'boolean', description: 'Auto-save version' }
          },
          required: ['resourcePath']
        }
      },
      {
        name: 'aem_create_autosave_version',
        description: 'Create an auto-save version of a resource',
        inputSchema: {
          type: 'object',
          properties: {
            resourcePath: { type: 'string', description: 'Resource path' },
            comment: { type: 'string', description: 'Auto-save comment' }
          },
          required: ['resourcePath']
        }
      },
      {
        name: 'aem_compare_versions',
        description: 'Compare two versions of a resource',
        inputSchema: {
          type: 'object',
          properties: {
            resourcePath: { type: 'string', description: 'Resource path' },
            version1: { type: 'string', description: 'First version name' },
            version2: { type: 'string', description: 'Second version name' }
          },
          required: ['resourcePath', 'version1', 'version2']
        }
      },
      {
        name: 'aem_compare_with_current_version',
        description: 'Compare a version with the current version',
        inputSchema: {
          type: 'object',
          properties: {
            resourcePath: { type: 'string', description: 'Resource path' },
            versionName: { type: 'string', description: 'Version name to compare' }
          },
          required: ['resourcePath', 'versionName']
        }
      },
      {
        name: 'aem_restore_version',
        description: 'Restore a specific version of a resource',
        inputSchema: {
          type: 'object',
          properties: {
            resourcePath: { type: 'string', description: 'Resource path' },
            versionName: { type: 'string', description: 'Version name to restore' },
            comment: { type: 'string', description: 'Restore comment' },
            force: { type: 'boolean', description: 'Force restoration' },
            createBackup: { type: 'boolean', description: 'Create backup before restore' }
          },
          required: ['resourcePath', 'versionName']
        }
      },
      {
        name: 'aem_add_version_labels',
        description: 'Add labels to a version',
        inputSchema: {
          type: 'object',
          properties: {
            resourcePath: { type: 'string', description: 'Resource path' },
            versionName: { type: 'string', description: 'Version name' },
            labels: { type: 'array', description: 'Labels to add' },
            comment: { type: 'string', description: 'Label comment' }
          },
          required: ['resourcePath', 'versionName', 'labels']
        }
      },
      {
        name: 'aem_remove_version_labels',
        description: 'Remove labels from a version',
        inputSchema: {
          type: 'object',
          properties: {
            resourcePath: { type: 'string', description: 'Resource path' },
            versionName: { type: 'string', description: 'Version name' },
            labels: { type: 'array', description: 'Labels to remove' },
            comment: { type: 'string', description: 'Label comment' }
          },
          required: ['resourcePath', 'versionName', 'labels']
        }
      },
      {
        name: 'aem_get_version_history',
        description: 'Get version history for a resource',
        inputSchema: {
          type: 'object',
          properties: {
            resourcePath: { type: 'string', description: 'Resource path' }
          },
          required: ['resourcePath']
        }
      },
      {
        name: 'aem_get_version_info',
        description: 'Get specific version information',
        inputSchema: {
          type: 'object',
          properties: {
            resourcePath: { type: 'string', description: 'Resource path' },
            versionName: { type: 'string', description: 'Version name' }
          },
          required: ['resourcePath', 'versionName']
        }
      },

      // System Operations Tools
      {
        name: 'aem_delete_async_job',
        description: 'Delete an async job',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: { type: 'string', description: 'Job ID to delete' }
          },
          required: ['jobId']
        }
      },

      // Permission Management Tools
      {
        name: 'aem_read_acl',
        description: 'Read ACL for a specific path',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to read ACL for' },
            includeInherited: { type: 'boolean', description: 'Include inherited ACL entries', default: true },
            depth: { type: 'number', description: 'Depth to include in ACL reading' }
          },
          required: ['path']
        }
      },
      {
        name: 'aem_get_effective_permissions',
        description: 'Get effective permissions for a principal at a specific path',
        inputSchema: {
          type: 'object',
          properties: {
            principal: { type: 'string', description: 'Principal (user or group) to check permissions for' },
            path: { type: 'string', description: 'Path to check permissions at' },
            includeRestrictions: { type: 'boolean', description: 'Include permission restrictions', default: false },
            includeInherited: { type: 'boolean', description: 'Include inherited permissions', default: true },
            includeGroups: { type: 'boolean', description: 'Include group-based permissions', default: true }
          },
          required: ['principal', 'path']
        }
      },
      {
        name: 'aem_validate_permissions',
        description: 'Validate permissions for a principal',
        inputSchema: {
          type: 'object',
          properties: {
            principal: { type: 'string', description: 'Principal to validate permissions for' },
            path: { type: 'string', description: 'Path to validate permissions at' },
            requiredPermissions: { type: 'array', items: { type: 'string' }, description: 'Required permissions to validate' }
          },
          required: ['principal', 'path', 'requiredPermissions']
        }
      },
      {
        name: 'aem_has_permission',
        description: 'Check if a principal has a specific permission',
        inputSchema: {
          type: 'object',
          properties: {
            principal: { type: 'string', description: 'Principal to check permission for' },
            path: { type: 'string', description: 'Path to check permission at' },
            privilege: { type: 'string', description: 'Privilege to check' }
          },
          required: ['principal', 'path', 'privilege']
        }
      },
      {
        name: 'aem_get_principal_permissions',
        description: 'Get all permissions for a principal across multiple paths',
        inputSchema: {
          type: 'object',
          properties: {
            principal: { type: 'string', description: 'Principal to get permissions for' },
            paths: { type: 'array', items: { type: 'string' }, description: 'Paths to check permissions at' },
            includeRestrictions: { type: 'boolean', description: 'Include permission restrictions', default: false },
            includeInherited: { type: 'boolean', description: 'Include inherited permissions', default: true },
            includeGroups: { type: 'boolean', description: 'Include group-based permissions', default: true }
          },
          required: ['principal', 'paths']
        }
      }
    ];
  }

  /**
   * Execute MCP tool
   */
  public async executeTool(request: MCPRequest): Promise<MCPResponse> {
    try {
      this.logger.debug('Executing MCP write tool', { toolName: request.params.name });

      const toolName = request.params.name;
      const args = request.params.arguments || {};

      let result: any;

      switch (toolName) {
        // Package Management
        case 'aem_create_package':
          result = await this.services.package.createPackage({
            groupName: args.groupName,
            packageName: args.packageName,
            version: args.version,
            description: args.description
          });
          break;
        case 'aem_install_package':
          result = await this.services.package.installPackage(args.packagePath, {
            recursive: args.recursive
          });
          break;
        case 'aem_delete_package':
          result = await this.services.package.deletePackage(args.packagePath, {
            force: args.force
          });
          break;

        // Page Operations
        case 'aem_create_page':
          result = await this.services.pageOperations.createPage(
            args.parentPath,
            args.pageName,
            { 
              template: args.template,
              title: args.title,
              properties: args.properties 
            }
          );
          break;
        case 'aem_copy_page':
          result = await this.services.pageOperations.copyPage(
            args.sourcePath,
            args.destinationPath,
            { shallow: args.shallow }
          );
          break;
        case 'aem_move_page':
          result = await this.services.pageOperations.movePage(
            args.sourcePath,
            args.destinationPath
          );
          break;
        case 'aem_delete_page':
          result = await this.services.pageOperations.deletePage(args.pagePath, {
            force: args.force
          });
          break;

        // Content Operations
        case 'aem_create_folder':
          if (args.ordered) {
            result = await this.services.contentOperations.createOrderedFolder(
              args.parentPath,
              args.folderName,
              { title: args.title }
            );
          } else {
            result = await this.services.contentOperations.createFolder(
              args.parentPath,
              args.folderName,
              { title: args.title }
            );
          }
          break;
        case 'aem_upload_file':
          const fileBuffer = Buffer.from(args.fileContent, 'base64');
          result = await this.services.contentOperations.uploadFile(
            args.parentPath,
            args.fileName,
            fileBuffer,
            { mimeType: args.mimeType }
          );
          break;

        // Asset Management
        case 'aem_upload_asset':
          const assetBuffer = Buffer.from(args.fileContent, 'base64');
          result = await this.services.assetManagement.uploadAsset(
            args.parentPath,
            args.fileName,
            assetBuffer,
            { metadata: args.metadata }
          );
          break;
        case 'aem_update_asset':
          result = await this.services.assetManagement.updateAsset(args.assetPath, {
            metadata: args.metadata
          });
          break;
        case 'aem_delete_asset':
          result = await this.services.assetManagement.deleteAsset(args.assetPath);
          break;
        case 'aem_get_asset_processing_status':
          result = await this.services.assetManagement.getAssetProcessingStatus(args.assetPath);
          break;
        case 'aem_create_custom_rendition':
          result = await this.services.assetManagement.createCustomRendition(args.assetPath, {
            name: args.name,
            width: args.width,
            height: args.height,
            quality: args.quality,
            format: args.format
          });
          break;
        case 'aem_apply_smart_crop':
          result = await this.services.assetManagement.applySmartCrop(args.assetPath, {
            width: args.width,
            height: args.height,
            algorithm: args.algorithm,
            renditionName: args.renditionName,
            quality: args.quality
          });
          break;
        case 'aem_process_video_asset':
          result = await this.services.assetManagement.processVideoAsset(args.assetPath, {
            generateThumbnails: args.generateThumbnails,
            thumbnailCount: args.thumbnailCount,
            generatePreview: args.generatePreview,
            previewQuality: args.previewQuality,
            extractMetadata: args.extractMetadata
          });
          break;

        // User Administration
        case 'aem_create_user':
          result = await this.services.userAdministration.createUser(
            args.userId, 
            args.password, 
            { profile: args.profile }
          );
          break;
        case 'aem_create_group':
          result = await this.services.userAdministration.createGroup(args.groupId, {
            profile: { description: args.description }
          });
          break;
        case 'aem_add_user_to_group':
          result = await this.services.userAdministration.addUserToGroup(
            args.userId,
            args.groupId
          );
          break;

        // Tag Operations
        case 'aem_create_tag_namespace':
          result = await this.services.tagOperations.createTagNamespace(args.namespace, {
            title: args.title,
            description: args.description
          });
          break;
        case 'aem_create_tag':
          result = await this.services.tagOperations.createTag(args.tagId, {
            title: args.title,
            description: args.description
          });
          break;

        // Replication
        case 'aem_publish_content':
          result = await this.services.replicationOperations.publishContent(
            args.contentPath,
            { deep: args.deep }
          );
          break;
        case 'aem_unpublish_content':
          result = await this.services.replicationOperations.unpublishContent(
            args.contentPath,
            { deep: args.deep }
          );
          break;
        case 'aem_get_replication_queue_status':
          result = await this.services.replicationOperations.getReplicationQueueStatus();
          break;
        case 'aem_get_agent_queue_status':
          result = await this.services.replicationOperations.getAgentQueueStatus(args.agentName);
          break;
        case 'aem_list_replication_agents':
          result = await this.services.replicationOperations.listReplicationAgents();
          break;
        case 'aem_get_replication_agent':
          result = await this.services.replicationOperations.getReplicationAgent(args.agentName);
          break;
        case 'aem_update_replication_agent':
          result = await this.services.replicationOperations.updateReplicationAgent(
            args.agentName,
            args.updates
          );
          break;
        case 'aem_schedule_publish':
          result = await this.services.replicationOperations.schedulePublish(
            args.contentPath,
            {
              scheduleDate: new Date(args.scheduleDate),
              timezone: args.timezone,
              deep: args.deep,
              onlyModified: args.onlyModified,
              onlyActivated: args.onlyActivated,
              ignoreDeactivated: args.ignoreDeactivated,
              force: args.force,
              workflowModel: args.workflowModel,
              comment: args.comment,
              initiator: args.initiator
            }
          );
          break;
        case 'aem_get_scheduled_publish_jobs':
          result = await this.services.replicationOperations.getScheduledPublishJobs();
          break;
        case 'aem_cancel_scheduled_publish':
          result = await this.services.replicationOperations.cancelScheduledPublish(args.jobId);
          break;

        // Workflow Operations
        case 'aem_start_workflow':
          result = await this.services.workflowOperations.startWorkflow(
            args.workflowModel,
            args.payload,
            { workflowTitle: args.title }
          );
          break;
        case 'aem_list_workflow_models':
          result = await this.services.workflowOperations.listWorkflowModels();
          break;
        case 'aem_get_workflow_model':
          result = await this.services.workflowOperations.getWorkflowModel(args.modelPath);
          break;
        case 'aem_get_workflow_instances':
          result = await this.services.workflowOperations.getWorkflowInstances({
            model: args.model,
            status: args.status,
            initiator: args.initiator,
            payload: args.payload,
            startDate: args.startDate ? new Date(args.startDate) : undefined,
            endDate: args.endDate ? new Date(args.endDate) : undefined,
            limit: args.limit,
            offset: args.offset
          });
          break;
        case 'aem_get_workflow_instance':
          result = await this.services.workflowOperations.getWorkflowInstance(args.instanceId);
          break;
        case 'aem_abort_workflow_instance':
          result = await this.services.workflowOperations.abortWorkflowInstance(args.instanceId, args.comment);
          break;
        case 'aem_suspend_workflow_instance':
          result = await this.services.workflowOperations.suspendWorkflowInstance(args.instanceId, args.comment);
          break;
        case 'aem_resume_workflow_instance':
          result = await this.services.workflowOperations.resumeWorkflowInstance(args.instanceId, args.comment);
          break;
        case 'aem_get_workflow_tasks':
          result = await this.services.workflowOperations.getWorkflowTasks({
            workflowId: args.workflowId,
            assignee: args.assignee,
            status: args.status,
            createdDate: args.createdDate ? new Date(args.createdDate) : undefined,
            dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
            limit: args.limit,
            offset: args.offset
          });
          break;
        case 'aem_get_workflow_task':
          result = await this.services.workflowOperations.getWorkflowTask(args.taskId);
          break;
        case 'aem_complete_workflow_task':
          result = await this.services.workflowOperations.completeWorkflowTask(
            args.taskId,
            args.action,
            {
              comment: args.comment,
              workflowData: args.workflowData
            }
          );
          break;
        case 'aem_start_publish_workflow':
          result = await this.services.workflowOperations.startPublishWorkflow(args.contentPath, {
            workflowTitle: args.workflowTitle,
            startComment: args.startComment,
            replicateAsTree: args.replicateAsTree,
            activateTree: args.activateTree,
            ignoreDeactivated: args.ignoreDeactivated
          });
          break;
        case 'aem_process_assets':
          result = await this.services.workflowOperations.processAssets(args.folderPath, {
            profile: args.profile,
            async: args.async,
            wait: args.wait,
            batchSize: args.batchSize
          });
          break;

        // Content Fragment Operations
        case 'aem_create_content_fragment':
          result = await this.services.contentFragmentOperations.createContentFragment(
            args.parentPath,
            args.fragmentName,
            {
              model: args.model,
              title: args.title,
              description: args.description,
              elements: args.elements,
              tags: args.tags,
              properties: args.properties
            }
          );
          break;
        case 'aem_update_content_fragment':
          result = await this.services.contentFragmentOperations.updateContentFragment(
            args.fragmentPath,
            {
              elements: args.elements,
              title: args.title,
              description: args.description,
              tags: args.tags,
              properties: args.properties,
              merge: args.merge
            }
          );
          break;
        case 'aem_delete_content_fragment':
          result = await this.services.contentFragmentOperations.deleteContentFragment(
            args.fragmentPath,
            {
              force: args.force,
              checkReferences: args.checkReferences
            }
          );
          break;
        case 'aem_create_content_fragment_model':
          result = await this.services.contentFragmentOperations.createContentFragmentModel(
            args.parentPath,
            args.modelName,
            {
              title: args.title,
              description: args.description,
              elements: args.elements,
              properties: args.properties
            }
          );
          break;
        case 'aem_get_content_fragment_model':
          result = await this.services.contentFragmentOperations.getContentFragmentModel(args.modelPath);
          break;
        case 'aem_list_content_fragment_models':
          result = await this.services.contentFragmentOperations.listContentFragmentModels(args.confPath);
          break;
        case 'aem_create_content_fragment_variation':
          result = await this.services.contentFragmentOperations.createContentFragmentVariation(
            args.fragmentPath,
            args.variationName,
            {
              title: args.title,
              description: args.description,
              elements: args.elements,
              isMaster: args.isMaster
            }
          );
          break;
        case 'aem_update_content_fragment_variation':
          result = await this.services.contentFragmentOperations.updateContentFragmentVariation(
            args.fragmentPath,
            args.variationName,
            {
              title: args.title,
              description: args.description,
              elements: args.elements,
              isMaster: args.isMaster
            }
          );
          break;
        case 'aem_delete_content_fragment_variation':
          result = await this.services.contentFragmentOperations.deleteContentFragmentVariation(
            args.fragmentPath,
            args.variationName
          );
          break;
        case 'aem_list_content_fragment_variations':
          result = await this.services.contentFragmentOperations.listContentFragmentVariations(args.fragmentPath);
          break;
        case 'aem_get_content_fragment_references':
          result = await this.services.contentFragmentOperations.getContentFragmentReferences(args.fragmentPath);
          break;

        // Version Management Operations
        case 'aem_create_version':
          result = await this.services.versionManagement.createVersion(args.resourcePath, {
            comment: args.comment,
            label: args.label,
            autoSave: args.autoSave
          });
          break;
        case 'aem_create_autosave_version':
          result = await this.services.versionManagement.createAutoSaveVersion(args.resourcePath, args.comment);
          break;
        case 'aem_compare_versions':
          result = await this.services.versionManagement.compareVersions(args.resourcePath, args.version1, args.version2);
          break;
        case 'aem_compare_with_current_version':
          result = await this.services.versionManagement.compareWithCurrentVersion(args.resourcePath, args.versionName);
          break;
        case 'aem_restore_version':
          result = await this.services.versionManagement.restoreVersion(args.resourcePath, args.versionName, {
            comment: args.comment,
            force: args.force,
            createBackup: args.createBackup
          });
          break;
        case 'aem_add_version_labels':
          result = await this.services.versionManagement.addVersionLabels(args.resourcePath, args.versionName, {
            labels: args.labels,
            comment: args.comment
          });
          break;
        case 'aem_remove_version_labels':
          result = await this.services.versionManagement.removeVersionLabels(args.resourcePath, args.versionName, args.labels, args.comment);
          break;
        case 'aem_get_version_history':
          result = await this.services.versionManagement.getVersionHistory(args.resourcePath);
          break;
        case 'aem_get_version_info':
          result = await this.services.versionManagement.getVersionInfo(args.resourcePath, args.versionName);
          break;

        // System Operations
        case 'aem_delete_async_job':
          result = await this.services.systemOperations.deleteAsyncJob(args.jobId);
          break;

        // Permission Management Operations
        case 'aem_read_acl':
          result = await this.services.permissionManagement.readACL(args.path, {
            includeInherited: args.includeInherited,
            depth: args.depth
          });
          break;
        case 'aem_get_effective_permissions':
          result = await this.services.permissionManagement.getEffectivePermissions(args.principal, args.path, {
            includeRestrictions: args.includeRestrictions,
            includeInherited: args.includeInherited,
            includeGroups: args.includeGroups
          });
          break;
        case 'aem_validate_permissions':
          result = await this.services.permissionManagement.validatePermissions(args.principal, args.path, args.requiredPermissions);
          break;
        case 'aem_has_permission':
          result = await this.services.permissionManagement.hasPermission(args.principal, args.path, args.privilege);
          break;
        case 'aem_get_principal_permissions':
          result = await this.services.permissionManagement.getPrincipalPermissions(args.principal, args.paths, {
            includeRestrictions: args.includeRestrictions,
            includeInherited: args.includeInherited,
            includeGroups: args.includeGroups
          });
          break;

        default:
          throw new AEMException(
            `Unknown tool: ${toolName}`,
            'VALIDATION_ERROR',
            false
          );
      }

      // Format response
      const response: MCPResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };

      this.logger.debug('MCP write tool executed successfully', { toolName });
      return response;

    } catch (error) {
      this.logger.error('Failed to execute MCP write tool', error as Error, { toolName: request.params.name });
      
      const errorMessage = error instanceof AEMException 
        ? error.message 
        : `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`;

      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool ${request.params.name}: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Handle MCP request
   */
  public async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    switch (request.method) {
      case 'tools/list':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ tools: this.getTools() }, null, 2)
            }
          ]
        };

      case 'tools/call':
        return await this.executeTool(request);

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown method: ${request.method}`
            }
          ],
          isError: true
        };
    }
  }
}
