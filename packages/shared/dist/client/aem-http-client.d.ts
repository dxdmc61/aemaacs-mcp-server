/**
 * AEMaaCS HTTP client with authentication and advanced features
 */
import { AEMConfig, AEMResponse, OperationContext } from '../types/aem.js';
export interface RequestOptions {
    timeout?: number;
    retries?: number;
    cache?: boolean;
    cacheTtl?: number;
    circuitBreaker?: boolean;
    context?: Partial<OperationContext>;
    headers?: Record<string, string>;
}
export interface AEMHttpClientOptions {
    config?: AEMConfig;
    enableCircuitBreaker?: boolean;
    enableCaching?: boolean;
    enableRetry?: boolean;
    connectionPooling?: boolean;
}
export declare class AEMHttpClient {
    private axiosInstance;
    private logger;
    private performanceMonitor;
    private circuitBreaker?;
    private cache?;
    private responseProcessor;
    private retryHandler?;
    private config;
    private authToken?;
    private tokenExpiry?;
    constructor(options?: AEMHttpClientOptions);
    /**
     * Perform GET request
     */
    get<T = any>(path: string, params?: Record<string, any>, options?: RequestOptions): Promise<AEMResponse<T>>;
    /**
     * Perform POST request
     */
    post<T = any>(path: string, data?: any, options?: RequestOptions): Promise<AEMResponse<T>>;
    /**
     * Perform PUT request
     */
    put<T = any>(path: string, data?: any, options?: RequestOptions): Promise<AEMResponse<T>>;
    /**
     * Perform DELETE request
     */
    delete<T = any>(path: string, options?: RequestOptions): Promise<AEMResponse<T>>;
    /**
     * Upload file
     */
    upload<T = any>(path: string, file: Buffer, metadata?: Record<string, any>, options?: RequestOptions): Promise<AEMResponse<T>>;
    /**
     * Generic request method
     */
    private request;
    /**
     * Create axios instance with configuration
     */
    private createAxiosInstance;
    /**
     * Setup request interceptors
     */
    private setupRequestInterceptors;
    /**
     * Setup response interceptors
     */
    private setupResponseInterceptors;
    /**
     * Ensure authentication is valid
     */
    private ensureAuthenticated;
    /**
     * Refresh authentication token
     */
    private refreshAuthToken;
    /**
     * Refresh OAuth token
     */
    private refreshOAuthToken;
    /**
     * Refresh service account token
     */
    private refreshServiceAccountToken;
    /**
     * Generate JWT for service account authentication
     */
    private generateServiceAccountJWT;
    /**
     * Get authentication headers
     */
    private getAuthHeaders;
    /**
     * Build full URL
     */
    private buildUrl;
    /**
     * Generate cache key
     */
    private generateCacheKey;
    /**
     * Get client statistics
     */
    getStats(): {
        circuitBreaker?: any;
        cache?: any;
        performance?: any;
    };
    /**
     * Clear cache
     */
    clearCache(pattern?: string): Promise<void>;
    /**
     * Reset circuit breaker
     */
    resetCircuitBreaker(): void;
    /**
     * Close client and cleanup resources
     */
    close(): Promise<void>;
}
/**
 * Factory function to create AEM HTTP client
 */
export declare function createAEMHttpClient(options?: AEMHttpClientOptions): AEMHttpClient;
//# sourceMappingURL=aem-http-client.d.ts.map