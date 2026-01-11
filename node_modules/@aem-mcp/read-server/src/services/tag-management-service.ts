/**
 * Tag Management Service for AEMaaCS read operations
 * Handles tag namespace discovery, tag hierarchy, and tagged content discovery
 */

import { AEMHttpClient, RequestOptions } from '@aemaacs-mcp/shared';
import { AEMResponse, Tag } from '@aemaacs-mcp/shared';
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

export interface TagNamespace {
  id: string;
  path: string;
  title: string;
  description?: string;
  created?: Date;
  lastModified?: Date;
  tagCount?: number;
}

export interface TagDetails extends Tag {
  created?: Date;
  lastModified?: Date;
  translations?: Record<string, TagTranslation>;
  usageCount?: number;
  childCount?: number;
}

export interface TagTranslation {
  title: string;
  description?: string;
  locale: string;
}

export interface TaggedContent {
  path: string;
  title?: string;
  resourceType?: string;
  tags: string[];
  lastModified?: Date;
}

export interface TaggedContentResponse {
  tagId: string;
  tagTitle?: string;
  totalContent: number;
  content: TaggedContent[];
}

export interface TagHierarchy {
  rootNamespace: string;
  totalTags: number;
  maxDepth: number;
  tags: TagHierarchyNode[];
}

export interface TagHierarchyNode extends Tag {
  level: number;
  hasChildren: boolean;
  childCount: number;
  children?: TagHierarchyNode[];
}

