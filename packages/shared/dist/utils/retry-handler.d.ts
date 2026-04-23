/**
 * Automatic retry with exponential backoff and fallback mechanisms
 */
export interface RetryConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    exponentialBase: number;
    jitter: boolean;
    retryableErrors: string[];
    retryableStatusCodes: number[];
    timeout: number;
    fallbackEnabled: boolean;
    fallbackDelay: number;
}
export interface RetryResult<T> {
    success: boolean;
    result?: T;
    error?: Error;
    attempts: number;
    totalTime: number;
    fallbackUsed: boolean;
}
export interface RetryOptions<T = any> {
    config?: Partial<RetryConfig>;
    fallback?: () => Promise<T>;
    onRetry?: (attempt: number, error: Error) => void;
    onFallback?: (error: Error) => void;
    context?: string;
}
export declare class RetryHandler {
    private logger;
    private defaultConfig;
    constructor(defaultConfig?: Partial<RetryConfig>);
    /**
     * Execute operation with retry logic
     */
    execute<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<RetryResult<T>>;
    /**
     * Execute operation with retry for HTTP requests
     */
    executeHttpRequest<T>(requestFn: () => Promise<T>, options?: RetryOptions): Promise<RetryResult<T>>;
    /**
     * Execute operation with retry for AEM operations
     */
    executeAEMOperation<T>(operationFn: () => Promise<T>, options?: RetryOptions): Promise<RetryResult<T>>;
    /**
     * Execute operation with retry for cache operations
     */
    executeCacheOperation<T>(operationFn: () => Promise<T>, options?: RetryOptions): Promise<RetryResult<T>>;
    /**
     * Execute operation with retry for bulk operations
     */
    executeBulkOperation<T>(operationFn: () => Promise<T>, options?: RetryOptions): Promise<RetryResult<T>>;
    /**
     * Check if error is retryable
     */
    private isRetryableError;
    /**
     * Calculate delay for next attempt
     */
    private calculateDelay;
    /**
     * Sleep for specified milliseconds
     */
    private sleep;
    /**
     * Create retry handler with default configuration
     */
    static create(config?: Partial<RetryConfig>): RetryHandler;
    /**
     * Create retry handler for HTTP requests
     */
    static createForHttp(config?: Partial<RetryConfig>): RetryHandler;
    /**
     * Create retry handler for AEM operations
     */
    static createForAEM(config?: Partial<RetryConfig>): RetryHandler;
    /**
     * Create retry handler for cache operations
     */
    static createForCache(config?: Partial<RetryConfig>): RetryHandler;
    /**
     * Create retry handler for bulk operations
     */
    static createForBulk(config?: Partial<RetryConfig>): RetryHandler;
}
export declare function getRetryHandler(config?: Partial<RetryConfig>): RetryHandler;
//# sourceMappingURL=retry-handler.d.ts.map
