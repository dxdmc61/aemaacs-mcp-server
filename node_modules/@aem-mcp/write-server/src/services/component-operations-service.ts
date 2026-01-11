/**
 * Component Operations Service for AEMaaCS write operations
 * Handles component creation, updating, deletion, bulk updates, validation, and image path updates
 */

import { AEMHttpClient, RequestOptions } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

export interface CreateComponentOptions {
  resourceType: string;
  name?: string;
  properties?: Record<string, any>;
  insertBefore?: string;
  insertAfter?: string;
}

export interface UpdateComponentOptions {
  merge?: boolean;
  replaceProperties?: boolean;
  validateBeforeUpdate?: boolean;
}

export interface DeleteComponentOptions {
  force?: boolean;
  checkReferences?: boolean;
}

export interface BulkUpdateOptions {
  batchSize?: number;
  continueOnError?: boolean;
  rollbackOnFailure?: boolean;
  validateBeforeUpdate?: boolean;
}

export interface ComponentUpdate {
  componentPath: string;
  properties: Record<string, any>;
  options?: UpdateComponentOptions;
}

export interface ValidationOptions {
  strict?: boolean;
  checkResourceType?: boolean;
  validateProperties?: boolean;
}

export interface ComponentOperationResult {
  success: boolean;
  path?: string;
  message?: string;
  warnings?: string[];
  errors?: string[];
}

export interface BulkUpdateResult {
  totalComponents: number;
  successfulUpdates: number;
  failedUpdates: number;
  results: Array<{
    componentPath: string;
    success: boolean;
    error?: string;
  }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

export class ComponentOperationsService {
  private client: AEMHttpClient;
  private logger: Logger;

  constructor(client: AEMHttpClient) {
    this.client = client;
    this.logger = Logger.getInstance();
  }

