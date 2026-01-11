/**
 * Tag Operations Service for AEMaaCS write operations
 * Handles tag namespace creation, tag creation, editing, moving, and deletion
 */

import { AEMHttpClient, RequestOptions } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

export interface CreateTagNamespaceOptions {
  title?: string;
  description?: string;
  properties?: Record<string, any>;
}

export interface CreateTagOptions {
  title?: string;
  description?: string;
  parentTagId?: string;
  properties?: Record<string, any>;
}

export interface MoveTagOptions {
  newParentTagId?: string;
  newName?: string;
}

export interface EditTagOptions {
  title?: string;
  description?: string;
  properties?: Record<string, any>;
  translations?: Record<string, { title?: string; description?: string }>;
}

export interface DeleteTagOptions {
  force?: boolean;
  recursive?: boolean;
}

export interface TagOperationResult {
  success: boolean;
  tagId?: string;
  tagPath?: string;
  message?: string;
  warnings?: string[];
  errors?: string[];
}

export interface NamespaceResult extends TagOperationResult {
  namespace?: string;
  namespacePath?: string;
}

export interface TagResult extends TagOperationResult {
  title?: string;
  description?: string;
  parentTagId?: string;
}

export interface MoveResult extends TagOperationResult {
  oldPath?: string;
  newPath?: string;
  newTagId?: string;
}

export class TagOperationsService {
  private client: AEMHttpClient;
  private logger: Logger;

  constructor(client: AEMHttpClient) {
    this.client = client;
    this.logger = Logger.getInstance();
  }

