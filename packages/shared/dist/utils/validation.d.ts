/**
 * Validation utilities for AEMaaCS MCP servers
 */
import Joi from 'joi';
export interface ValidationResult {
    valid: boolean;
    errors?: string[] | undefined;
    sanitized?: any;
}
export declare class ValidationUtils {
    /**
     * Validate and sanitize AEM path
     */
    static validatePath(path: string): ValidationResult;
    /**
     * Validate AEM content path with enhanced security checks
     */
    static validateContentPath(path: string): ValidationResult;
    /**
     * Validate JCR property name
     */
    static validateJCRPropertyName(propertyName: string): ValidationResult;
    /**
     * Validate JCR property value
     */
    static validateJCRPropertyValue(value: any, propertyName: string): ValidationResult;
    /**
     * Validate JCR query for security
     */
    static validateJCRQuery(query: string): ValidationResult;
    /**
     * Validate file upload
     */
    static validateFileUpload(file: Buffer, metadata: {
        filename?: string;
        mimeType?: string;
        size?: number;
    }): ValidationResult;
    /**
     * Validate file content for security threats
     */
    static validateFileContent(file: Buffer, mimeType: string): ValidationResult;
    /**
     * Validate search query for security
     */
    static validateSearchQuery(query: string): ValidationResult;
    /**
     * Validate user input for XSS prevention
     */
    static validateUserInput(input: any): ValidationResult;
    /**
     * Sanitize input object by removing potentially dangerous properties
     */
    static sanitizeInput(input: any): any;
    /**
     * Validate using Joi schema
     */
    static validateWithSchema<T>(data: any, schema: Joi.Schema): T;
}
export declare const CommonSchemas: {
    aemPath: Joi.StringSchema<string>;
    optionalAemPath: Joi.StringSchema<string>;
    pageSize: Joi.NumberSchema<number>;
    offset: Joi.NumberSchema<number>;
    depth: Joi.NumberSchema<number>;
    query: Joi.StringSchema<string>;
    optionalQuery: Joi.StringSchema<string>;
    properties: Joi.ObjectSchema<any>;
    force: Joi.BooleanSchema<boolean>;
    recursive: Joi.BooleanSchema<boolean>;
};
//# sourceMappingURL=validation.d.ts.map