  /**
   * Create component for component creation
   */
  async createComponent(pagePath: string, containerPath: string, options: CreateComponentOptions): Promise<AEMResponse<ComponentOperationResult>> {
    try {
      this.logger.debug('Creating component', { pagePath, containerPath, options });

      if (!pagePath || !containerPath || !options.resourceType) {
        throw new AEMException(
          'Page path, container path, and resource type are required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Generate component name if not provided
      const componentName = options.name || this.generateComponentName(options.resourceType);
      const componentPath = `${pagePath}/jcr:content/${containerPath}/${componentName}`;

      const formData = new FormData();
      formData.append('sling:resourceType', options.resourceType);
      formData.append('jcr:primaryType', 'nt:unstructured');

      // Add component properties
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

      // Handle component ordering
      if (options.insertBefore) {
        formData.append(':order', `before ${options.insertBefore}`);
      } else if (options.insertAfter) {
        formData.append(':order', `after ${options.insertAfter}`);
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'createComponent',
          resource: componentPath
        }
      };

      const response = await this.client.post<any>(
        componentPath,
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          'Failed to create component',
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseComponentOperationResponse(response.data, componentPath);

      this.logger.debug('Successfully created component', { 
        componentPath,
        resourceType: options.resourceType
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
      this.logger.error('Failed to create component', error as Error, { pagePath, containerPath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while creating component',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, pagePath, containerPath }
      );
    }
  }

  /**
   * Update component with validation
   */
  async updateComponent(componentPath: string, properties: Record<string, any>, options: UpdateComponentOptions = {}): Promise<AEMResponse<ComponentOperationResult>> {
    try {
      this.logger.debug('Updating component', { componentPath, properties, options });

      if (!componentPath || !properties || Object.keys(properties).length === 0) {
        throw new AEMException(
          'Component path and properties are required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Validate component before update if requested
      if (options.validateBeforeUpdate) {
        const validation = await this.validateComponent(componentPath, properties);
        if (!validation.valid) {
          throw new AEMException(
            `Component validation failed: ${validation.errors.join(', ')}`,
            'VALIDATION_ERROR',
            false,
            undefined,
            { validationErrors: validation.errors }
          );
        }
      }

      const formData = new FormData();
      
      // Add properties to form data
      for (const [key, value] of Object.entries(properties)) {
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

      // Add update options
      if (options.merge !== undefined) {
        formData.append(':merge', options.merge.toString());
      }
      if (options.replaceProperties !== undefined) {
        formData.append(':replace', options.replaceProperties.toString());
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'updateComponent',
          resource: componentPath
        }
      };

      const response = await this.client.post<any>(
        componentPath,
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to update component: ${componentPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseComponentOperationResponse(response.data, componentPath);

      this.logger.debug('Successfully updated component', { 
        componentPath,
        propertyCount: Object.keys(properties).length
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
      this.logger.error('Failed to update component', error as Error, { componentPath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while updating component: ${componentPath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, componentPath }
      );
    }
  }

  /**
   * Delete component with safety checks
   */
  async deleteComponent(componentPath: string, options: DeleteComponentOptions = {}): Promise<AEMResponse<ComponentOperationResult>> {
    try {
      this.logger.debug('Deleting component', { componentPath, options });

      if (!componentPath) {
        throw new AEMException(
          'Component path is required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Safety check: prevent deletion of critical components
      if (this.isCriticalComponent(componentPath)) {
        throw new AEMException(
          `Cannot delete critical component: ${componentPath}`,
          'VALIDATION_ERROR',
          false
        );
      }

      const formData = new FormData();
      formData.append(':operation', 'delete');

      if (options.force !== undefined) {
        formData.append('force', options.force.toString());
      }
      if (options.checkReferences !== undefined) {
        formData.append('checkReferences', options.checkReferences.toString());
      }

      const requestOptions: RequestOptions = {
        context: {
          operation: 'deleteComponent',
          resource: componentPath
        }
      };

      const response = await this.client.post<any>(
        componentPath,
        formData as any,
        requestOptions
      );

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to delete component: ${componentPath}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const result = this.parseComponentOperationResponse(response.data, componentPath);

      this.logger.debug('Successfully deleted component', { 
        componentPath,
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
      this.logger.error('Failed to delete component', error as Error, { componentPath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while deleting component: ${componentPath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, componentPath }
      );
    }
  }

  /**
   * Bulk update components with rollback support
   */
  async bulkUpdateComponents(updates: ComponentUpdate[], options: BulkUpdateOptions = {}): Promise<AEMResponse<BulkUpdateResult>> {
    try {
      this.logger.debug('Bulk updating components', { updateCount: updates.length, options });

      if (!updates || updates.length === 0) {
        throw new AEMException(
          'At least one component update is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const batchSize = options.batchSize || 10;
      const results: BulkUpdateResult['results'] = [];
      let successfulUpdates = 0;
      let failedUpdates = 0;
      const rollbackOperations: Array<() => Promise<void>> = [];

      // Process updates in batches
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (update) => {
          try {
            // Store original state for rollback if needed
            if (options.rollbackOnFailure) {
              const originalState = await this.getComponentState(update.componentPath);
              rollbackOperations.push(() => this.restoreComponentState(update.componentPath, originalState));
            }

            const result = await this.updateComponent(update.componentPath, update.properties, update.options);
            
            successfulUpdates++;
            return {
              componentPath: update.componentPath,
              success: true
            };
          } catch (error) {
            failedUpdates++;
            
            // If not continuing on error and rollback is enabled, perform rollback
            if (!options.continueOnError && options.rollbackOnFailure) {
              this.logger.info('Performing rollback due to failed update', { componentPath: update.componentPath });
              await this.performRollback(rollbackOperations);
              throw error;
            }
            
            return {
              componentPath: update.componentPath,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // If any batch failed and we're not continuing on error, stop processing
        if (!options.continueOnError && batchResults.some(r => !r.success)) {
          break;
        }
      }

      const bulkResult: BulkUpdateResult = {
        totalComponents: updates.length,
        successfulUpdates,
        failedUpdates,
        results
      };

      this.logger.debug('Successfully completed bulk component update', { 
        totalComponents: updates.length,
        successfulUpdates,
        failedUpdates
      });

      return {
        success: true,
        data: bulkResult,
        metadata: {
          timestamp: new Date(),
          requestId: '',
          duration: 0
        }
      };

    } catch (error) {
      this.logger.error('Failed to bulk update components', error as Error);
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while bulk updating components',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error }
      );
    }
  }

  /**
   * Validate component for pre-validation
   */
  async validateComponent(componentPath: string, properties: Record<string, any>, options: ValidationOptions = {}): Promise<ValidationResult> {
    try {
      this.logger.debug('Validating component', { componentPath, options });

      const errors: string[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];

      // Basic path validation
      if (!componentPath || !componentPath.includes('/jcr:content/')) {
        errors.push('Invalid component path format');
      }

      // Resource type validation
      if (options.checkResourceType && properties['sling:resourceType']) {
        const resourceType = properties['sling:resourceType'];
        if (!this.isValidResourceType(resourceType)) {
          errors.push(`Invalid resource type: ${resourceType}`);
        }
      }

      // Property validation
      if (options.validateProperties) {
        for (const [key, value] of Object.entries(properties)) {
          // Check for reserved property names
          if (this.isReservedProperty(key)) {
            warnings.push(`Using reserved property name: ${key}`);
          }

          // Check for potentially problematic values
          if (typeof value === 'string' && value.includes('<script>')) {
            errors.push(`Potentially unsafe content in property: ${key}`);
          }

          // Check for empty required properties
          if (this.isRequiredProperty(key) && (!value || value === '')) {
            errors.push(`Required property is empty: ${key}`);
          }
        }
      }

      // Strict validation
      if (options.strict) {
        // Additional strict validation rules
        if (!properties['jcr:primaryType']) {
          warnings.push('Missing jcr:primaryType property');
          suggestions.push('Consider adding jcr:primaryType=nt:unstructured');
        }
      }

      const result: ValidationResult = {
        valid: errors.length === 0,
        errors,
        warnings,
        suggestions: suggestions.length > 0 ? suggestions : undefined
      };

      this.logger.debug('Component validation completed', { 
        componentPath,
        valid: result.valid,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to validate component', error as Error, { componentPath });
      
      return {
        valid: false,
        errors: ['Validation failed due to unexpected error'],
        warnings: []
      };
    }
  }

  /**
   * Update image path for image reference updates
   */
  async updateImagePath(componentPath: string, newImagePath: string, imageProperty: string = 'fileReference'): Promise<AEMResponse<ComponentOperationResult>> {
    try {
      this.logger.debug('Updating image path', { componentPath, newImagePath, imageProperty });

      if (!componentPath || !newImagePath) {
        throw new AEMException(
          'Component path and new image path are required',
          'VALIDATION_ERROR',
          false
        );
      }

      // Validate that the new image path exists and is an asset
      if (!newImagePath.startsWith('/content/dam/')) {
        throw new AEMException(
          'Image path must be a DAM asset path starting with /content/dam/',
          'VALIDATION_ERROR',
          false
        );
      }

      const properties = {
        [imageProperty]: newImagePath
      };

      // Also update alt text property if it exists
      const altTextProperty = imageProperty.replace('fileReference', 'alt');
      if (altTextProperty !== imageProperty) {
        // Extract filename for default alt text
        const filename = newImagePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || '';
        properties[altTextProperty] = filename.replace(/[-_]/g, ' ');
      }

      return await this.updateComponent(componentPath, properties, {
        validateBeforeUpdate: true
      });

    } catch (error) {
      this.logger.error('Failed to update image path', error as Error, { componentPath, newImagePath });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while updating image path: ${componentPath}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, componentPath, newImagePath }
      );
    }
  }

  /**
   * Parse component operation response
   */
  private parseComponentOperationResponse(data: any, path: string): ComponentOperationResult {
    return {
      success: Boolean(data.success !== false),
      path: data.path || path,
      message: data.message || data.msg,
      warnings: Array.isArray(data.warnings) ? data.warnings : (data.warning ? [data.warning] : []),
      errors: Array.isArray(data.errors) ? data.errors : (data.error ? [data.error] : [])
    };
  }

  /**
   * Generate component name from resource type
   */
  private generateComponentName(resourceType: string): string {
    const parts = resourceType.split('/');
    const componentType = parts[parts.length - 1];
    const timestamp = Date.now();
    return `${componentType}_${timestamp}`;
  }

  /**
   * Check if component is critical and should not be deleted
   */
  private isCriticalComponent(componentPath: string): boolean {
    const criticalComponents = [
      '/jcr:content/root',
      '/jcr:content/header',
      '/jcr:content/footer',
      '/jcr:content/navigation'
    ];

    return criticalComponents.some(critical => componentPath.includes(critical));
  }

  /**
   * Validate resource type format
   */
  private isValidResourceType(resourceType: string): boolean {
    // Basic resource type validation
    return resourceType.includes('/') && 
           !resourceType.startsWith('/') && 
           !resourceType.endsWith('/') &&
           resourceType.length > 0;
  }

  /**
   * Check if property name is reserved
   */
  private isReservedProperty(propertyName: string): boolean {
    const reservedProperties = [
      'jcr:primaryType',
      'jcr:mixinTypes',
      'jcr:created',
      'jcr:createdBy',
      'jcr:lastModified',
      'jcr:lastModifiedBy',
      'sling:resourceType',
      'sling:resourceSuperType'
    ];

    return reservedProperties.includes(propertyName);
  }

  /**
   * Check if property is required
   */
  private isRequiredProperty(propertyName: string): boolean {
    const requiredProperties = [
      'sling:resourceType'
    ];

    return requiredProperties.includes(propertyName);
  }

  /**
   * Get component state for rollback
   */
  private async getComponentState(componentPath: string): Promise<Record<string, any>> {
    try {
      const response = await this.client.get<any>(`${componentPath}.json`);
      return response.success ? response.data : {};
    } catch (error) {
      this.logger.warn('Could not get component state for rollback', { componentPath, error: (error as Error).message });
      return {};
    }
  }

  /**
   * Restore component state for rollback
   */
  private async restoreComponentState(componentPath: string, originalState: Record<string, any>): Promise<void> {
    try {
      if (Object.keys(originalState).length > 0) {
        await this.updateComponent(componentPath, originalState, { replaceProperties: true });
      }
    } catch (error) {
      this.logger.error('Failed to restore component state during rollback', error as Error, { componentPath });
    }
  }

  /**
   * Perform rollback operations
   */
  private async performRollback(rollbackOperations: Array<() => Promise<void>>): Promise<void> {
    for (const rollbackOp of rollbackOperations.reverse()) {
      try {
        await rollbackOp();
      } catch (error) {
        this.logger.error('Rollback operation failed', error as Error);
      }
    }
  }
}
