/**
 * MCP Protocol Handler for Read Server
 * Handles MCP tool discovery, schema generation, and tool execution
 */

import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';
import { AEMHttpClient } from '@aemaacs-mcp/shared';

// Import all read services
import { PackageService } from '../services/package-service.js';
import { ContentDiscoveryService } from '../services/content-discovery-service.js';
import { ComponentAnalysisService } from '../services/component-analysis-service.js';
import { SearchQueryService } from '../services/search-query-service.js';
import { AssetManagementService } from '../services/asset-management-service.js';
import { UserAdministrationService } from '../services/user-administration-service.js';
import { TagManagementService } from '../services/tag-management-service.js';
import { TemplateSiteService } from '../services/template-site-service.js';
import { WorkflowService } from '../services/workflow-service.js';
import { ReplicationService } from '../services/replication-service.js';
import { SystemOperationsService } from '../services/system-operations-service.js';
import { TemplateComponentManagementService } from '../services/template-component-management-service.js';

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
    contentDiscovery: ContentDiscoveryService;
    componentAnalysis: ComponentAnalysisService;
    searchQuery: SearchQueryService;
    assetManagement: AssetManagementService;
    userAdministration: UserAdministrationService;
    tagManagement: TagManagementService;
    templateSite: TemplateSiteService;
    workflow: WorkflowService;
    replication: ReplicationService;
    systemOperations: SystemOperationsService;
    templateComponentManagement: TemplateComponentManagementService;
  };

  constructor(client: AEMHttpClient) {
    this.logger = Logger.getInstance();
    this.client = client;
    
    // Initialize all services
    this.services = {
      package: new PackageService(client),
      contentDiscovery: new ContentDiscoveryService(client),
      componentAnalysis: new ComponentAnalysisService(client),
      searchQuery: new SearchQueryService(client),
      assetManagement: new AssetManagementService(client),
      userAdministration: new UserAdministrationService(client),
      tagManagement: new TagManagementService(client),
      templateSite: new TemplateSiteService(client),
      workflow: new WorkflowService(client),
      replication: new ReplicationService(client),
      systemOperations: new SystemOperationsService(client),
      templateComponentManagement: new TemplateComponentManagementService(client)
    };
  }

  /**
   * Get list of available MCP tools
   */
  public getTools(): MCPTool[] {
    return [
      // Package Management Tools
      {
        name: 'aem_list_packages',
        description: 'List all packages in AEM with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            group: { type: 'string', description: 'Filter by package group' },
            installed: { type: 'boolean', description: 'Filter by installation status' }
          }
        }
      },
      {
        name: 'aem_get_package_info',
        description: 'Get detailed information about a specific package',
        inputSchema: {
          type: 'object',
          properties: {
            packagePath: { type: 'string', description: 'Path to the package' }
          },
          required: ['packagePath']
        }
      },

      // Content Discovery Tools
      {
        name: 'aem_list_pages',
        description: 'List pages in AEM with optional depth and filtering',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Root path to list pages from', default: '/content' },
            depth: { type: 'number', description: 'Maximum depth to traverse', default: 1 },
            limit: { type: 'number', description: 'Maximum number of pages to return', default: 100 }
          }
        }
      },
      {
        name: 'aem_get_page_content',
        description: 'Get complete content of a specific page',
        inputSchema: {
          type: 'object',
          properties: {
            pagePath: { type: 'string', description: 'Path to the page' },
            depth: { type: 'number', description: 'Depth of content to retrieve', default: 2 }
          },
          required: ['pagePath']
        }
      },
      {
        name: 'aem_get_page_properties',
        description: 'Get properties and metadata of a specific page',
        inputSchema: {
          type: 'object',
          properties: {
            pagePath: { type: 'string', description: 'Path to the page' }
          },
          required: ['pagePath']
        }
      },

      // Component Analysis Tools
      {
        name: 'aem_scan_page_components',
        description: 'Scan and analyze components on a page',
        inputSchema: {
          type: 'object',
          properties: {
            pagePath: { type: 'string', description: 'Path to the page to scan' },
            includeInherited: { type: 'boolean', description: 'Include inherited components', default: false }
          },
          required: ['pagePath']
        }
      },
      {
        name: 'aem_get_page_text_content',
        description: 'Extract all text content from a page',
        inputSchema: {
          type: 'object',
          properties: {
            pagePath: { type: 'string', description: 'Path to the page' },
            includeHidden: { type: 'boolean', description: 'Include hidden text content', default: false }
          },
          required: ['pagePath']
        }
      },
      {
        name: 'aem_get_page_images',
        description: 'Get all image references from a page',
        inputSchema: {
          type: 'object',
          properties: {
            pagePath: { type: 'string', description: 'Path to the page' }
          },
          required: ['pagePath']
        }
      },

      // Search and Query Tools
      {
        name: 'aem_search_content',
        description: 'Search for content using QueryBuilder API',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            path: { type: 'string', description: 'Path to search within', default: '/content' },
            type: { type: 'string', description: 'Node type to search for', default: 'cq:Page' },
            limit: { type: 'number', description: 'Maximum results to return', default: 20 }
          },
          required: ['query']
        }
      },
      {
        name: 'aem_search_assets',
        description: 'Search for assets in DAM',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            mimeType: { type: 'string', description: 'Filter by MIME type' },
            limit: { type: 'number', description: 'Maximum results to return', default: 20 }
          },
          required: ['query']
        }
      },
      {
        name: 'aem_advanced_search',
        description: 'Advanced search with full QueryBuilder support, facets, and pagination',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to search within' },
            type: { type: 'string', description: 'Node type to search for' },
            fulltext: { type: 'string', description: 'Full-text search term' },
            filters: { type: 'object', description: 'Property filters as key-value pairs' },
            facets: { type: 'array', items: { type: 'string' }, description: 'Facet fields to include' },
            boost: { type: 'object', description: 'Field boost values' },
            fuzzy: { type: 'boolean', description: 'Enable fuzzy search', default: false },
            synonyms: { type: 'boolean', description: 'Enable synonym search', default: false },
            orderBy: { type: 'string', description: 'Field to order by' },
            orderDirection: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction', default: 'desc' },
            limit: { type: 'number', description: 'Maximum results to return', default: 20 },
            offset: { type: 'number', description: 'Results offset for pagination', default: 0 }
          }
        }
      },
      {
        name: 'aem_search_content_fragments',
        description: 'Search content fragments with advanced filtering',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to search within', default: '/content/dam' },
            model: { type: 'string', description: 'Content fragment model' },
            variation: { type: 'string', description: 'Content fragment variation' },
            elements: { type: 'array', items: { type: 'string' }, description: 'Element names to search' },
            elementValues: { type: 'array', items: { type: 'string' }, description: 'Element values to match' },
            fulltext: { type: 'string', description: 'Full-text search term' },
            limit: { type: 'number', description: 'Maximum results to return', default: 20 },
            offset: { type: 'number', description: 'Results offset for pagination', default: 0 }
          }
        }
      },
      {
        name: 'aem_get_search_suggestions',
        description: 'Get search suggestions based on query',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query for suggestions' },
            path: { type: 'string', description: 'Path to search within' },
            type: { type: 'string', description: 'Node type to search for' },
            limit: { type: 'number', description: 'Maximum suggestions to return', default: 10 }
          },
          required: ['query']
        }
      },
      {
        name: 'aem_get_search_facets',
        description: 'Get search facets for filtering',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to search within' },
            type: { type: 'string', description: 'Node type to search for' },
            facets: { type: 'array', items: { type: 'string' }, description: 'Facet fields to retrieve' }
          }
        }
      },

      // Asset Management Tools
      {
        name: 'aem_list_assets',
        description: 'List assets in DAM with filtering options',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'DAM path to list assets from', default: '/content/dam' },
            mimeType: { type: 'string', description: 'Filter by MIME type' },
            limit: { type: 'number', description: 'Maximum assets to return', default: 50 }
          }
        }
      },
      {
        name: 'aem_get_asset_metadata',
        description: 'Get metadata for a specific asset',
        inputSchema: {
          type: 'object',
          properties: {
            assetPath: { type: 'string', description: 'Path to the asset' }
          },
          required: ['assetPath']
        }
      },
      {
        name: 'aem_get_asset_renditions',
        description: 'Get available renditions for an asset',
        inputSchema: {
          type: 'object',
          properties: {
            assetPath: { type: 'string', description: 'Path to the asset' }
          },
          required: ['assetPath']
        }
      },

      // User Administration Tools
      {
        name: 'aem_list_users',
        description: 'List users in AEM',
        inputSchema: {
          type: 'object',
          properties: {
            group: { type: 'string', description: 'Filter by group membership' },
            limit: { type: 'number', description: 'Maximum users to return', default: 50 }
          }
        }
      },
      {
        name: 'aem_list_groups',
        description: 'List groups in AEM',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Maximum groups to return', default: 50 }
          }
        }
      },
      {
        name: 'aem_get_user_profile',
        description: 'Get detailed profile information for a user',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'User ID' }
          },
          required: ['userId']
        }
      },

      // Tag Management Tools
      {
        name: 'aem_list_tag_namespaces',
        description: 'List all tag namespaces',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'aem_list_tags',
        description: 'List tags with optional namespace filtering',
        inputSchema: {
          type: 'object',
          properties: {
            namespace: { type: 'string', description: 'Filter by namespace' },
            includeChildren: { type: 'boolean', description: 'Include child tags', default: true }
          }
        }
      },
      {
        name: 'aem_get_tagged_content',
        description: 'Find content tagged with specific tags',
        inputSchema: {
          type: 'object',
          properties: {
            tags: { type: 'array', items: { type: 'string' }, description: 'Tag IDs to search for' },
            path: { type: 'string', description: 'Path to search within', default: '/content' }
          },
          required: ['tags']
        }
      },

      // System Operations Tools
      {
        name: 'aem_get_system_health',
        description: 'Get AEM system health information',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'aem_get_system_info',
        description: 'Get AEM system information',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'aem_list_async_jobs',
        description: 'List running async jobs',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', description: 'Filter by job status' }
          }
        }
      },

      // Template and Component Management Tools
      {
        name: 'aem_discover_templates',
        description: 'Discover all available templates',
        inputSchema: {
          type: 'object',
          properties: {
            sitePath: { type: 'string', description: 'Site path to discover templates for' }
          }
        }
      },
      {
        name: 'aem_analyze_component_usage',
        description: 'Analyze component usage across the site',
        inputSchema: {
          type: 'object',
          properties: {
            componentPath: { type: 'string', description: 'Specific component path to analyze' },
            resourceType: { type: 'string', description: 'Filter by resource type' },
            allowedPaths: { type: 'array', items: { type: 'string' }, description: 'Filter by allowed paths' },
            allowedChildren: { type: 'array', items: { type: 'string' }, description: 'Filter by allowed children' },
            includeInherited: { type: 'boolean', description: 'Include inherited components', default: false }
          }
        }
      },
      {
        name: 'aem_track_component_dependencies',
        description: 'Track component dependencies',
        inputSchema: {
          type: 'object',
          properties: {
            componentPath: { type: 'string', description: 'Specific component path to track dependencies for' },
            includeCircular: { type: 'boolean', description: 'Include circular dependencies', default: false },
            includeInherited: { type: 'boolean', description: 'Include inherited dependencies', default: true },
            maxDepth: { type: 'number', description: 'Maximum depth for dependency tracking' }
          }
        }
      },
      {
        name: 'aem_analyze_template_structure',
        description: 'Analyze template structure and components',
        inputSchema: {
          type: 'object',
          properties: {
            templatePath: { type: 'string', description: 'Template path to analyze' }
          },
          required: ['templatePath']
        }
      },
      {
        name: 'aem_get_component_usage_statistics',
        description: 'Get component usage statistics',
        inputSchema: {
          type: 'object',
          properties: {
            componentPath: { type: 'string', description: 'Specific component path to get statistics for' }
          }
        }
      }
    ];
  }

  /**
   * Execute MCP tool
   */
  public async executeTool(request: MCPRequest): Promise<MCPResponse> {
    try {
      this.logger.debug('Executing MCP tool', { toolName: request.params.name });

      const toolName = request.params.name;
      const args = request.params.arguments || {};

      let result: any;

      switch (toolName) {
        // Package Management
        case 'aem_list_packages':
          result = await this.services.package.listPackages(args);
          break;
        case 'aem_get_package_info':
          result = await this.services.package.getPackageInfo(args.packagePath);
          break;

        // Content Discovery
        case 'aem_list_pages':
          result = await this.services.contentDiscovery.listPages(args.path || '/content', {
            depth: args.depth,
            limit: args.limit
          });
          break;
        case 'aem_get_page_content':
          result = await this.services.contentDiscovery.getPageContent(args.pagePath);
          break;
        case 'aem_get_page_properties':
          result = await this.services.contentDiscovery.getPageProperties(args.pagePath);
          break;

        // Component Analysis
        case 'aem_scan_page_components':
          result = await this.services.componentAnalysis.scanPageComponents(args.pagePath);
          break;
        case 'aem_get_page_text_content':
          result = await this.services.componentAnalysis.getPageTextContent(args.pagePath);
          break;
        case 'aem_get_page_images':
          result = await this.services.componentAnalysis.getPageImages(args.pagePath);
          break;

        // Search and Query
        case 'aem_search_content':
          result = await this.services.searchQuery.searchContent({
            fulltext: args.query,
            path: args.path,
            type: args.type,
            limit: args.limit
          });
          break;
        case 'aem_search_assets':
          result = await this.services.searchQuery.searchAssets({
            path: args.path,
            mimeType: args.mimeType,
            tags: args.tags,
            limit: args.limit
          });
          break;
        case 'aem_advanced_search':
          result = await this.services.searchQuery.advancedSearch({
            path: args.path,
            type: args.type,
            fulltext: args.fulltext,
            filters: args.filters,
            facets: args.facets,
            boost: args.boost,
            fuzzy: args.fuzzy,
            synonyms: args.synonyms,
            orderBy: args.orderBy,
            orderDirection: args.orderDirection,
            limit: args.limit,
            offset: args.offset
          });
          break;
        case 'aem_search_content_fragments':
          result = await this.services.searchQuery.searchContentFragments({
            path: args.path,
            model: args.model,
            variation: args.variation,
            elements: args.elements,
            elementValues: args.elementValues,
            fulltext: args.fulltext,
            limit: args.limit,
            offset: args.offset
          });
          break;
        case 'aem_get_search_suggestions':
          result = await this.services.searchQuery.getSearchSuggestions(args.query, {
            path: args.path,
            type: args.type,
            limit: args.limit
          });
          break;
        case 'aem_get_search_facets':
          result = await this.services.searchQuery.getSearchFacets({
            path: args.path,
            type: args.type,
            facets: args.facets
          });
          break;

        // Asset Management
        case 'aem_list_assets':
          result = await this.services.assetManagement.listAssets({
            path: args.path || '/content/dam',
            mimeType: args.mimeType,
            limit: args.limit
          });
          break;
        case 'aem_get_asset_metadata':
          result = await this.services.assetManagement.getAssetMetadata(args.assetPath);
          break;
        case 'aem_get_asset_renditions':
          result = await this.services.assetManagement.getAssetRenditions(args.assetPath);
          break;

        // User Administration
        case 'aem_list_users':
          result = await this.services.userAdministration.listUsers({
            path: args.path,
            query: args.query
          });
          break;
        case 'aem_list_groups':
          result = await this.services.userAdministration.listGroups({
            limit: args.limit
          });
          break;
        case 'aem_get_user_profile':
          result = await this.services.userAdministration.getUserProfile(args.userId);
          break;

        // Tag Management
        case 'aem_list_tag_namespaces':
          result = await this.services.tagManagement.listTagNamespaces();
          break;
        case 'aem_list_tags':
          result = await this.services.tagManagement.listTags({
            namespace: args.namespace,
            includeChildren: args.includeChildren
          });
          break;
        case 'aem_get_tagged_content':
          result = await this.services.tagManagement.getTaggedContent(args.tags, {
            path: args.path
          });
          break;

        // System Operations
        case 'aem_get_system_health':
          result = await this.services.systemOperations.getSystemHealth();
          break;
        case 'aem_get_system_info':
          result = await this.services.systemOperations.getSystemInfo();
          break;
        case 'aem_list_async_jobs':
          result = await this.services.systemOperations.getAsyncJobs({
            state: args.status,
            limit: args.limit
          });
          break;

        // Template and Component Management
        case 'aem_discover_templates':
          result = await this.services.templateComponentManagement.discoverTemplates(args.sitePath);
          break;
        case 'aem_analyze_component_usage':
          result = await this.services.templateComponentManagement.analyzeComponentUsage(args.componentPath, {
            resourceType: args.resourceType,
            allowedPaths: args.allowedPaths,
            allowedChildren: args.allowedChildren,
            includeInherited: args.includeInherited
          });
          break;
        case 'aem_track_component_dependencies':
          result = await this.services.templateComponentManagement.trackComponentDependencies(args.componentPath, {
            includeCircular: args.includeCircular,
            includeInherited: args.includeInherited,
            maxDepth: args.maxDepth
          });
          break;
        case 'aem_analyze_template_structure':
          result = await this.services.templateComponentManagement.analyzeTemplateStructure(args.templatePath);
          break;
        case 'aem_get_component_usage_statistics':
          result = await this.services.templateComponentManagement.getComponentUsageStatistics(args.componentPath);
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

      this.logger.debug('MCP tool executed successfully', { toolName });
      return response;

    } catch (error) {
      this.logger.error('Failed to execute MCP tool', error as Error, { toolName: request.params.name });
      
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
