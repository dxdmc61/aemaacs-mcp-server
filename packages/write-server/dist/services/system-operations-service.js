/**
 * System Operations Service for AEMaaCS write operations
 * Handles ACL configuration, async job management, and JCR property manipulation
 */
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';
export class SystemOperationsService {
    constructor(client) {
        this.client = client;
        this.logger = Logger.getInstance();
    }
    /**
     * Apply ACL configuration for permission management
     */
    async applyACLConfig(config) {
        try {
            this.logger.debug('Applying ACL configuration', { config });
            if (!config.path || !config.entries || config.entries.length === 0) {
                throw new AEMException('Path and ACL entries are required', 'VALIDATION_ERROR', false);
            }
            // Validate path
            if (!this.isValidJCRPath(config.path)) {
                throw new AEMException('Invalid JCR path format', 'VALIDATION_ERROR', false);
            }
            let appliedEntries = 0;
            const skippedEntries = 0;
            let failedEntries = 0;
            const errors = [];
            const warnings = [];
            // Clear existing ACL if replaceExisting is true
            if (config.replaceExisting) {
                try {
                    await this.clearACL(config.path);
                }
                catch (error) {
                    warnings.push(`Failed to clear existing ACL: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            // Apply each ACL entry
            for (const entry of config.entries) {
                try {
                    await this.applyACLEntry(config.path, entry, config.merge);
                    appliedEntries++;
                }
                catch (error) {
                    failedEntries++;
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Failed to apply ACL for principal ${entry.principal}: ${errorMessage}`);
                    this.logger.warn('Failed to apply ACL entry', {
                        path: config.path,
                        principal: entry.principal,
                        error: error.message
                    });
                }
            }
            const result = {
                success: failedEntries === 0,
                path: config.path,
                appliedEntries,
                skippedEntries,
                failedEntries,
                message: `ACL configuration applied to ${config.path}. Applied: ${appliedEntries}, Failed: ${failedEntries}`,
                warnings: warnings.length > 0 ? warnings : undefined,
                errors: errors.length > 0 ? errors : undefined
            };
            this.logger.debug('ACL configuration completed', {
                path: config.path,
                appliedEntries,
                failedEntries
            });
            return {
                success: true,
                data: result,
                metadata: {
                    timestamp: new Date(),
                    requestId: '',
                    duration: 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to apply ACL configuration', error, { path: config.path });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while applying ACL configuration to: ${config.path}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, path: config.path });
        }
    }
    /**
     * Delete async job for job cleanup
     */
    async deleteAsyncJob(jobId) {
        try {
            this.logger.debug('Deleting async job', { jobId });
            if (!jobId) {
                throw new AEMException('Job ID is required', 'VALIDATION_ERROR', false);
            }
            const formData = new FormData();
            formData.append(':operation', 'delete');
            const requestOptions = {
                context: {
                    operation: 'deleteAsyncJob',
                    resource: jobId
                }
            };
            const response = await this.client.post(`/var/eventing/jobs/${jobId}`, formData, requestOptions);
            if (!response.success) {
                throw new AEMException(`Failed to delete async job: ${jobId}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const result = {
                success: true,
                jobId,
                jobStatus: 'DELETED',
                deletedJobs: 1,
                message: `Async job ${jobId} deleted successfully`
            };
            this.logger.debug('Successfully deleted async job', { jobId });
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
            this.logger.error('Failed to delete async job', error, { jobId });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while deleting async job: ${jobId}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, jobId });
        }
    }
    /**
     * Manipulate JCR property for property management
     */
    async manipulateJCRProperty(operation) {
        try {
            this.logger.debug('Manipulating JCR property', { operation: 'manipulateJCRProperty', path: operation.path, property: operation.property });
            if (!operation.path || !operation.property) {
                throw new AEMException('Path and property name are required', 'VALIDATION_ERROR', false);
            }
            // Validate path
            if (!this.isValidJCRPath(operation.path)) {
                throw new AEMException('Invalid JCR path format', 'VALIDATION_ERROR', false);
            }
            // Validate property name
            if (!this.isValidPropertyName(operation.property)) {
                throw new AEMException('Invalid property name format', 'VALIDATION_ERROR', false);
            }
            // Safety check: prevent manipulation of system properties
            if (this.isSystemProperty(operation.property)) {
                throw new AEMException(`Cannot manipulate system property: ${operation.property}`, 'VALIDATION_ERROR', false);
            }
            const formData = new FormData();
            let oldValue = undefined;
            // Get current value for logging
            try {
                const currentResponse = await this.client.get(`${operation.path}.json`);
                if (currentResponse.success && currentResponse.data) {
                    oldValue = currentResponse.data[operation.property];
                }
            }
            catch (error) {
                // Ignore errors when getting current value
            }
            switch (operation.operation) {
                case 'set':
                    if (operation.value === undefined) {
                        throw new AEMException('Value is required for set operation', 'VALIDATION_ERROR', false);
                    }
                    if (operation.multiple && Array.isArray(operation.value)) {
                        operation.value.forEach((item, index) => {
                            formData.append(`${operation.property}[${index}]`, this.formatPropertyValue(item, operation.type));
                        });
                    }
                    else {
                        formData.append(operation.property, this.formatPropertyValue(operation.value, operation.type));
                    }
                    if (operation.type) {
                        formData.append(`${operation.property}@TypeHint`, operation.type);
                    }
                    break;
                case 'delete':
                    formData.append(`${operation.property}@Delete`, '');
                    break;
                case 'add':
                    if (!Array.isArray(operation.value)) {
                        throw new AEMException('Value must be an array for add operation', 'VALIDATION_ERROR', false);
                    }
                    operation.value.forEach((item, index) => {
                        formData.append(`${operation.property}[+]`, this.formatPropertyValue(item, operation.type));
                    });
                    break;
                case 'remove':
                    if (!Array.isArray(operation.value)) {
                        throw new AEMException('Value must be an array for remove operation', 'VALIDATION_ERROR', false);
                    }
                    operation.value.forEach((item) => {
                        formData.append(`${operation.property}[-]`, this.formatPropertyValue(item, operation.type));
                    });
                    break;
                default:
                    throw new AEMException(`Invalid operation: ${operation.operation}`, 'VALIDATION_ERROR', false);
            }
            const requestOptions = {
                context: {
                    operation: 'manipulateJCRProperty',
                    resource: operation.path
                }
            };
            const response = await this.client.post(operation.path, formData, requestOptions);
            if (!response.success) {
                throw new AEMException(`Failed to manipulate JCR property ${operation.property} at ${operation.path}`, 'SERVER_ERROR', true, undefined, { response });
            }
            const result = {
                success: true,
                path: operation.path,
                property: operation.property,
                oldValue,
                newValue: operation.operation === 'delete' ? undefined : operation.value,
                propertyType: operation.type,
                message: `Property ${operation.property} ${operation.operation} operation completed successfully`
            };
            this.logger.debug('Successfully manipulated JCR property', {
                path: operation.path,
                property: operation.property,
                operation: operation.operation
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
            this.logger.error('Failed to manipulate JCR property', error, {
                path: operation.path,
                property: operation.property
            });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while manipulating JCR property ${operation.property} at ${operation.path}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, operation });
        }
    }
    /**
     * Apply single ACL entry
     */
    async applyACLEntry(path, entry, merge = true) {
        const formData = new FormData();
        // Set principal
        formData.append('principalName', entry.principal);
        // Set privileges
        entry.privileges.forEach((privilege, index) => {
            const privilegeKey = entry.allow ? `privilege[${index}]` : `privilege@Delete[${index}]`;
            formData.append(privilegeKey, privilege);
        });
        // Set allow/deny
        formData.append('privilege@Allow', entry.allow.toString());
        // Add restrictions if provided
        if (entry.restrictions) {
            for (const [key, value] of Object.entries(entry.restrictions)) {
                formData.append(`restriction_${key}`, value);
            }
        }
        // Set merge mode
        if (merge) {
            formData.append('merge', 'true');
        }
        const requestOptions = {
            context: {
                operation: 'applyACLEntry',
                resource: path
            }
        };
        const response = await this.client.post(`${path}.modifyAce.html`, formData, requestOptions);
        if (!response.success) {
            throw new AEMException(`Failed to apply ACL entry for principal: ${entry.principal}`, 'SERVER_ERROR', true, undefined, { response });
        }
    }
    /**
     * Clear existing ACL
     */
    async clearACL(path) {
        const formData = new FormData();
        formData.append(':operation', 'deleteAce');
        const requestOptions = {
            context: {
                operation: 'clearACL',
                resource: path
            }
        };
        const response = await this.client.post(`${path}.deleteAce.html`, formData, requestOptions);
        if (!response.success) {
            throw new AEMException(`Failed to clear ACL for path: ${path}`, 'SERVER_ERROR', true, undefined, { response });
        }
    }
    /**
     * Validate JCR path format
     */
    isValidJCRPath(path) {
        // JCR path validation
        return path.startsWith('/') &&
            !path.includes('//') &&
            !path.endsWith('/') &&
            !/[<>:"|?*]/.test(path) &&
            path.length > 0 &&
            path.length <= 1000;
    }
    /**
     * Validate property name format
     */
    isValidPropertyName(propertyName) {
        // JCR property name validation
        const invalidChars = /[\/\[\]:|*]/;
        const reservedNames = ['.', '..'];
        return !invalidChars.test(propertyName) &&
            !reservedNames.includes(propertyName) &&
            propertyName.length > 0 &&
            propertyName.length <= 150;
    }
    /**
     * Check if property is a system property that should not be manipulated
     */
    isSystemProperty(propertyName) {
        const systemProperties = [
            'jcr:primaryType',
            'jcr:mixinTypes',
            'jcr:uuid',
            'jcr:created',
            'jcr:createdBy',
            'jcr:lastModified',
            'jcr:lastModifiedBy',
            'jcr:versionHistory',
            'jcr:baseVersion',
            'jcr:predecessors',
            'jcr:successors',
            'jcr:isCheckedOut',
            'sling:resourceType',
            'sling:resourceSuperType'
        ];
        return systemProperties.includes(propertyName) ||
            propertyName.startsWith('rep:') ||
            propertyName.startsWith('oak:');
    }
    /**
     * Format property value based on type
     */
    formatPropertyValue(value, type) {
        if (value === null || value === undefined) {
            return '';
        }
        switch (type) {
            case 'Boolean':
                return Boolean(value).toString();
            case 'Long':
            case 'Double':
            case 'Decimal':
                return Number(value).toString();
            case 'Date':
                if (value instanceof Date) {
                    return value.toISOString();
                }
                else if (typeof value === 'string' || typeof value === 'number') {
                    return new Date(value).toISOString();
                }
                return value.toString();
            case 'Binary':
                if (value instanceof Buffer || value instanceof Uint8Array) {
                    return Buffer.from(value).toString('base64');
                }
                return value.toString();
            default:
                return value.toString();
        }
    }
}
//# sourceMappingURL=system-operations-service.js.map