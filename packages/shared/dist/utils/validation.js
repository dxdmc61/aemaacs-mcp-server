/**
 * Validation utilities for AEMaaCS MCP servers
 */
import Joi from 'joi';
import { AEMException } from './errors.js';
import { ErrorType } from '../types/aem.js';
export class ValidationUtils {
    /**
     * Validate and sanitize AEM path
     */
    static validatePath(path) {
        if (!path || typeof path !== 'string') {
            return {
                valid: false,
                errors: ['Path is required and must be a string']
            };
        }
        // Remove leading/trailing whitespace
        const trimmed = path.trim();
        // Check for path traversal attempts
        if (trimmed.includes('..') || trimmed.includes('//')) {
            return {
                valid: false,
                errors: ['Path contains invalid characters (path traversal detected)']
            };
        }
        // Ensure path starts with /
        const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        // Check for valid AEM path characters
        const validPathRegex = /^\/[a-zA-Z0-9\/_\-\.]+$/;
        if (!validPathRegex.test(normalized)) {
            return {
                valid: false,
                errors: ['Path contains invalid characters']
            };
        }
        return {
            valid: true,
            sanitized: normalized
        };
    }
    /**
     * Validate AEM content path with enhanced security checks
     */
    static validateContentPath(path) {
        const pathResult = this.validatePath(path);
        if (!pathResult.valid) {
            return pathResult;
        }
        const errors = [];
        const normalized = pathResult.sanitized;
        // Check for system paths
        const systemPaths = ['/etc', '/system', '/var', '/tmp', '/libs', '/apps'];
        for (const systemPath of systemPaths) {
            if (normalized.startsWith(systemPath)) {
                errors.push(`Access to system path ${systemPath} is not allowed`);
            }
        }
        // Check for dangerous patterns
        const dangerousPatterns = [
            /\.\./, // Path traversal
            /\/\//, // Double slashes
            /\/$/, // Trailing slash (not allowed for content)
            /[<>:"|?*]/, // Invalid filename characters
            /[\x00-\x1f]/, // Control characters
            /[^\x20-\x7e]/ // Non-printable characters
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(normalized)) {
                errors.push('Path contains invalid characters or patterns');
                break;
            }
        }
        // Check path length
        if (normalized.length > 1000) {
            errors.push('Path exceeds maximum length (1000 characters)');
        }
        // Check for reserved names
        const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        const pathSegments = normalized.split('/').filter(Boolean);
        for (const segment of pathSegments) {
            if (reservedNames.includes(segment.toUpperCase())) {
                errors.push(`Reserved name '${segment}' is not allowed`);
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            sanitized: normalized
        };
    }
    /**
     * Validate JCR property name
     */
    static validateJCRPropertyName(propertyName) {
        if (!propertyName || typeof propertyName !== 'string') {
            return {
                valid: false,
                errors: ['Property name is required and must be a string']
            };
        }
        const trimmed = propertyName.trim();
        const errors = [];
        // Check length
        if (trimmed.length === 0) {
            errors.push('Property name cannot be empty');
        }
        if (trimmed.length > 255) {
            errors.push('Property name exceeds maximum length (255 characters)');
        }
        // Check for valid JCR property name characters
        const validPropertyNameRegex = /^[a-zA-Z0-9_\-\.:]+$/;
        if (!validPropertyNameRegex.test(trimmed)) {
            errors.push('Property name contains invalid characters');
        }
        // Check for reserved names
        const reservedNames = ['jcr:primaryType', 'jcr:mixinTypes', 'jcr:uuid', 'jcr:created', 'jcr:createdBy', 'jcr:lastModified', 'jcr:lastModifiedBy', 'jcr:versionHistory', 'jcr:predecessors', 'jcr:mergeFailed', 'jcr:activity', 'jcr:configuration', 'jcr:lockOwner', 'jcr:lockIsDeep', 'jcr:lockToken'];
        if (reservedNames.includes(trimmed)) {
            errors.push(`Reserved JCR property name '${trimmed}' is not allowed`);
        }
        // Check for namespace prefixes
        if (trimmed.includes(':') && !trimmed.startsWith('jcr:')) {
            errors.push('Custom namespace prefixes are not allowed');
        }
        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            sanitized: trimmed
        };
    }
    /**
     * Validate JCR property value
     */
    static validateJCRPropertyValue(value, propertyName) {
        const errors = [];
        // Check for null/undefined
        if (value === null || value === undefined) {
            return {
                valid: true,
                sanitized: null
            };
        }
        // Check for dangerous types
        if (typeof value === 'function') {
            errors.push('Function values are not allowed');
        }
        if (typeof value === 'object' && !Array.isArray(value) && value.constructor !== Object) {
            errors.push('Complex object types are not allowed');
        }
        // Check for circular references
        try {
            JSON.stringify(value);
        }
        catch (error) {
            errors.push('Property value contains circular references');
        }
        // Check for size limits
        const serialized = JSON.stringify(value);
        if (serialized.length > 1024 * 1024) { // 1MB limit
            errors.push('Property value exceeds maximum size (1MB)');
        }
        // Check for dangerous content in strings
        if (typeof value === 'string') {
            const dangerousPatterns = [
                /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                /javascript:/gi,
                /on\w+\s*=/gi,
                /data:text\/html/gi,
                /vbscript:/gi
            ];
            for (const pattern of dangerousPatterns) {
                if (pattern.test(value)) {
                    errors.push('Property value contains potentially dangerous content');
                    break;
                }
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            sanitized: value
        };
    }
    /**
     * Validate JCR query for security
     */
    static validateJCRQuery(query) {
        if (!query || typeof query !== 'string') {
            return {
                valid: false,
                errors: ['Query is required and must be a string']
            };
        }
        const trimmed = query.trim();
        // Check for dangerous SQL injection patterns
        const dangerousPatterns = [
            /;\s*(drop|delete|update|insert|create|alter)\s+/i,
            /union\s+select/i,
            /exec\s*\(/i,
            /script\s*>/i,
            /<\s*script/i
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(trimmed)) {
                return {
                    valid: false,
                    errors: ['Query contains potentially dangerous patterns']
                };
            }
        }
        return {
            valid: true,
            sanitized: trimmed
        };
    }
    /**
     * Validate file upload
     */
    static validateFileUpload(file, metadata) {
        const errors = [];
        if (!Buffer.isBuffer(file)) {
            errors.push('File content must be a Buffer');
        }
        if (metadata.size && metadata.size > 100 * 1024 * 1024) { // 100MB limit
            errors.push('File size exceeds maximum limit (100MB)');
        }
        if (metadata.filename) {
            // Check for dangerous filename patterns
            if (metadata.filename.includes('..') || metadata.filename.includes('/') || metadata.filename.includes('\\')) {
                errors.push('Filename contains invalid characters');
            }
            // Check file extension
            const allowedExtensions = [
                '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', // Images
                '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', // Documents
                '.txt', '.csv', '.json', '.xml', '.html', '.css', '.js', // Text files
                '.zip', '.tar', '.gz' // Archives
            ];
            const extension = metadata.filename.toLowerCase().substring(metadata.filename.lastIndexOf('.'));
            if (!allowedExtensions.includes(extension)) {
                errors.push(`File type not allowed: ${extension}`);
            }
        }
        if (metadata.mimeType) {
            const allowedMimeTypes = [
                'image/', 'text/', 'application/pdf', 'application/json',
                'application/xml', 'application/zip', 'application/x-tar',
                'application/gzip', 'application/msword', 'application/vnd.ms-excel',
                'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument'
            ];
            const isAllowed = allowedMimeTypes.some(allowed => metadata.mimeType.startsWith(allowed));
            if (!isAllowed) {
                errors.push(`MIME type not allowed: ${metadata.mimeType}`);
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }
    /**
     * Validate file content for security threats
     */
    static validateFileContent(file, mimeType) {
        const errors = [];
        // Check for empty file
        if (file.length === 0) {
            errors.push('File is empty');
        }
        // Check for suspicious file headers
        const suspiciousHeaders = [
            Buffer.from('PK\x03\x04'), // ZIP files
            Buffer.from('PK\x05\x06'), // ZIP files
            Buffer.from('PK\x07\x08'), // ZIP files
            Buffer.from('Rar!\x1a\x07\x00'), // RAR files
            Buffer.from('7z\xbc\xaf\x27\x1c'), // 7z files
            Buffer.from('\x1f\x8b'), // GZIP files
            Buffer.from('BZh'), // BZIP2 files
        ];
        for (const header of suspiciousHeaders) {
            if (file.subarray(0, header.length).equals(header)) {
                errors.push('Archive files are not allowed');
                break;
            }
        }
        // Check for executable file signatures
        const executableHeaders = [
            Buffer.from('MZ'), // PE files
            Buffer.from('\x7fELF'), // ELF files
            Buffer.from('\xfe\xed\xfa'), // Mach-O files
            Buffer.from('\xce\xfa\xed\xfe'), // Mach-O files
        ];
        for (const header of executableHeaders) {
            if (file.subarray(0, header.length).equals(header)) {
                errors.push('Executable files are not allowed');
                break;
            }
        }
        // Check for script content in text files
        if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/xml') {
            const content = file.toString('utf8', 0, Math.min(file.length, 1024));
            const scriptPatterns = [
                /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                /javascript:/gi,
                /on\w+\s*=/gi,
                /data:text\/html/gi,
                /vbscript:/gi,
                /eval\s*\(/gi,
                /Function\s*\(/gi,
                /setTimeout\s*\(/gi,
                /setInterval\s*\(/gi
            ];
            for (const pattern of scriptPatterns) {
                if (pattern.test(content)) {
                    errors.push('File contains potentially dangerous script content');
                    break;
                }
            }
        }
        // Check for embedded objects in documents
        if (mimeType.includes('office') || mimeType.includes('document')) {
            const content = file.toString('binary', 0, Math.min(file.length, 1024));
            if (content.includes('OLE2') || content.includes('Microsoft Office')) {
                // Additional validation for Office documents
                if (content.includes('VBA') || content.includes('Macro')) {
                    errors.push('Files with macros are not allowed');
                }
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }
    /**
     * Validate search query for security
     */
    static validateSearchQuery(query) {
        if (!query || typeof query !== 'string') {
            return {
                valid: false,
                errors: ['Query is required and must be a string']
            };
        }
        const trimmed = query.trim();
        const errors = [];
        // Check length
        if (trimmed.length === 0) {
            errors.push('Query cannot be empty');
        }
        if (trimmed.length > 1000) {
            errors.push('Query exceeds maximum length (1000 characters)');
        }
        // Check for dangerous patterns
        const dangerousPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /data:text\/html/gi,
            /vbscript:/gi,
            /eval\s*\(/gi,
            /Function\s*\(/gi,
            /setTimeout\s*\(/gi,
            /setInterval\s*\(/gi,
            /document\.cookie/gi,
            /document\.location/gi,
            /window\.location/gi,
            /XMLHttpRequest/gi,
            /fetch\s*\(/gi
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(trimmed)) {
                errors.push('Query contains potentially dangerous content');
                break;
            }
        }
        // Check for SQL injection patterns
        const sqlPatterns = [
            /;\s*(drop|delete|update|insert|create|alter)\s+/i,
            /union\s+select/i,
            /exec\s*\(/i,
            /sp_executesql/i,
            /xp_cmdshell/i
        ];
        for (const pattern of sqlPatterns) {
            if (pattern.test(trimmed)) {
                errors.push('Query contains potentially dangerous SQL patterns');
                break;
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            sanitized: trimmed
        };
    }
    /**
     * Validate user input for XSS prevention
     */
    static validateUserInput(input) {
        if (input === null || input === undefined) {
            return {
                valid: true,
                sanitized: input
            };
        }
        const errors = [];
        if (typeof input === 'string') {
            // Check for XSS patterns
            const xssPatterns = [
                /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                /javascript:/gi,
                /on\w+\s*=/gi,
                /data:text\/html/gi,
                /vbscript:/gi,
                /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
                /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
                /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
                /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi,
                /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
                /<input\b[^<]*(?:(?!<\/input>)<[^<]*)*<\/input>/gi,
                /<textarea\b[^<]*(?:(?!<\/textarea>)<[^<]*)*<\/textarea>/gi,
                /<select\b[^<]*(?:(?!<\/select>)<[^<]*)*<\/select>/gi,
                /<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi,
                /<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi,
                /<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi,
                /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi
            ];
            for (const pattern of xssPatterns) {
                if (pattern.test(input)) {
                    errors.push('Input contains potentially dangerous content');
                    break;
                }
            }
            // Check for URL schemes
            const urlPatterns = [
                /javascript:/gi,
                /data:/gi,
                /vbscript:/gi,
                /file:/gi,
                /ftp:/gi,
                /gopher:/gi,
                /news:/gi,
                /telnet:/gi,
                /wais:/gi
            ];
            for (const pattern of urlPatterns) {
                if (pattern.test(input)) {
                    errors.push('Input contains potentially dangerous URL schemes');
                    break;
                }
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            sanitized: input
        };
    }
    /**
     * Sanitize input object by removing potentially dangerous properties
     */
    static sanitizeInput(input) {
        if (input === null || input === undefined) {
            return input;
        }
        if (typeof input === 'string') {
            // Remove script tags and other dangerous HTML
            return input
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
        }
        if (Array.isArray(input)) {
            return input.map(item => this.sanitizeInput(item));
        }
        if (typeof input === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(input)) {
                // Skip dangerous property names
                if (key.startsWith('__') || key === 'constructor' || key === 'prototype') {
                    continue;
                }
                sanitized[key] = this.sanitizeInput(value);
            }
            return sanitized;
        }
        return input;
    }
    /**
     * Validate using Joi schema
     */
    static validateWithSchema(data, schema) {
        const { error, value } = schema.validate(data, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });
        if (error) {
            const errorMessages = error.details.map(detail => detail.message);
            throw new AEMException(`Validation failed: ${errorMessages.join(', ')}`, ErrorType.VALIDATION_ERROR, false, undefined, { validationErrors: errorMessages });
        }
        return value;
    }
}
// Common Joi schemas
export const CommonSchemas = {
    aemPath: Joi.string().pattern(/^\/[a-zA-Z0-9\/_\-\.]*$/).required(),
    optionalAemPath: Joi.string().pattern(/^\/[a-zA-Z0-9\/_\-\.]*$/).optional(),
    pageSize: Joi.number().integer().min(1).max(1000).default(50),
    offset: Joi.number().integer().min(0).default(0),
    depth: Joi.number().integer().min(0).max(10).default(1),
    query: Joi.string().min(1).max(1000).required(),
    optionalQuery: Joi.string().min(1).max(1000).optional(),
    properties: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
    force: Joi.boolean().default(false),
    recursive: Joi.boolean().default(false)
};
//# sourceMappingURL=validation.js.map