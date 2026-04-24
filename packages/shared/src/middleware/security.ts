/**
 * Security middleware for AEMaaCS MCP servers
 * Implements request validation, rate limiting, and audit logging
 */

import { Request, Response, NextFunction } from 'express';

// Extend Request interface to include file upload properties
interface RequestWithFiles extends Request {
  files?: any;
  file?: any;
}
import rateLimit from 'express-rate-limit';
import { ValidationUtils } from '../utils/validation.js';
import { Logger } from '../utils/logger.js';
import { ConfigManager } from '../config/index.js';
import { AEMException } from '../utils/errors.js';
import { ErrorType, OperationContext } from '../types/aem.js';
import { randomUUID } from 'crypto';

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

export class SecurityMiddleware {
  private logger: Logger;
  private config: SecurityMiddlewareOptions;

  constructor(options?: SecurityMiddlewareOptions) {
    this.logger = Logger.getInstance();
    const configManager = ConfigManager.getInstance();
    const securityConfig = configManager.getSecurityConfig();

    this.config = {
      enableInputValidation: true,
      enableAuditLogging: true,
      enableRateLimit: true,
      enableApiKeyAuth: true,
      enableIPAllowlist: true,
      maxRequestSize: '10mb',
      allowedFileTypes: securityConfig.allowedFileTypes,
      maxFileSize: securityConfig.maxFileSize,
      allowedIPs: securityConfig.allowedIPs || [],
      apiKeys: securityConfig.apiKeys || [],
      ...options
    };
  }

