/**
 * Content Fragment Operations Service for AEMaaCS write operations
 * Handles content fragment creation, updating, and deletion
 */

import { AEMHttpClient, RequestOptions } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

export interface CreateContentFragmentOptions {
  model: string;
  title: string;
  description?: string;
  elements?: Record<string, any>;
  tags?: string[];
  properties?: Record<string, any>;
}

export interface UpdateContentFragmentOptions {
  elements?: Record<string, any>;
  title?: string;
  description?: string;
  tags?: string[];
  properties?: Record<string, any>;
  merge?: boolean;
}

export interface DeleteContentFragmentOptions {
  force?: boolean;
  checkReferences?: boolean;
}

export interface ContentFragmentOperationResult {
  success: boolean;
  path?: string;
  message?: string;
  warnings?: string[];
  errors?: string[];
}

export interface ContentFragment {
  path: string;
  name: string;
  title?: string;
  description?: string;
  model: string;
  elements: Record<string, any>;
  tags?: string[];
  created?: Date;
  lastModified?: Date;
  createdBy?: string;
  lastModifiedBy?: string;
  properties: Record<string, any>;
}

export interface ContentFragmentModel {
  path: string;
  name: string;
  title?: string;
  description?: string;
  elements: ContentFragmentModelElement[];
  created?: Date;
  lastModified?: Date;
  createdBy?: string;
  lastModifiedBy?: string;
}

export interface ContentFragmentModelElement {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'multitext' | 'contentreference' | 'fragmentreference' | 'json';
  title?: string;
  description?: string;
  required?: boolean;
  validation?: Record<string, any>;
  defaultValue?: any;
}

export interface CreateContentFragmentModelOptions {
  title: string;
  description?: string;
  elements: ContentFragmentModelElement[];
  properties?: Record<string, any>;
}

export interface ContentFragmentVariation {
  name: string;
  title?: string;
  description?: string;
  elements: Record<string, any>;
  isMaster?: boolean;
  created?: Date;
  lastModified?: Date;
  createdBy?: string;
  lastModifiedBy?: string;
}

export interface CreateContentFragmentVariationOptions {
  title?: string;
  description?: string;
  elements?: Record<string, any>;
  isMaster?: boolean;
}

export interface ContentFragmentReference {
  type: 'contentreference' | 'fragmentreference' | 'assetreference';
  path: string;
  title?: string;
  description?: string;
}

export interface ContentFragmentReferenceResult {
  fragmentPath: string;
  references: ContentFragmentReference[];
  referencedBy: ContentFragmentReference[];
}

export class ContentFragmentOperationsService {
  private client: AEMHttpClient;
  private logger: Logger;

  constructor(client: AEMHttpClient) {
    this.client = client;
    this.logger = Logger.getInstance();
  }

