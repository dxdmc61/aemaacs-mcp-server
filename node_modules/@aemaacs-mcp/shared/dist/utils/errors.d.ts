/**
 * Error handling utilities for AEMaaCS MCP servers
 */
import { AEMError, ErrorType, OperationContext } from '../types/aem.js';
import { MCPError } from '../types/mcp.js';
export declare class AEMException extends Error {
    readonly code: string;
    readonly recoverable: boolean;
    readonly retryable: boolean;
    readonly retryAfter?: number | undefined;
    readonly details?: Record<string, any> | undefined;
    constructor(message: string, code?: string, recoverable?: boolean, retryAfter?: number | undefined, details?: Record<string, any> | undefined);
    toAEMError(): AEMError;
    toMCPError(): MCPError;
    private getMCPErrorCode;
}
export declare class ErrorHandler {
    static handleError(error: Error, context: OperationContext): AEMError;
    private static handleAxiosError;
    static isRecoverable(error: AEMError): boolean;
    static getRetryDelay(attempt: number, baseDelay?: number, maxDelay?: number): number;
}
export interface ErrorRetryConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors: ErrorType[];
}
export declare class RetryHandler {
    private config;
    constructor(config: ErrorRetryConfig);
    executeWithRetry<T>(operation: () => Promise<T>, context: OperationContext): Promise<T>;
}
//# sourceMappingURL=errors.d.ts.map