  /**
   * API key validation middleware
   */
  validateApiKey() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableApiKeyAuth) {
        return next();
      }

      const context = this.createOperationContext(req, 'api_key_validation');
      
      try {
        const apiKey = req.headers['x-api-key'] as string || req.headers['authorization']?.replace('Bearer ', '');
        
        if (!apiKey) {
          this.logger.logSecurityEvent('Missing API key', context, {
            ip: req.ip,
            path: req.path,
            userAgent: req.get('User-Agent')
          });

          res.status(401).json({
            success: false,
            error: {
              code: 'MISSING_API_KEY',
              message: 'API key is required',
              recoverable: false
            }
          });
          return;
        }

        if (!this.config.apiKeys?.includes(apiKey)) {
          this.logger.logSecurityEvent('Invalid API key', context, {
            ip: req.ip,
            path: req.path,
            userAgent: req.get('User-Agent'),
            providedKey: `${apiKey.substring(0, 8)  }...` // Log partial key for debugging
          });

          res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_API_KEY',
              message: 'Invalid API key',
              recoverable: false
            }
          });
          return;
        }

        next();
      } catch (error) {
        this.logger.logSecurityEvent('API key validation error', context, {
          error: error instanceof Error ? error.message : 'Unknown error',
          ip: req.ip,
          path: req.path
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'API key validation failed',
            recoverable: true
          }
        });
      }
    };
  }

  /**
   * IP allowlisting middleware
   */
  validateIPAllowlist() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableIPAllowlist) {
        return next();
      }

      const context = this.createOperationContext(req, 'ip_allowlist_validation');
      
      try {
        const clientIP = this.getClientIP(req);
        
        if (this.config.allowedIPs && this.config.allowedIPs.length > 0) {
          const isAllowed = this.config.allowedIPs.some(allowedIP => {
            return this.isIPAllowed(clientIP, allowedIP);
          });

          if (!isAllowed) {
            this.logger.logSecurityEvent('IP not in allowlist', context, {
              clientIP,
              path: req.path,
              userAgent: req.get('User-Agent'),
              allowedIPs: this.config.allowedIPs
            });

            res.status(403).json({
              success: false,
              error: {
                code: 'IP_NOT_ALLOWED',
                message: 'Access denied from this IP address',
                recoverable: false
              }
            });
            return;
          }
        }

        next();
      } catch (error) {
        this.logger.logSecurityEvent('IP allowlist validation error', context, {
          error: error instanceof Error ? error.message : 'Unknown error',
          ip: req.ip,
          path: req.path
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'IP validation failed',
            recoverable: true
          }
        });
      }
    };
  }

  /**
   * Create rate limiting middleware
   */
  createRateLimitMiddleware() {
    if (!this.config.enableRateLimit) {
      return (_req: Request, _res: Response, next: NextFunction) => next();
    }

    const configManager = ConfigManager.getInstance();
    const serverConfig = configManager.getServerConfig();

    return rateLimit({
      windowMs: serverConfig.rateLimit.windowMs,
      max: serverConfig.rateLimit.maxRequests,
      message: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP, please try again later.',
          recoverable: true,
          retryAfter: Math.ceil(serverConfig.rateLimit.windowMs / 1000)
        }
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        const context = this.createOperationContext(req, 'rate_limit_exceeded');
        this.logger.logSecurityEvent('Rate limit exceeded', context, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        });

        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP, please try again later.',
            recoverable: true,
            retryAfter: Math.ceil(serverConfig.rateLimit.windowMs / 1000)
          }
        });
      }
    });
  }

  /**
   * Input validation middleware
   */
  validateInput() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableInputValidation) {
        return next();
      }

      try {
        const context = this.createOperationContext(req, 'input_validation');

        // Validate and sanitize request body
        if (req.body) {
          req.body = ValidationUtils.sanitizeInput(req.body);
        }

        // Validate and sanitize query parameters
        if (req.query) {
          req.query = ValidationUtils.sanitizeInput(req.query);
        }

        // Validate paths in request
        this.validateRequestPaths(req);

        // Validate file uploads if present
        if ((req as RequestWithFiles).files || (req as RequestWithFiles).file) {
          this.validateFileUploads(req);
        }

        // Log successful validation
        if (this.config.enableAuditLogging) {
          this.logger.debug('Input validation passed', {
            requestId: context.requestId,
            path: req.path,
            method: req.method
          });
        }

        next();
      } catch (error) {
        const context = this.createOperationContext(req, 'input_validation_failed');
        this.logger.logSecurityEvent('Input validation failed', context, {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: req.path,
          method: req.method
        });

        if (error instanceof AEMException) {
          res.status(400).json({
            success: false,
            error: error.toAEMError()
          });
        } else {
          res.status(400).json({
            success: false,
            error: {
              code: ErrorType.VALIDATION_ERROR,
              message: 'Input validation failed',
              recoverable: false
            }
          });
        }
      }
    };
  }

  /**
   * Path traversal protection middleware
   */
  preventPathTraversal() {
    return (req: Request, res: Response, next: NextFunction) => {
      const context = this.createOperationContext(req, 'path_traversal_check');

      try {
        // Check URL path
        if (this.containsPathTraversal(req.path)) {
          throw new AEMException(
            'Path traversal attempt detected in URL',
            ErrorType.VALIDATION_ERROR,
            false
          );
        }

        // Check query parameters
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string' && this.containsPathTraversal(value)) {
            throw new AEMException(
              `Path traversal attempt detected in query parameter: ${key}`,
              ErrorType.VALIDATION_ERROR,
              false
            );
          }
        }

        // Check request body paths
        if (req.body && typeof req.body === 'object') {
          this.checkObjectForPathTraversal(req.body);
        }

        next();
      } catch (error) {
        this.logger.logSecurityEvent('Path traversal attempt detected', context, {
          path: req.path,
          query: req.query,
          body: req.body,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        if (error instanceof AEMException) {
          res.status(400).json({
            success: false,
            error: error.toAEMError()
          });
        } else {
          res.status(400).json({
            success: false,
            error: {
              code: ErrorType.VALIDATION_ERROR,
              message: 'Invalid request detected',
              recoverable: false
            }
          });
        }
      }
    };
  }

  /**
   * Audit logging middleware
   */
  auditLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableAuditLogging) {
        return next();
      }

      const context = this.createOperationContext(req, req.path);
      const startTime = Date.now();

      // Log request start
      this.logger.logOperationStart(`${req.method  } ${  req.path}`, context);

      // Override res.end to capture response
      const originalEnd = res.end.bind(res);
      res.end = function (chunk?: any, encoding?: any, cb?: any) {
        const duration = Date.now() - startTime;
        const success = res.statusCode < 400;

        // Log operation completion
        Logger.getInstance().logOperationComplete(
          `${req.method  } ${  req.path}`,
          context,
          duration,
          success
        );

        // Call original end method
        return originalEnd(chunk, encoding, cb);
      } as any;

      next();
    };
  }

  /**
   * Request size limiting middleware
   */
  limitRequestSize() {
    return (req: Request, res: Response, next: NextFunction) => {
      const contentLength = req.get('content-length');
      if (contentLength) {
        const size = parseInt(contentLength);
        const maxSize = this.parseSize(this.config.maxRequestSize || '10mb');

        if (size > maxSize) {
          const context = this.createOperationContext(req, 'request_size_exceeded');
          this.logger.logSecurityEvent('Request size exceeded', context, {
            contentLength: size,
            maxSize,
            path: req.path
          });

          res.status(413).json({
            success: false,
            error: {
              code: ErrorType.VALIDATION_ERROR,
              message: `Request size exceeds maximum limit (${this.config.maxRequestSize})`,
              recoverable: false
            }
          });
          return;
        }
      }
      next();
    };
  }

  /**
   * Injection attack prevention middleware
   */
  preventInjectionAttacks() {
    return (req: Request, res: Response, next: NextFunction) => {
      const context = this.createOperationContext(req, 'injection_check');

      try {
        // Check for SQL injection patterns
        this.checkForSQLInjection(req);

        // Check for XSS patterns
        this.checkForXSS(req);

        // Check for command injection patterns
        this.checkForCommandInjection(req);

        next();
      } catch (error) {
        this.logger.logSecurityEvent('Injection attack detected', context, {
          path: req.path,
          query: req.query,
          body: req.body,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        if (error instanceof AEMException) {
          res.status(400).json({
            success: false,
            error: error.toAEMError()
          });
        } else {
          res.status(400).json({
            success: false,
            error: {
              code: ErrorType.VALIDATION_ERROR,
              message: 'Potentially malicious request detected',
              recoverable: false
            }
          });
        }
      }
    };
  }

  /**
   * Create operation context for logging
   */
  private createOperationContext(req: Request, operation: string): OperationContext {
    return {
      requestId: req.headers['x-request-id'] as string || randomUUID(),
      userId: req.headers['x-user-id'] as string,
      operation,
      resource: req.path,
      timestamp: new Date()
    };
  }

  /**
   * Validate request paths
   */
  private validateRequestPaths(req: Request): void {
    // Check common path parameters
    const pathParams = ['path', 'pagePath', 'contentPath', 'assetPath', 'packagePath'];

    for (const param of pathParams) {
      const value = req.body?.[param] || req.query?.[param];
      if (value && typeof value === 'string') {
        const result = ValidationUtils.validatePath(value);
        if (!result.valid) {
          throw new AEMException(
            `Invalid ${param}: ${result.errors?.join(', ')}`,
            ErrorType.VALIDATION_ERROR,
            false
          );
        }
      }
    }
  }

  /**
   * Validate file uploads
   */
  private validateFileUploads(req: Request): void {
    const reqWithFiles = req as RequestWithFiles;
    const files = reqWithFiles.files || (reqWithFiles.file ? [reqWithFiles.file] : []);

    for (const file of Array.isArray(files) ? files : Object.values(files).flat()) {
      if (file && typeof file === 'object' && 'buffer' in file) {
        const result = ValidationUtils.validateFileUpload(file.buffer, {
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size
        });

        if (!result.valid) {
          throw new AEMException(
            `File validation failed: ${result.errors?.join(', ')}`,
            ErrorType.VALIDATION_ERROR,
            false
          );
        }
      }
    }
  }

  /**
   * Check if string contains path traversal patterns
   */
  private containsPathTraversal(str: string): boolean {
    const patterns = [
      /\.\./,
      /\/\.\./,
      /\.\.\//,
      /\/\/+/,
      /%2e%2e/i,
      /%2f%2e%2e/i,
      /%2e%2e%2f/i
    ];

    return patterns.some(pattern => pattern.test(str));
  }

  /**
   * Recursively check object for path traversal
   */
  private checkObjectForPathTraversal(obj: any, path: string = ''): void {
    if (typeof obj === 'string') {
      if (this.containsPathTraversal(obj)) {
        throw new AEMException(
          `Path traversal attempt detected in ${path}`,
          ErrorType.VALIDATION_ERROR,
          false
        );
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        this.checkObjectForPathTraversal(value, path ? `${path}.${key}` : key);
      }
    }
  }

  /**
   * Check for SQL injection patterns
   */
  private checkForSQLInjection(req: Request): void {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(;|\|\||&&)/,
      /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT)\b)/i
    ];

    this.checkPatternsInRequest(req, sqlPatterns, 'SQL injection');
  }

  /**
   * Check for XSS patterns
   */
  private checkForXSS(req: Request): void {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe\b/i,
      /<object\b/i,
      /<embed\b/i
    ];

    this.checkPatternsInRequest(req, xssPatterns, 'XSS');
  }

  /**
   * Check for command injection patterns
   */
  private checkForCommandInjection(req: Request): void {
    const cmdPatterns = [
      /(\||&|;|\$\(|\`)/,
      /\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig)\b/i,
      /\b(rm|mv|cp|chmod|chown|kill)\b/i
    ];

    this.checkPatternsInRequest(req, cmdPatterns, 'Command injection');
  }

  /**
   * Check patterns in request data
   */
  private checkPatternsInRequest(req: Request, patterns: RegExp[], attackType: string): void {
    const checkString = (str: string, location: string) => {
      for (const pattern of patterns) {
        if (pattern.test(str)) {
          throw new AEMException(
            `${attackType} pattern detected in ${location}`,
            ErrorType.VALIDATION_ERROR,
            false
          );
        }
      }
    };

    // Check query parameters
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        checkString(value, `query parameter ${key}`);
      }
    }

    // Check request body
    if (req.body && typeof req.body === 'object') {
      this.checkObjectForPatterns(req.body, patterns, attackType);
    }
  }

  /**
   * Recursively check object for malicious patterns
   */
  private checkObjectForPatterns(obj: any, patterns: RegExp[], attackType: string, path: string = ''): void {
    if (typeof obj === 'string') {
      for (const pattern of patterns) {
        if (pattern.test(obj)) {
          throw new AEMException(
            `${attackType} pattern detected in ${path}`,
            ErrorType.VALIDATION_ERROR,
            false
          );
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        this.checkObjectForPatterns(value, patterns, attackType, path ? `${path}.${key}` : key);
      }
    }
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(size: string): number {
    const units: Record<string, number> = {
      'b': 1,
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024
    };

    const match = size.toLowerCase().match(/^(\d+)([bkmg]?)$/);
    if (!match) {
      return 10 * 1024 * 1024; // Default 10MB
    }

    const [, num, unit] = match;
    const numValue = parseInt(num || '10');
    const unitMultiplier = units[unit || 'b'] || 1;
    return numValue * unitMultiplier;
  }

  /**
   * Get client IP address from request
   */
  private getClientIP(req: Request): string {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           (req.connection as any)?.socket?.remoteAddress ||
           req.headers['x-forwarded-for']?.toString().split(',')[0] ||
           req.headers['x-real-ip']?.toString() ||
           'unknown';
  }

  /**
   * Check if client IP is allowed
   */
  private isIPAllowed(clientIP: string, allowedIP: string): boolean {
    // Handle CIDR notation (e.g., 192.168.1.0/24)
    if (allowedIP.includes('/')) {
      return this.isIPInCIDR(clientIP, allowedIP);
    }
    
    // Handle exact match
    return clientIP === allowedIP;
  }

  /**
   * Check if IP is within CIDR range
   */
  private isIPInCIDR(ip: string, cidr: string): boolean {
    try {
      const [network, prefixLength] = cidr.split('/');
      const ipNum = this.ipToNumber(ip);
      const networkNum = this.ipToNumber(network);
      const mask = (0xffffffff << (32 - parseInt(prefixLength))) >>> 0;
      
      return (ipNum & mask) === (networkNum & mask);
    } catch {
      return false;
    }
  }

  /**
   * Convert IP address to number
   */
  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }
}

/**
 * Factory function to create security middleware with default configuration
 */
export function createSecurityMiddleware(options?: SecurityMiddlewareOptions): SecurityMiddleware {
  return new SecurityMiddleware(options);
}

/**
 * Express middleware factory functions
 */
export function createSecurityMiddlewares(options?: SecurityMiddlewareOptions) {
  const security = new SecurityMiddleware(options);

  return {
    validateApiKey: security.validateApiKey(),
    validateIPAllowlist: security.validateIPAllowlist(),
    rateLimit: security.createRateLimitMiddleware(),
    validateInput: security.validateInput(),
    preventPathTraversal: security.preventPathTraversal(),
    auditLogger: security.auditLogger(),
    limitRequestSize: security.limitRequestSize(),
    preventInjectionAttacks: security.preventInjectionAttacks()
  };
}