  /**
   * Create content fragment using /api/assets/
   */
  async createContentFragment(parentPath: string, fragmentName: string, options: CreateContentFragmentOptions): Promise<AEMResponse<ContentFragmentOperationResult>> {
    try {
      this.logger.debug('Creating content fragment', { parentPath, fragmentName, options });

      if (!parentPath || !fragmentName || !options.model || !options.title) {
        throw new AEMException(
          'Parent path, fragment name, model, and title are required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Validate fragment name
      if (!this.isValidFragmentName(fragmentName)) {
        throw new AEMException(
          'Invalid fragment name. Fragment names must not contain special characters',
          'VALIDATION_ERROR',
          false
        );
      }

      // Validate parent path is in DAM
      if (!parentPath.startsWith('/content/dam/')) {
        throw new AEMException(
          'Content fragments must be created in DAM (/content/dam/)',
          'VALIDATION_ERROR',
          false
        );
      }

      const fragmentPath = `${parentPath}/${fragmentName}`;
      
      const payload = {
        'jcr:primaryType': 'dam:Asset',
        'jcr:content': {
          'jcr:primaryType': 'dam:AssetContent',
          'contentFragment': true,
          'cq:model': options.model,
          'jcr:title': options.title,
          'jcr:description': options.description || '',
          'cq:tags': options.tags || [],
          'data': {
            'jcr:primaryType': 'nt:unstructured',
            'cq:model': options.model,
            ...this.formatFragmentElements(options.elements || {})
          },
          ...options.properties
        }
      };

      const requestOptions: RequestOptions = {
        context: {
          operation: 'createContentFragment',
          resource: fragmentPath
        }
      };

      const response = await this.client.post<any>(
        `/api/assets${fragmentPath}`,
        payload,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          'Failed to create content fragment',
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseContentFragmentOperationResponse(response.data, fragmentPath);

      this.logger.debug('Successfully created content fragment', { 
        fragmentPath,
        model: options.model
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
      this.logger.error('Failed to create content fragment', error as Error, { parentPath, fragmentName });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while creating content fragment',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, parentPath, fragmentName }
      );
    }
  }

  /**
   * Update content fragment for element updates
   */
  async updateContentFragment(fragmentPath: string, options: UpdateContentFragmentOptions): Promise<AEMResponse<ContentFragmentOperationResult>> {
    try {
      this.logger.debug('Updating content fragment', { fragmentPath, options });

      if (!fragmentPath) {
        throw new AEMException(
          'Fragment path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Validate fragment path is in DAM
      if (!fragmentPath.startsWith('/content/dam/')) {
        throw new AEMException(
          'Content fragment path must be in DAM (/content/dam/)',
          'VALIDATION_ERROR',
          false
        );
      }

      const payload: any = {};

      // Update basic properties
      if (options.title !== undefined) {
        payload['jcr:title'] = options.title;
      }
      if (options.description !== undefined) {
        payload['jcr:description'] = options.description;
      }
      if (options.tags !== undefined) {
        payload['cq:tags'] = options.tags;
      }

      // Update elements
      if (options.elements) {
        payload.data = {
          ...this.formatFragmentElements(options.elements)
        };
      }

      // Add custom properties
      if (options.properties) {
        Object.assign(payload, options.properties);
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'updateContentFragment',
          resource: fragmentPath
        }
      };

      const response = await this.client.put<any>(
        `/api/assets${fragmentPath}/jcr:content`,
        payload,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to update content fragment: ${fragmentPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseContentFragmentOperationResponse(response.data, fragmentPath);

      this.logger.debug('Successfully updated content fragment', { 
        fragmentPath,
        elementCount: options.elements ? Object.keys(options.elements).length : 0
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
      this.logger.error('Failed to update content fragment', error as Error, { fragmentPath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while updating content fragment: ${fragmentPath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, fragmentPath }
      );
    }
  }

  /**
   * Delete content fragment with safety checks
   */
  async deleteContentFragment(fragmentPath: string, options: DeleteContentFragmentOptions = {}): Promise<AEMResponse<ContentFragmentOperationResult>> {
    try {
      this.logger.debug('Deleting content fragment', { fragmentPath, options });

      if (!fragmentPath) {
        throw new AEMException(
          'Fragment path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Validate fragment path is in DAM
      if (!fragmentPath.startsWith('/content/dam/')) {
        throw new AEMException(
          'Content fragment path must be in DAM (/content/dam/)',
          'VALIDATION_ERROR',
          false
        );
      }

      // Safety check: prevent deletion of important fragments
      if (this.isSystemFragment(fragmentPath)) {
        throw new AEMException(
          `Cannot delete system content fragment: ${fragmentPath}`,
          'VALIDATION_ERROR',
          false,
          undefined,
          { fragmentPath }
        );
      }

      const params: Record<string, any> = {};

      if (options.force !== undefined) {
        params.force = options.force.toString();
      }
      if (options.checkReferences !== undefined) {
        params.checkReferences = options.checkReferences.toString();
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'deleteContentFragment',
          resource: fragmentPath
        }
      };

      // Build URL with query params
      const queryString = new URLSearchParams(params as Record<string, string>).toString();
      const url = `/api/assets${fragmentPath}${queryString ? '?' + queryString : ''}`;
      
      const response = await this.client.delete<any>(url, requestOptions);

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to delete content fragment: ${fragmentPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseContentFragmentOperationResponse(response.data, fragmentPath);

      this.logger.debug('Successfully deleted content fragment', { 
        fragmentPath,
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

    } catch (error) {
      this.logger.error('Failed to delete content fragment', error as Error, { fragmentPath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while deleting content fragment: ${fragmentPath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, fragmentPath }
      );
    }
  }

  /**
   * Parse content fragment operation response
   */
  private parseContentFragmentOperationResponse(data: any, path: string): ContentFragmentOperationResult {
    return {
      success: Boolean(data.success !== false),
      path: data.path || path,
      message: data.message || data.msg,
      warnings: Array.isArray(data.warnings) ? data.warnings : (data.warning ? [data.warning] : []),
      errors: Array.isArray(data.errors) ? data.errors : (data.error ? [data.error] : [])
    };
  }

  /**
   * Format fragment elements for storage
   */
  private formatFragmentElements(elements: Record<string, any>): Record<string, any> {
    const formattedElements: Record<string, any> = {};

    for (const [key, value] of Object.entries(elements)) {
      if (value !== null && value !== undefined) {
        // Handle different element types
        if (typeof value === 'string') {
          formattedElements[key] = {
            'jcr:primaryType': 'nt:unstructured',
            'value': value,
            'dataType': 'string'
          };
        } else if (typeof value === 'number') {
          formattedElements[key] = {
            'jcr:primaryType': 'nt:unstructured',
            'value': value.toString(),
            'dataType': 'number'
          };
        } else if (typeof value === 'boolean') {
          formattedElements[key] = {
            'jcr:primaryType': 'nt:unstructured',
            'value': value.toString(),
            'dataType': 'boolean'
          };
        } else if (Array.isArray(value)) {
          formattedElements[key] = {
            'jcr:primaryType': 'nt:unstructured',
            'value': value,
            'dataType': 'array'
          };
        } else if (typeof value === 'object') {
          // Handle rich text or structured content
          formattedElements[key] = {
            'jcr:primaryType': 'nt:unstructured',
            'value': JSON.stringify(value),
            'dataType': 'json'
          };
        } else {
          formattedElements[key] = {
            'jcr:primaryType': 'nt:unstructured',
            'value': value.toString(),
            'dataType': 'string'
          };
        }
      }
    }

    return formattedElements;
  }

  /**
   * Validate fragment name
   */
  private isValidFragmentName(fragmentName: string): boolean {
    // Content fragment name restrictions
    const invalidChars = /[<>:"/\\|?*\[\]]/;
    const reservedNames = ['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'];
    
    return !invalidChars.test(fragmentName) && 
           !reservedNames.includes(fragmentName.toLowerCase()) &&
           fragmentName.length > 0 &&
           fragmentName.length <= 150 &&
           !fragmentName.startsWith('.') &&
           !fragmentName.endsWith('.');
  }

  /**
   * Check if fragment is a system fragment that should not be deleted
   */
  private isSystemFragment(fragmentPath: string): boolean {
    const systemFragmentPrefixes = [
      '/content/dam/system',
      '/content/dam/conf',
      '/content/dam/we-retail', // Example system fragments
      '/content/dam/wknd' // Example system fragments
    ];

    return systemFragmentPrefixes.some(prefix => fragmentPath.startsWith(prefix)) ||
           fragmentPath.split('/').length <= 4; // Protect root level fragments
  }

  // ============================================================================
  // CONTENT FRAGMENT MODEL OPERATIONS
  // ============================================================================

  /**
   * Create a new content fragment model
   */
  async createContentFragmentModel(parentPath: string, modelName: string, options: CreateContentFragmentModelOptions): Promise<AEMResponse<ContentFragmentOperationResult>> {
    try {
      this.logger.debug('Creating content fragment model', { parentPath, modelName, options });

      if (!parentPath || !modelName || !options.title || !options.elements) {
        throw new AEMException(
          'Parent path, model name, title, and elements are required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Validate model path is in conf
      if (!parentPath.startsWith('/conf/')) {
        throw new AEMException(
          'Content fragment models must be created in conf (/conf/)',
          'VALIDATION_ERROR',
          false
        );
      }

      const modelPath = `${parentPath}/${modelName}`;
      
      const payload = {
        'jcr:primaryType': 'nt:unstructured',
        'jcr:title': options.title,
        'jcr:description': options.description || '',
        'elements': {
          'jcr:primaryType': 'nt:unstructured',
          ...this.formatModelElements(options.elements)
        },
        ...options.properties
      };

      const requestOptions: RequestOptions = {
        context: {
          operation: 'createContentFragmentModel',
          resource: modelPath
        }
      };

      const response = await this.client.post<any>(
        modelPath,
        payload,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          'Failed to create content fragment model',
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseContentFragmentOperationResponse(response.data, modelPath);

      this.logger.debug('Successfully created content fragment model', { 
        modelPath,
        elementCount: options.elements.length
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
      this.logger.error('Failed to create content fragment model', error as Error, { parentPath, modelName });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while creating content fragment model',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, parentPath, modelName }
      );
    }
  }

  /**
   * Get content fragment model information
   */
  async getContentFragmentModel(modelPath: string): Promise<AEMResponse<ContentFragmentModel>> {
    try {
      this.logger.debug('Getting content fragment model', { modelPath });

      if (!modelPath) {
        throw new AEMException(
          'Model path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'getContentFragmentModel',
          resource: modelPath
        }
      };

      const response = await this.client.get<any>(
        `${modelPath}.json`,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to get content fragment model: ${modelPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const model = this.parseContentFragmentModel(response.data, modelPath);

      this.logger.debug('Successfully retrieved content fragment model', { modelPath });

      return {
        success: true,
        data: model,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to get content fragment model', error as Error, { modelPath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while getting content fragment model: ${modelPath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, modelPath }
      );
    }
  }

  /**
   * List all content fragment models
   */
  async listContentFragmentModels(confPath: string = '/conf'): Promise<AEMResponse<ContentFragmentModel[]>> {
    try {
      this.logger.debug('Listing content fragment models', { confPath });

      const requestOptions: RequestOptions = {
        context: {
          operation: 'listContentFragmentModels',
          resource: confPath
        }
      };

      // Use QueryBuilder to find all content fragment models
      const query: Record<string, string> = {
        'type': 'nt:unstructured',
        'path': confPath,
        'property': 'jcr:primaryType',
        'property.value': 'nt:unstructured',
        'p.limit': '-1'
      };

      const response = await this.client.get<any>(
        `/bin/querybuilder.json?${new URLSearchParams(query).toString()}`,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          'Failed to list content fragment models',
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const models: ContentFragmentModel[] = [];
      if (response.data.hits) {
        for (const hit of response.data.hits) {
          try {
            const model = await this.getContentFragmentModel(hit.path);
            if (model.success && model.data) {
              models.push(model.data);
            }
          } catch (error) {
            this.logger.warn('Failed to parse content fragment model', { path: hit.path, error: (error as Error).message });
          }
        }
      }

      this.logger.debug('Successfully listed content fragment models', { 
        confPath,
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

    } catch (error) {
      this.logger.error('Failed to list content fragment models', error as Error, { confPath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while listing content fragment models',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, confPath }
      );
    }
  }

  // ============================================================================
  // CONTENT FRAGMENT VARIATION OPERATIONS
  // ============================================================================

  /**
   * Create a new variation for a content fragment
   */
  async createContentFragmentVariation(fragmentPath: string, variationName: string, options: CreateContentFragmentVariationOptions): Promise<AEMResponse<ContentFragmentOperationResult>> {
    try {
      this.logger.debug('Creating content fragment variation', { fragmentPath, variationName, options });

      if (!fragmentPath || !variationName) {
        throw new AEMException(
          'Fragment path and variation name are required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Validate fragment path is in DAM
      if (!fragmentPath.startsWith('/content/dam/')) {
        throw new AEMException(
          'Content fragment path must be in DAM (/content/dam/)',
          'VALIDATION_ERROR',
          false
        );
      }

      const variationPath = `${fragmentPath}/jcr:content/variations/${variationName}`;
      
      const payload = {
        'jcr:primaryType': 'nt:unstructured',
        'title': options.title || variationName,
        'description': options.description || '',
        'isMaster': options.isMaster || false,
        'data': {
          'jcr:primaryType': 'nt:unstructured',
          ...this.formatFragmentElements(options.elements || {})
        }
      };

      const requestOptions: RequestOptions = {
        context: {
          operation: 'createContentFragmentVariation',
          resource: variationPath
        }
      };

      const response = await this.client.post<any>(
        variationPath,
        payload,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          'Failed to create content fragment variation',
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseContentFragmentOperationResponse(response.data, variationPath);

      this.logger.debug('Successfully created content fragment variation', { 
        variationPath,
        isMaster: options.isMaster
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
      this.logger.error('Failed to create content fragment variation', error as Error, { fragmentPath, variationName });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while creating content fragment variation',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, fragmentPath, variationName }
      );
    }
  }

  /**
   * Update a content fragment variation
   */
  async updateContentFragmentVariation(fragmentPath: string, variationName: string, options: CreateContentFragmentVariationOptions): Promise<AEMResponse<ContentFragmentOperationResult>> {
    try {
      this.logger.debug('Updating content fragment variation', { fragmentPath, variationName, options });

      if (!fragmentPath || !variationName) {
        throw new AEMException(
          'Fragment path and variation name are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const variationPath = `${fragmentPath}/jcr:content/variations/${variationName}`;
      
      const payload: any = {};

      if (options.title !== undefined) {
        payload.title = options.title;
      }
      if (options.description !== undefined) {
        payload.description = options.description;
      }
      if (options.isMaster !== undefined) {
        payload.isMaster = options.isMaster;
      }
      if (options.elements) {
        payload.data = {
          ...this.formatFragmentElements(options.elements)
        };
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'updateContentFragmentVariation',
          resource: variationPath
        }
      };

      const response = await this.client.put<any>(
        variationPath,
        payload,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to update content fragment variation: ${variationPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseContentFragmentOperationResponse(response.data, variationPath);

      this.logger.debug('Successfully updated content fragment variation', { variationPath });

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
      this.logger.error('Failed to update content fragment variation', error as Error, { fragmentPath, variationName });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while updating content fragment variation: ${variationName}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, fragmentPath, variationName }
      );
    }
  }

  /**
   * Delete a content fragment variation
   */
  async deleteContentFragmentVariation(fragmentPath: string, variationName: string): Promise<AEMResponse<ContentFragmentOperationResult>> {
    try {
      this.logger.debug('Deleting content fragment variation', { fragmentPath, variationName });

      if (!fragmentPath || !variationName) {
        throw new AEMException(
          'Fragment path and variation name are required',
          'VALIDATION_ERROR',
          false
        );
      }

      const variationPath = `${fragmentPath}/jcr:content/variations/${variationName}`;

      const requestOptions: RequestOptions = {
        context: {
          operation: 'deleteContentFragmentVariation',
          resource: variationPath
        }
      };

      const response = await this.client.delete<any>(variationPath, requestOptions);

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to delete content fragment variation: ${variationPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseContentFragmentOperationResponse(response.data, variationPath);

      this.logger.debug('Successfully deleted content fragment variation', { variationPath });

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
      this.logger.error('Failed to delete content fragment variation', error as Error, { fragmentPath, variationName });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while deleting content fragment variation: ${variationName}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, fragmentPath, variationName }
      );
    }
  }

  /**
   * List all variations for a content fragment
   */
  async listContentFragmentVariations(fragmentPath: string): Promise<AEMResponse<ContentFragmentVariation[]>> {
    try {
      this.logger.debug('Listing content fragment variations', { fragmentPath });

      if (!fragmentPath) {
        throw new AEMException(
          'Fragment path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const variationsPath = `${fragmentPath}/jcr:content/variations.json`;

      const requestOptions: RequestOptions = {
        context: {
          operation: 'listContentFragmentVariations',
          resource: fragmentPath
        }
      };

      const response = await this.client.get<any>(
        variationsPath,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to list content fragment variations: ${fragmentPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const variations: ContentFragmentVariation[] = [];
      
      if (response.data) {
        for (const [name, data] of Object.entries(response.data)) {
          if (typeof data === 'object' && data !== null) {
            const variationData = data as any;
            variations.push({
              name,
              title: variationData.title,
              description: variationData.description,
              elements: variationData.data || {},
              isMaster: variationData.isMaster || false,
              created: variationData['jcr:created'] ? new Date(variationData['jcr:created']) : undefined,
              lastModified: variationData['jcr:lastModified'] ? new Date(variationData['jcr:lastModified']) : undefined,
              createdBy: variationData['jcr:createdBy'],
              lastModifiedBy: variationData['jcr:lastModifiedBy']
            });
          }
        }
      }

      this.logger.debug('Successfully listed content fragment variations', { 
        fragmentPath,
        variationCount: variations.length
      });

      return {
        success: true,
        data: variations,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to list content fragment variations', error as Error, { fragmentPath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while listing content fragment variations: ${fragmentPath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, fragmentPath }
      );
    }
  }

  // ============================================================================
  // CONTENT FRAGMENT REFERENCE OPERATIONS
  // ============================================================================

  /**
   * Get references for a content fragment
   */
  async getContentFragmentReferences(fragmentPath: string): Promise<AEMResponse<ContentFragmentReferenceResult>> {
    try {
      this.logger.debug('Getting content fragment references', { fragmentPath });

      if (!fragmentPath) {
        throw new AEMException(
          'Fragment path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const references: ContentFragmentReference[] = [];
      const referencedBy: ContentFragmentReference[] = [];

      // Get outgoing references (what this fragment references)
      const outgoingQuery: Record<string, string> = {
        'type': 'nt:unstructured',
        'path': fragmentPath,
        'property': 'value',
        'property.value': '*',
        'p.limit': '-1'
      };

      const outgoingResponse = await this.client.get<any>(
        `/bin/querybuilder.json?${new URLSearchParams(outgoingQuery).toString()}`,
        {
          context: {
            operation: 'getContentFragmentReferences',
            resource: fragmentPath
          }
        }
      );

      if (outgoingResponse.success && outgoingResponse.data?.hits) {
        for (const hit of outgoingResponse.data.hits) {
          const referencePath = hit.value;
          if (this.isValidReference(referencePath)) {
            references.push({
              type: this.getReferenceType(referencePath),
              path: referencePath,
              title: hit.title || hit.name
            });
          }
        }
      }

      // Get incoming references (what references this fragment)
      const incomingQuery: Record<string, string> = {
        'type': 'nt:unstructured',
        'path': '/content',
        'property': 'value',
        'property.value': fragmentPath,
        'p.limit': '-1'
      };

      const incomingResponse = await this.client.get<any>(
        `/bin/querybuilder.json?${new URLSearchParams(incomingQuery).toString()}`,
        {
          context: {
            operation: 'getContentFragmentReferences',
            resource: fragmentPath
          }
        }
      );

      if (incomingResponse.success && incomingResponse.data?.hits) {
        for (const hit of incomingResponse.data.hits) {
          const referencingPath = hit.path.replace(/\/[^\/]*$/, ''); // Remove the property name
          if (this.isValidReference(referencingPath)) {
            referencedBy.push({
              type: this.getReferenceType(referencingPath),
              path: referencingPath,
              title: hit.title || hit.name
            });
          }
        }
      }

      const result: ContentFragmentReferenceResult = {
        fragmentPath,
        references,
        referencedBy
      };

      this.logger.debug('Successfully retrieved content fragment references', { 
        fragmentPath,
        referencesCount: references.length,
        referencedByCount: referencedBy.length
      });

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: outgoingResponse.metadata?.requestId || '',
          duration: (outgoingResponse.metadata?.duration || 0) + (incomingResponse.metadata?.duration || 0)
        }
      };

    } catch (error) {
      this.logger.error('Failed to get content fragment references', error as Error, { fragmentPath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while getting content fragment references: ${fragmentPath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, fragmentPath }
      );
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Format model elements for storage
   */
  private formatModelElements(elements: ContentFragmentModelElement[]): Record<string, any> {
    const formattedElements: Record<string, any> = {};

    for (const element of elements) {
      formattedElements[element.name] = {
        'jcr:primaryType': 'nt:unstructured',
        'title': element.title || element.name,
        'description': element.description || '',
        'type': element.type,
        'required': element.required || false,
        'validation': element.validation || {},
        'defaultValue': element.defaultValue || ''
      };
    }

    return formattedElements;
  }

  /**
   * Parse content fragment model from response
   */
  private parseContentFragmentModel(data: any, path: string): ContentFragmentModel {
    const elements: ContentFragmentModelElement[] = [];

    if (data.elements) {
      for (const [name, elementData] of Object.entries(data.elements)) {
        if (typeof elementData === 'object' && elementData !== null) {
          const element = elementData as any;
          elements.push({
            name,
            type: element.type || 'text',
            title: element.title,
            description: element.description,
            required: element.required || false,
            validation: element.validation || {},
            defaultValue: element.defaultValue
          });
        }
      }
    }

    return {
      path,
      name: path.split('/').pop() || '',
      title: data['jcr:title'],
      description: data['jcr:description'],
      elements,
      created: data['jcr:created'] ? new Date(data['jcr:created']) : undefined,
      lastModified: data['jcr:lastModified'] ? new Date(data['jcr:lastModified']) : undefined,
      createdBy: data['jcr:createdBy'],
      lastModifiedBy: data['jcr:lastModifiedBy']
    };
  }

  /**
   * Check if a path is a valid reference
   */
  private isValidReference(path: string): boolean {
    return path && (
      path.startsWith('/content/') ||
      path.startsWith('/content/dam/') ||
      path.startsWith('/conf/')
    );
  }

  /**
   * Get reference type based on path
   */
  private getReferenceType(path: string): 'contentreference' | 'fragmentreference' | 'assetreference' {
    if (path.startsWith('/content/dam/')) {
      return 'assetreference';
    } else if (path.startsWith('/conf/')) {
      return 'fragmentreference';
    } else {
      return 'contentreference';
    }
  }
}