export interface ListTagsOptions {
  namespace?: string;
  parentTag?: string;
  includeChildren?: boolean;
  maxDepth?: number;
  orderBy?: 'title' | 'id' | 'created' | 'modified';
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ListTaggedContentOptions {
  contentType?: string;
  path?: string;
  includeSubpaths?: boolean;
  orderBy?: 'title' | 'path' | 'modified';
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export class TagManagementService {
  private client: AEMHttpClient;
  private logger: Logger;

  constructor(client: AEMHttpClient) {
    this.client = client;
    this.logger = Logger.getInstance();
  }

  /**
   * List tag namespaces
   */
  async listTagNamespaces(): Promise<AEMResponse<TagNamespace[]>> {
    try {
      this.logger.debug('Listing tag namespaces');

      const requestOptions: RequestOptions = {
        cache: true,
        cacheTtl: 600000, // Cache for 10 minutes
        context: {
          operation: 'listTagNamespaces',
          resource: '/content/cq:tags'
        }
      };

      // Get tag namespaces from the tag root
      const response = await this.client.get<any>(
        '/content/cq:tags.1.json',
        undefined,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          'Failed to list tag namespaces',
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const namespaces = this.parseTagNamespacesResponse(response.data);

      this.logger.debug('Successfully listed tag namespaces', { 
        namespaceCount: namespaces.length
      });

      return {
        success: true,
        data: namespaces,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0,
          cached: response.metadata?.cached
        }
      };

    } catch (error) {
      this.logger.error('Failed to list tag namespaces', error as Error);
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while listing tag namespaces',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error }
      );
    }
  }

  /**
   * List tags with hierarchy support
   */
  async listTags(options: ListTagsOptions = {}): Promise<AEMResponse<TagDetails[]>> {
    try {
      this.logger.debug('Listing tags', { options });

      const basePath = options.namespace 
        ? `/content/cq:tags/${options.namespace}`
        : options.parentTag 
          ? `/content/cq:tags/${options.parentTag}`
          : '/content/cq:tags';

      const depth = options.maxDepth || (options.includeChildren ? 2 : 1);

      const requestOptions: RequestOptions = {
        cache: true,
        cacheTtl: 300000, // Cache for 5 minutes
        context: {
          operation: 'listTags',
          resource: basePath
        }
      };

      // Get tags with specified depth
      const response = await this.client.get<any>(
        `${basePath}.${depth}.json`,
        undefined,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to list tags at ${basePath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      let tags = this.parseTagListResponse(response.data, basePath);

      // Apply client-side filtering and sorting
      if (options.orderBy) {
        tags = this.sortTags(tags, options.orderBy, options.orderDirection);
      }
      
      if (options.limit || options.offset) {
        const start = options.offset || 0;
        const end = options.limit ? start + options.limit : undefined;
        tags = tags.slice(start, end);
      }

      this.logger.debug('Successfully listed tags', { 
        tagCount: tags.length,
        basePath
      });

      return {
        success: true,
        data: tags,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0,
          cached: response.metadata?.cached
        }
      };

    } catch (error) {
      this.logger.error('Failed to list tags', error as Error);
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while listing tags',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error }
      );
    }
  }

  /**
   * Get tag details with properties and translations
   */
  async getTagDetails(tagId: string): Promise<AEMResponse<TagDetails>> {
    try {
      this.logger.debug('Getting tag details', { tagId });

      if (!tagId) {
        throw new AEMException(
          'Tag ID is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const tagPath = `/content/cq:tags/${tagId}`;

      const requestOptions: RequestOptions = {
        cache: true,
        cacheTtl: 300000, // Cache for 5 minutes
        context: {
          operation: 'getTagDetails',
          resource: tagPath
        }
      };

      // Get tag details with translations
      const response = await this.client.get<any>(
        `${tagPath}.json`,
        undefined,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Tag not found: ${tagId}`,
          'NOT_FOUND_ERROR',
          false,
          undefined,
          { tagId }
        );
      }

      const tagDetails = this.parseTagDetailsResponse(response.data, tagId, tagPath);

      this.logger.debug('Successfully retrieved tag details', { 
        tagId,
        title: tagDetails.title
      });

      return {
        success: true,
        data: tagDetails,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0,
          cached: response.metadata?.cached
        }
      };

    } catch (error) {
      this.logger.error('Failed to get tag details', error as Error, { tagId });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while getting tag details for ${tagId}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, tagId }
      );
    }
  }

  /**
   * Get content tagged with specific tags
   */
  async getTaggedContent(tagId: string, options: ListTaggedContentOptions = {}): Promise<AEMResponse<TaggedContentResponse>> {
    try {
      this.logger.debug('Getting tagged content', { tagId, options });

      if (!tagId) {
        throw new AEMException(
          'Tag ID is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const params: Record<string, any> = {
        'tagid': tagId,
        'p.limit': options.limit || 50,
        'p.offset': options.offset || 0
      };

      // Add path filter
      if (options.path) {
        params['path'] = options.path;
        if (options.includeSubpaths !== false) {
          params['path.flat'] = 'false';
        }
      }

      // Add content type filter
      if (options.contentType) {
        params['type'] = options.contentType;
      }

      // Add ordering
      if (options.orderBy) {
        switch (options.orderBy) {
          case 'title':
            params['orderby'] = '@jcr:title';
            break;
          case 'path':
            params['orderby'] = '@jcr:path';
            break;
          case 'modified':
            params['orderby'] = '@jcr:lastModified';
            break;
        }
        
        if (options.orderDirection) {
          params['orderby.sort'] = options.orderDirection;
        }
      }

      const requestOptions: RequestOptions = {
        cache: true,
        cacheTtl: 180000, // Cache for 3 minutes
        context: {
          operation: 'getTaggedContent',
          resource: `/content/cq:tags/${tagId}`
        }
      };

      const response = await this.client.get<any>('/bin/querybuilder.json', params, requestOptions);

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to get tagged content for ${tagId}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const taggedContentResponse = this.parseTaggedContentResponse(response.data, tagId);

      this.logger.debug('Successfully retrieved tagged content', { 
        tagId,
        contentCount: taggedContentResponse.totalContent
      });

      return {
        success: true,
        data: taggedContentResponse,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0,
          cached: response.metadata?.cached
        }
      };

    } catch (error) {
      this.logger.error('Failed to get tagged content', error as Error, { tagId });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while getting tagged content for ${tagId}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, tagId }
      );
    }
  }

  /**
   * Get complete tag hierarchy
   */
  async getTagHierarchy(namespace: string): Promise<AEMResponse<TagHierarchy>> {
    try {
      this.logger.debug('Getting tag hierarchy', { namespace });

      if (!namespace) {
        throw new AEMException(
          'Namespace is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const namespacePath = `/content/cq:tags/${namespace}`;

      const requestOptions: RequestOptions = {
        cache: true,
        cacheTtl: 600000, // Cache for 10 minutes
        context: {
          operation: 'getTagHierarchy',
          resource: namespacePath
        }
      };

      // Get complete hierarchy with deep traversal
      const response = await this.client.get<any>(
        `${namespacePath}.infinity.json`,
        undefined,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Tag namespace not found: ${namespace}`,
          'NOT_FOUND_ERROR',
          false,
          undefined,
          { namespace }
        );
      }

      const hierarchy = this.parseTagHierarchyResponse(response.data, namespace);

      this.logger.debug('Successfully retrieved tag hierarchy', { 
        namespace,
        totalTags: hierarchy.totalTags,
        maxDepth: hierarchy.maxDepth
      });

      return {
        success: true,
        data: hierarchy,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0,
          cached: response.metadata?.cached
        }
      };

    } catch (error) {
      this.logger.error('Failed to get tag hierarchy', error as Error, { namespace });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while getting tag hierarchy for ${namespace}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, namespace }
      );
    }
  }

  /**
   * Parse tag namespaces response
   */
  private parseTagNamespacesResponse(data: any): TagNamespace[] {
    const namespaces: TagNamespace[] = [];
    
    // Skip known properties that aren't namespaces
    const skipProps = ['jcr:primaryType', 'jcr:mixinTypes', 'jcr:created', 'jcr:createdBy'];
    
    for (const key of Object.keys(data)) {
      if (skipProps.includes(key)) continue;
      
      const namespace = data[key];
      if (namespace && typeof namespace === 'object' && namespace['jcr:primaryType'] === 'cq:Tag') {
        namespaces.push({
          id: key,
          path: `/content/cq:tags/${key}`,
          title: namespace['jcr:title'] || key,
          description: namespace['jcr:description'],
          created: namespace['jcr:created'] ? new Date(namespace['jcr:created']) : undefined,
          lastModified: namespace['jcr:lastModified'] ? new Date(namespace['jcr:lastModified']) : undefined,
          tagCount: this.countChildTags(namespace)
        });
      }
    }
    
    return namespaces;
  }

  /**
   * Parse tag list response
   */
  private parseTagListResponse(data: any, basePath: string): TagDetails[] {
    const tags: TagDetails[] = [];
    
    // If this is the root response, process child tags
    if (data['jcr:primaryType'] === 'cq:Tag') {
      // This is a single tag, process it
      const tagId = basePath.replace('/content/cq:tags/', '');
      tags.push(this.mapToTagDetails(data, tagId, basePath));
    } else {
      // Process child tags
      const skipProps = ['jcr:primaryType', 'jcr:mixinTypes', 'jcr:created', 'jcr:createdBy'];
      
      for (const key of Object.keys(data)) {
        if (skipProps.includes(key)) continue;
        
        const tag = data[key];
        if (tag && typeof tag === 'object' && tag['jcr:primaryType'] === 'cq:Tag') {
          const tagId = basePath === '/content/cq:tags' ? key : `${basePath.replace('/content/cq:tags/', '')}/${key}`;
          tags.push(this.mapToTagDetails(tag, tagId, `${basePath}/${key}`));
        }
      }
    }
    
    return tags;
  }

  /**
   * Parse tag details response
   */
  private parseTagDetailsResponse(data: any, tagId: string, tagPath: string): TagDetails {
    const tagDetails = this.mapToTagDetails(data, tagId, tagPath);
    
    // Add translations
    tagDetails.translations = this.parseTagTranslations(data);
    
    return tagDetails;
  }

  /**
   * Parse tagged content response
   */
  private parseTaggedContentResponse(data: any, tagId: string): TaggedContentResponse {
    const hits = data.hits || [];
    const content: TaggedContent[] = [];
    
    for (const hit of hits) {
      content.push({
        path: hit.path,
        title: hit['jcr:title'] || hit.name,
        resourceType: hit['sling:resourceType'],
        tags: hit['cq:tags'] || [],
        lastModified: hit['jcr:lastModified'] ? new Date(hit['jcr:lastModified']) : undefined
      });
    }
    
    return {
      tagId,
      tagTitle: undefined, // Would need separate call to get tag title
      totalContent: content.length,
      content
    };
  }

  /**
   * Parse tag hierarchy response
   */
  private parseTagHierarchyResponse(data: any, namespace: string): TagHierarchy {
    const tags: TagHierarchyNode[] = [];
    let totalTags = 0;
    let maxDepth = 0;
    
    // Process the hierarchy recursively
    this.processTagHierarchyNode(data, namespace, '', 0, tags, (count, depth) => {
      totalTags += count;
      maxDepth = Math.max(maxDepth, depth);
    });
    
    return {
      rootNamespace: namespace,
      totalTags,
      maxDepth,
      tags
    };
  }

  /**
   * Process tag hierarchy node recursively
   */
  private processTagHierarchyNode(
    data: any, 
    namespace: string, 
    parentPath: string, 
    level: number, 
    result: TagHierarchyNode[],
    callback: (count: number, depth: number) => void
  ): void {
    const skipProps = ['jcr:primaryType', 'jcr:mixinTypes', 'jcr:created', 'jcr:createdBy'];
    
    for (const key of Object.keys(data)) {
      if (skipProps.includes(key)) continue;
      
      const tag = data[key];
      if (tag && typeof tag === 'object' && tag['jcr:primaryType'] === 'cq:Tag') {
        const tagId = parentPath ? `${parentPath}/${key}` : key;
        const fullTagId = `${namespace}/${tagId}`;
        
        const children: TagHierarchyNode[] = [];
        let childCount = 0;
        
        // Process children recursively
        this.processTagHierarchyNode(tag, namespace, tagId, level + 1, children, (count, depth) => {
          childCount += count;
          callback(count, depth);
        });
        
        const hierarchyNode: TagHierarchyNode = {
          id: fullTagId,
          path: `/content/cq:tags/${fullTagId}`,
          title: tag['jcr:title'] || key,
          description: tag['jcr:description'],
          namespace: namespace,
          parentPath: parentPath ? `/content/cq:tags/${namespace}/${parentPath}` : `/content/cq:tags/${namespace}`,
          level,
          hasChildren: children.length > 0,
          childCount,
          children: children.length > 0 ? children : undefined
        };
        
        result.push(hierarchyNode);
        callback(1, level);
      }
    }
  }

  /**
   * Map data to TagDetails
   */
  private mapToTagDetails(data: any, tagId: string, tagPath: string): TagDetails {
    return {
      id: tagId,
      path: tagPath,
      title: data['jcr:title'] || tagId.split('/').pop() || tagId,
      description: data['jcr:description'],
      namespace: tagId.split('/')[0],
      parentPath: tagPath.substring(0, tagPath.lastIndexOf('/')) || undefined,
      created: data['jcr:created'] ? new Date(data['jcr:created']) : undefined,
      lastModified: data['jcr:lastModified'] ? new Date(data['jcr:lastModified']) : undefined,
      childCount: this.countChildTags(data),
      children: this.extractChildTags(data, tagId, tagPath)
    };
  }

  /**
   * Parse tag translations
   */
  private parseTagTranslations(data: any): Record<string, TagTranslation> {
    const translations: Record<string, TagTranslation> = {};
    
    // Look for translation nodes
    for (const key of Object.keys(data)) {
      if (key.startsWith('jcr:title.') || key.startsWith('jcr:description.')) {
        const parts = key.split('.');
        if (parts.length === 2) {
          const locale = parts[1];
          if (locale && !translations[locale]) {
            translations[locale] = {
              title: '',
              locale
            };
          }
          
          if (locale && key.startsWith('jcr:title.')) {
            translations[locale].title = data[key];
          } else if (locale && key.startsWith('jcr:description.')) {
            translations[locale].description = data[key];
          }
        }
      }
    }
    
    return translations;
  }

  /**
   * Count child tags
   */
  private countChildTags(data: any): number {
    let count = 0;
    const skipProps = ['jcr:primaryType', 'jcr:mixinTypes', 'jcr:created', 'jcr:createdBy'];
    
    for (const key of Object.keys(data)) {
      if (skipProps.includes(key)) continue;
      
      const child = data[key];
      if (child && typeof child === 'object' && child['jcr:primaryType'] === 'cq:Tag') {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Extract child tags
   */
  private extractChildTags(data: any, parentTagId: string, parentTagPath: string): Tag[] | undefined {
    const children: Tag[] = [];
    const skipProps = ['jcr:primaryType', 'jcr:mixinTypes', 'jcr:created', 'jcr:createdBy'];
    
    for (const key of Object.keys(data)) {
      if (skipProps.includes(key)) continue;
      
      const child = data[key];
      if (child && typeof child === 'object' && child['jcr:primaryType'] === 'cq:Tag') {
        const childTagId = `${parentTagId}/${key}`;
        const childTagPath = `${parentTagPath}/${key}`;
        
        children.push({
          id: childTagId,
          path: childTagPath,
          title: child['jcr:title'] || key,
          description: child['jcr:description'],
          namespace: parentTagId.split('/')[0] || '',
          parentPath: parentTagPath
        });
      }
    }
    
    return children.length > 0 ? children : undefined;
  }

  /**
   * Sort tags by specified criteria
   */
  private sortTags(tags: TagDetails[], orderBy: string, direction: 'asc' | 'desc' = 'asc'): TagDetails[] {
    return tags.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (orderBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'id':
          aValue = a.id.toLowerCase();
          bValue = b.id.toLowerCase();
          break;
        case 'created':
          aValue = a.created ? a.created.getTime() : 0;
          bValue = b.created ? b.created.getTime() : 0;
          break;
        case 'modified':
          aValue = a.lastModified ? a.lastModified.getTime() : 0;
          bValue = b.lastModified ? b.lastModified.getTime() : 0;
          break;
        default:
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
      }

      if (aValue < bValue) {
        return direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
}