  /**
   * Create tag namespace using /bin/tagcommand
   */
  async createTagNamespace(
    namespace: string,
    options: CreateTagNamespaceOptions = {}
  ): Promise<AEMResponse<NamespaceResult>> {
    try {
      this.logger.debug('Creating tag namespace', { namespace, options });

      if (!namespace) {
        throw new AEMException(
          'Namespace is required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Validate namespace format
      if (!this.isValidNamespace(namespace)) {
        throw new AEMException(
          'Invalid namespace format. Use only lowercase letters, numbers, and hyphens',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('cmd', 'createTagByTitle');
      formData.append('tag', namespace);
      formData.append('locale', 'en');
      
      if (options.title) {
        formData.append('title', options.title);
      } else {
        formData.append('title', namespace);
      }
      
      if (options.description) {
        formData.append('description', options.description);
      }

      // Add custom properties
      if (options.properties) {
        for (const [key, value] of Object.entries(options.properties)) {
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach((item, index) => {
                formData.append(`${key}[${index}]`, item.toString());
              });
            } else {
              formData.append(key, value.toString());
            }
          }
        }
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'createTagNamespace',
          resource: namespace
        }
      };

      const response = await this.client.post<any>(
        '/bin/tagcommand',
        formData as any,
        requestOptions
      );

      if (!response.success) {
        throw new AEMException(
          `Failed to create tag namespace: ${namespace}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const namespacePath = `/etc/tags/${namespace}`;
      const result: NamespaceResult = {
        success: true,
        namespace,
        namespacePath,
        tagId: namespace,
        tagPath: namespacePath,
        message: `Tag namespace ${namespace} created successfully`
      };

      this.logger.debug('Successfully created tag namespace', { namespace, namespacePath });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to create tag namespace', error as Error, { namespace });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while creating tag namespace: ${namespace}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, namespace }
      );
    }
  }

  /**
   * Create tag with parent tag support
   */
  async createTag(
    tagId: string,
    options: CreateTagOptions = {}
  ): Promise<AEMResponse<TagResult>> {
    try {
      this.logger.debug('Creating tag', { tagId, options });

      if (!tagId) {
        throw new AEMException(
          'Tag ID is required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Validate tag ID format
      if (!this.isValidTagId(tagId)) {
        throw new AEMException(
          'Invalid tag ID format. Use namespace:tagname format',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('cmd', 'createTagByTitle');
      formData.append('tag', tagId);
      formData.append('locale', 'en');
      
      if (options.title) {
        formData.append('title', options.title);
      } else {
        // Extract tag name from tagId for default title
        const tagName = tagId.split(':').pop() || tagId;
        formData.append('title', tagName);
      }
      
      if (options.description) {
        formData.append('description', options.description);
      }

      if (options.parentTagId) {
        formData.append('parentTagID', options.parentTagId);
      }

      // Add custom properties
      if (options.properties) {
        for (const [key, value] of Object.entries(options.properties)) {
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach((item, index) => {
                formData.append(`${key}[${index}]`, item.toString());
              });
            } else {
              formData.append(key, value.toString());
            }
          }
        }
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'createTag',
          resource: tagId
        }
      };

      const response = await this.client.post<any>(
        '/bin/tagcommand',
        formData as any,
        requestOptions
      );

      if (!response.success) {
        throw new AEMException(
          `Failed to create tag: ${tagId}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const tagPath = this.buildTagPath(tagId);
      const result: TagResult = {
        success: true,
        tagId,
        tagPath,
        title: options.title,
        description: options.description,
        parentTagId: options.parentTagId,
        message: `Tag ${tagId} created successfully`
      };

      this.logger.debug('Successfully created tag', { tagId, tagPath });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to create tag', error as Error, { tagId });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while creating tag: ${tagId}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, tagId }
      );
    }
  }

  /**
   * Move tag for tag reorganization
   */
  async moveTag(
    tagId: string,
    options: MoveTagOptions = {}
  ): Promise<AEMResponse<MoveResult>> {
    try {
      this.logger.debug('Moving tag', { tagId, options });

      if (!tagId) {
        throw new AEMException(
          'Tag ID is required',
          'VALIDATION_ERROR',
          false
        );
      }

      if (!options.newParentTagId && !options.newName) {
        throw new AEMException(
          'Either new parent tag ID or new name must be provided',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('cmd', 'moveTag');
      formData.append('tag', tagId);
      
      if (options.newParentTagId) {
        formData.append('parentTagID', options.newParentTagId);
      }
      
      if (options.newName) {
        formData.append('name', options.newName);
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'moveTag',
          resource: tagId
        }
      };

      const response = await this.client.post<any>(
        '/bin/tagcommand',
        formData as any,
        requestOptions
      );

      if (!response.success) {
        throw new AEMException(
          `Failed to move tag: ${tagId}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const oldPath = this.buildTagPath(tagId);
      const newTagId = this.buildNewTagId(tagId, options);
      const newPath = this.buildTagPath(newTagId);

      const result: MoveResult = {
        success: true,
        tagId,
        tagPath: newPath,
        oldPath,
        newPath,
        newTagId,
        message: `Tag moved from ${tagId} to ${newTagId} successfully`
      };

      this.logger.debug('Successfully moved tag', { 
        oldTagId: tagId, 
        newTagId, 
        oldPath, 
        newPath 
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

    } catch (error) {
      this.logger.error('Failed to move tag', error as Error, { tagId });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while moving tag: ${tagId}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, tagId }
      );
    }
  }

  /**
   * Edit tag for property and translation updates
   */
  async editTag(
    tagId: string,
    options: EditTagOptions = {}
  ): Promise<AEMResponse<TagResult>> {
    try {
      this.logger.debug('Editing tag', { tagId, options });

      if (!tagId) {
        throw new AEMException(
          'Tag ID is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('cmd', 'editTag');
      formData.append('tag', tagId);
      formData.append('locale', 'en');
      
      if (options.title) {
        formData.append('title', options.title);
      }
      
      if (options.description) {
        formData.append('description', options.description);
      }

      // Add translations
      if (options.translations) {
        for (const [locale, translation] of Object.entries(options.translations)) {
          if (translation.title) {
            formData.append(`title_${locale}`, translation.title);
          }
          if (translation.description) {
            formData.append(`description_${locale}`, translation.description);
          }
        }
      }

      // Add custom properties
      if (options.properties) {
        for (const [key, value] of Object.entries(options.properties)) {
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach((item, index) => {
                formData.append(`${key}[${index}]`, item.toString());
              });
            } else {
              formData.append(key, value.toString());
            }
          }
        }
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'editTag',
          resource: tagId
        }
      };

      const response = await this.client.post<any>(
        '/bin/tagcommand',
        formData as any,
        requestOptions
      );

      if (!response.success) {
        throw new AEMException(
          `Failed to edit tag: ${tagId}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const tagPath = this.buildTagPath(tagId);
      const result: TagResult = {
        success: true,
        tagId,
        tagPath,
        title: options.title,
        description: options.description,
        message: `Tag ${tagId} edited successfully`
      };

      this.logger.debug('Successfully edited tag', { tagId, tagPath });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to edit tag', error as Error, { tagId });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while editing tag: ${tagId}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, tagId }
      );
    }
  }

  /**
   * Delete tag with safety checks
   */
  async deleteTag(
    tagId: string,
    options: DeleteTagOptions = {}
  ): Promise<AEMResponse<TagOperationResult>> {
    try {
      this.logger.debug('Deleting tag', { tagId, options });

      if (!tagId) {
        throw new AEMException(
          'Tag ID is required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Safety check: prevent deletion of system tags
      if (this.isSystemTag(tagId)) {
        throw new AEMException(
          `Cannot delete system tag: ${tagId}`,
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append('cmd', 'deleteTag');
      formData.append('tag', tagId);
      
      if (options.force !== undefined) {
        formData.append('force', options.force.toString());
      }
      
      if (options.recursive !== undefined) {
        formData.append('recursive', options.recursive.toString());
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'deleteTag',
          resource: tagId
        }
      };

      const response = await this.client.post<any>(
        '/bin/tagcommand',
        formData as any,
        requestOptions
      );

      if (!response.success) {
        throw new AEMException(
          `Failed to delete tag: ${tagId}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result: TagOperationResult = {
        success: true,
        tagId,
        message: `Tag ${tagId} deleted successfully`
      };

      this.logger.debug('Successfully deleted tag', { tagId });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to delete tag', error as Error, { tagId });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while deleting tag: ${tagId}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, tagId }
      );
    }
  }

  /**
   * Validate namespace format
   */
  private isValidNamespace(namespace: string): boolean {
    // Namespace should be lowercase letters, numbers, and hyphens only
    const namespaceRegex = /^[a-z0-9-]+$/;
    return namespaceRegex.test(namespace) && 
           namespace.length > 0 && 
           namespace.length <= 50 &&
           !namespace.startsWith('-') &&
           !namespace.endsWith('-');
  }

  /**
   * Validate tag ID format
   */
  private isValidTagId(tagId: string): boolean {
    // Tag ID should be in format namespace:tagname or namespace:parent/child
    const tagIdRegex = /^[a-z0-9-]+:[a-z0-9-\/]+$/i;
    return tagIdRegex.test(tagId) && 
           tagId.includes(':') &&
           tagId.length > 0 && 
           tagId.length <= 200;
  }

  /**
   * Build tag path from tag ID
   */
  private buildTagPath(tagId: string): string {
    const parts = tagId.split(':');
    if (parts.length !== 2) {
      return `/etc/tags/${tagId}`;
    }
    
    const [namespace, tagPath] = parts;
    return `/etc/tags/${namespace}/${tagPath}`;
  }

  /**
   * Build new tag ID after move operation
   */
  private buildNewTagId(originalTagId: string, options: MoveTagOptions): string {
    const parts = originalTagId.split(':');
    if (parts.length !== 2) {
      return originalTagId;
    }
    
    const [namespace, tagPath] = parts;
    
    if (options.newName) {
      // If new name is provided, replace the tag name part
      const pathParts = tagPath.split('/');
      pathParts[pathParts.length - 1] = options.newName;
      return `${namespace}:${pathParts.join('/')}`;
    }
    
    if (options.newParentTagId) {
      // If new parent is provided, construct new path
      const tagName = tagPath.split('/').pop();
      const newParentParts = options.newParentTagId.split(':');
      if (newParentParts.length === 2) {
        const [newNamespace, newParentPath] = newParentParts;
        return `${newNamespace}:${newParentPath}/${tagName}`;
      }
    }
    
    return originalTagId;
  }

  /**
   * Check if tag is a system tag that should not be deleted
   */
  private isSystemTag(tagId: string): boolean {
    const systemTags = [
      'workflow:',
      'dam:',
      'wcm:',
      'granite:',
      'cq:',
      'sling:'
    ];

    return systemTags.some(systemTag => tagId.startsWith(systemTag)) ||
           tagId === 'default' ||
           tagId.split(':').length < 2; // Prevent deletion of namespace roots
  }
}
