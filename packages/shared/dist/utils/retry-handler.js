/**
 * Automatic retry with exponential backoff and fallback mechanisms
 */
import { Logger } from './logger.js';
import { AEMException } from './errors.js';
export class RetryHandler {
    constructor(defaultConfig) {
        this.logger = Logger.getInstance();
        this.defaultConfig = {
            maxAttempts: 3,
            baseDelay: 1000,
            maxDelay: 30000,
            exponentialBase: 2,
            jitter: true,
            retryableErrors: [
                'ECONNRESET',
                'ENOTFOUND',
                'ECONNREFUSED',
                'ETIMEDOUT',
                'EHOSTUNREACH',
                'ENETUNREACH',
                'EAI_AGAIN',
                'TEMPORARY_FAILURE',
                'SERVICE_UNAVAILABLE',
                'TIMEOUT'
            ],
            retryableStatusCodes: [
                408, // Request Timeout
                429, // Too Many Requests
                500, // Internal Server Error
                502, // Bad Gateway
                503, // Service Unavailable
                504 // Gateway Timeout
            ],
            timeout: 30000,
            fallbackEnabled: true,
            fallbackDelay: 5000,
            ...defaultConfig
        };
    }
    /**
     * Execute operation with retry logic
     */
    async execute(operation, options = {}) {
        const config = { ...this.defaultConfig, ...options.config };
        const startTime = Date.now();
        let lastError;
        let attempts = 0;
        let fallbackUsed = false;
        for (attempts = 1; attempts <= config.maxAttempts; attempts++) {
            try {
                // Set timeout for the operation
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Operation timeout')), config.timeout);
                });
                const result = await Promise.race([operation(), timeoutPromise]);
                return {
                    success: true,
                    result,
                    attempts,
                    totalTime: Date.now() - startTime,
                    fallbackUsed
                };
            }
            catch (error) {
                lastError = error;
                this.logger.warn(`Attempt ${attempts} failed for operation${options.context ? ` (${options.context})` : ''}`, lastError);
                // Check if error is retryable
                if (!this.isRetryableError(lastError, config)) {
                    this.logger.error(`Non-retryable error encountered${options.context ? ` (${options.context})` : ''}`, lastError);
                    break;
                }
                // Check if this was the last attempt
                if (attempts === config.maxAttempts) {
                    this.logger.error(`All ${config.maxAttempts} attempts failed${options.context ? ` (${options.context})` : ''}`, lastError);
                    break;
                }
                // Calculate delay for next attempt
                const delay = this.calculateDelay(attempts, config);
                this.logger.debug(`Waiting ${delay}ms before retry attempt ${attempts + 1}${options.context ? ` (${options.context})` : ''}`);
                // Call retry callback if provided
                if (options.onRetry) {
                    options.onRetry(attempts, lastError);
                }
                // Wait before next attempt
                await this.sleep(delay);
            }
        }
        // All attempts failed, try fallback if enabled
        if (config.fallbackEnabled && options.fallback && !fallbackUsed) {
            try {
                this.logger.info(`Attempting fallback operation${options.context ? ` (${options.context})` : ''}`);
                if (options.onFallback) {
                    options.onFallback(lastError);
                }
                // Wait before fallback
                await this.sleep(config.fallbackDelay);
                const fallbackResult = await options.fallback();
                fallbackUsed = true;
                return {
                    success: true,
                    result: fallbackResult,
                    attempts,
                    totalTime: Date.now() - startTime,
                    fallbackUsed
                };
            }
            catch (fallbackError) {
                this.logger.error(`Fallback operation also failed${options.context ? ` (${options.context})` : ''}`, fallbackError);
            }
        }
        return {
            success: false,
            error: lastError,
            attempts,
            totalTime: Date.now() - startTime,
            fallbackUsed
        };
    }
    /**
     * Execute operation with retry for HTTP requests
     */
    async executeHttpRequest(requestFn, options = {}) {
        const httpConfig = {
            ...this.defaultConfig,
            maxAttempts: 5,
            baseDelay: 500,
            maxDelay: 10000,
            retryableStatusCodes: [
                408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524
            ],
            ...options.config
        };
        return this.execute(requestFn, { ...options, config: httpConfig });
    }
    /**
     * Execute operation with retry for AEM operations
     */
    async executeAEMOperation(operationFn, options = {}) {
        const aemConfig = {
            ...this.defaultConfig,
            maxAttempts: 3,
            baseDelay: 1000,
            maxDelay: 15000,
            retryableErrors: [
                'ECONNRESET',
                'ENOTFOUND',
                'ECONNREFUSED',
                'ETIMEDOUT',
                'EHOSTUNREACH',
                'ENETUNREACH',
                'EAI_AGAIN',
                'TEMPORARY_FAILURE',
                'SERVICE_UNAVAILABLE',
                'TIMEOUT',
                'AEM_UNAVAILABLE',
                'AEM_BUSY',
                'AEM_MAINTENANCE'
            ],
            retryableStatusCodes: [
                408, 429, 500, 502, 503, 504
            ],
            ...options.config
        };
        return this.execute(operationFn, { ...options, config: aemConfig });
    }
    /**
     * Execute operation with retry for cache operations
     */
    async executeCacheOperation(operationFn, options = {}) {
        const cacheConfig = {
            ...this.defaultConfig,
            maxAttempts: 2,
            baseDelay: 100,
            maxDelay: 1000,
            retryableErrors: [
                'ECONNRESET',
                'ENOTFOUND',
                'ECONNREFUSED',
                'ETIMEDOUT',
                'REDIS_CONNECTION_ERROR',
                'REDIS_TIMEOUT'
            ],
            ...options.config
        };
        return this.execute(operationFn, { ...options, config: cacheConfig });
    }
    /**
     * Execute operation with retry for bulk operations
     */
    async executeBulkOperation(operationFn, options = {}) {
        const bulkConfig = {
            ...this.defaultConfig,
            maxAttempts: 2,
            baseDelay: 2000,
            maxDelay: 30000,
            retryableErrors: [
                'ECONNRESET',
                'ENOTFOUND',
                'ECONNREFUSED',
                'ETIMEDOUT',
                'EHOSTUNREACH',
                'ENETUNREACH',
                'EAI_AGAIN',
                'TEMPORARY_FAILURE',
                'SERVICE_UNAVAILABLE',
                'TIMEOUT',
                'AEM_UNAVAILABLE',
                'AEM_BUSY',
                'AEM_MAINTENANCE',
                'BULK_OPERATION_FAILED'
            ],
            retryableStatusCodes: [
                408, 429, 500, 502, 503, 504
            ],
            ...options.config
        };
        return this.execute(operationFn, { ...options, config: bulkConfig });
    }
    /**
     * Check if error is retryable
     */
    isRetryableError(error, config) {
        // Check error message
        const errorMessage = error.message.toLowerCase();
        for (const retryableError of config.retryableErrors) {
            if (errorMessage.includes(retryableError.toLowerCase())) {
                return true;
            }
        }
        // Check error code
        if ('code' in error) {
            const errorCode = error.code;
            if (config.retryableErrors.includes(errorCode)) {
                return true;
            }
        }
        // Check status code
        if ('status' in error) {
            const statusCode = error.status;
            if (config.retryableStatusCodes.includes(statusCode)) {
                return true;
            }
        }
        // Check if it's an AEMException
        if (error instanceof AEMException) {
            return error.retryable;
        }
        // Check Axios error
        if ('response' in error) {
            const axiosError = error;
            if (axiosError.response?.status && config.retryableStatusCodes.includes(axiosError.response.status)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Calculate delay for next attempt
     */
    calculateDelay(attempt, config) {
        // Exponential backoff: delay = baseDelay * (exponentialBase ^ (attempt - 1))
        let delay = config.baseDelay * Math.pow(config.exponentialBase, attempt - 1);
        // Cap at max delay
        delay = Math.min(delay, config.maxDelay);
        // Add jitter if enabled
        if (config.jitter) {
            // Add random jitter between 0 and 25% of the delay
            const jitter = Math.random() * 0.25 * delay;
            delay += jitter;
        }
        return Math.floor(delay);
    }
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Create retry handler with default configuration
     */
    static create(config) {
        return new RetryHandler(config);
    }
    /**
     * Create retry handler for HTTP requests
     */
    static createForHttp(config) {
        return new RetryHandler({
            maxAttempts: 5,
            baseDelay: 500,
            maxDelay: 10000,
            retryableStatusCodes: [
                408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524
            ],
            ...config
        });
    }
    /**
     * Create retry handler for AEM operations
     */
    static createForAEM(config) {
        return new RetryHandler({
            maxAttempts: 3,
            baseDelay: 1000,
            maxDelay: 15000,
            retryableErrors: [
                'ECONNRESET',
                'ENOTFOUND',
                'ECONNREFUSED',
                'ETIMEDOUT',
                'EHOSTUNREACH',
                'ENETUNREACH',
                'EAI_AGAIN',
                'TEMPORARY_FAILURE',
                'SERVICE_UNAVAILABLE',
                'TIMEOUT',
                'AEM_UNAVAILABLE',
                'AEM_BUSY',
                'AEM_MAINTENANCE'
            ],
            retryableStatusCodes: [
                408, 429, 500, 502, 503, 504
            ],
            ...config
        });
    }
    /**
     * Create retry handler for cache operations
     */
    static createForCache(config) {
        return new RetryHandler({
            maxAttempts: 2,
            baseDelay: 100,
            maxDelay: 1000,
            retryableErrors: [
                'ECONNRESET',
                'ENOTFOUND',
                'ECONNREFUSED',
                'ETIMEDOUT',
                'REDIS_CONNECTION_ERROR',
                'REDIS_TIMEOUT'
            ],
            ...config
        });
    }
    /**
     * Create retry handler for bulk operations
     */
    static createForBulk(config) {
        return new RetryHandler({
            maxAttempts: 2,
            baseDelay: 2000,
            maxDelay: 30000,
            retryableErrors: [
                'ECONNRESET',
                'ENOTFOUND',
                'ECONNREFUSED',
                'ETIMEDOUT',
                'EHOSTUNREACH',
                'ENETUNREACH',
                'EAI_AGAIN',
                'TEMPORARY_FAILURE',
                'SERVICE_UNAVAILABLE',
                'TIMEOUT',
                'AEM_UNAVAILABLE',
                'AEM_BUSY',
                'AEM_MAINTENANCE',
                'BULK_OPERATION_FAILED'
            ],
            retryableStatusCodes: [
                408, 429, 500, 502, 503, 504
            ],
            ...config
        });
    }
}
// Singleton instance
let retryHandler = null;
export function getRetryHandler(config) {
    if (!retryHandler) {
        retryHandler = new RetryHandler(config);
    }
    return retryHandler;
}
//# sourceMappingURL=retry-handler.js.map