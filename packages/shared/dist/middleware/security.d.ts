/**
 * Security middleware for AEMaaCS MCP servers
 * Implements request validation, rate limiting, and audit logging
 */
import { Request, Response, NextFunction } from 'express';
export interface SecurityMiddlewareOptions {
    enableInputValidation?: boolean;
    enableAuditLogging?: boolean;
    enableRateLimit?: boolean;
    enableApiKeyAuth?: boolean;
    enableIPAllowlist?: boolean;
    maxRequestSize?: string;
    allowedFileTypes?: string[];
    maxFileSize?: number;
    allowedIPs?: string[];
    apiKeys?: string[];
}
export declare class SecurityMiddleware {
    private logger;
    private config;
    constructor(options?: SecurityMiddlewareOptions);
    /**
     * API key validation middleware
     */
    validateApiKey(): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * IP allowlisting middleware
     */
    validateIPAllowlist(): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Create rate limiting middleware
     */
    createRateLimitMiddleware(): (_req: Request, _res: Response, next: NextFunction) => void;
    /**
     * Input validation middleware
     */
    validateInput(): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Path traversal protection middleware
     */
    preventPathTraversal(): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Audit logging middleware
     */
    auditLogger(): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Request size limiting middleware
     */
    limitRequestSize(): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Injection attack prevention middleware
     */
    preventInjectionAttacks(): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Create operation context for logging
     */
    private createOperationContext;
    /**
     * Validate request paths
     */
    private validateRequestPaths;
    /**
     * Validate file uploads
     */
    private validateFileUploads;
    /**
     * Check if string contains path traversal patterns
     */
    private containsPathTraversal;
    /**
     * Recursively check object for path traversal
     */
    private checkObjectForPathTraversal;
    /**
     * Check for SQL injection patterns
     */
    private checkForSQLInjection;
    /**
     * Check for XSS patterns
     */
    private checkForXSS;
    /**
     * Check for command injection patterns
     */
    private checkForCommandInjection;
    /**
     * Check patterns in request data
     */
    private checkPatternsInRequest;
    /**
     * Recursively check object for malicious patterns
     */
    private checkObjectForPatterns;
    /**
     * Parse size string to bytes
     */
    private parseSize;
    /**
     * Get client IP address from request
     */
    private getClientIP;
    /**
     * Check if client IP is allowed
     */
    private isIPAllowed;
    /**
     * Check if IP is within CIDR range
     */
    private isIPInCIDR;
    /**
     * Convert IP address to number
     */
    private ipToNumber;
}
/**
 * Factory function to create security middleware with default configuration
 */
export declare function createSecurityMiddleware(options?: SecurityMiddlewareOptions): SecurityMiddleware;
/**
 * Express middleware factory functions
 */
export declare function createSecurityMiddlewares(options?: SecurityMiddlewareOptions): {
    validateApiKey: (req: Request, res: Response, next: NextFunction) => void;
    validateIPAllowlist: (req: Request, res: Response, next: NextFunction) => void;
    rateLimit: (_req: Request, _res: Response, next: NextFunction) => void;
    validateInput: (req: Request, res: Response, next: NextFunction) => void;
    preventPathTraversal: (req: Request, res: Response, next: NextFunction) => void;
    auditLogger: (req: Request, res: Response, next: NextFunction) => void;
    limitRequestSize: (req: Request, res: Response, next: NextFunction) => void;
    preventInjectionAttacks: (req: Request, res: Response, next: NextFunction) => void;
};
//# sourceMappingURL=security.d.ts.map