/**
 * Prometheus metrics collection for AEMaaCS MCP servers
 */
export interface MetricsConfig {
    enabled: boolean;
    collectDefaultMetrics: boolean;
    defaultMetricsPrefix?: string;
    defaultMetricsTimeout?: number;
    customMetrics: {
        httpRequests: boolean;
        aemOperations: boolean;
        cacheOperations: boolean;
        circuitBreaker: boolean;
        bulkOperations: boolean;
        securityEvents: boolean;
        businessMetrics: boolean;
    };
}
export interface BusinessMetrics {
    pagesCreated: number;
    pagesUpdated: number;
    pagesDeleted: number;
    assetsUploaded: number;
    workflowsStarted: number;
    workflowsCompleted: number;
    contentFragmentsCreated: number;
    contentFragmentsUpdated: number;
    usersCreated: number;
    usersUpdated: number;
}
export declare class MetricsCollector {
    private logger;
    private config;
    private customMetrics;
    private httpRequestCounter?;
    private httpRequestDuration?;
    private httpRequestSize?;
    private httpResponseSize?;
    private aemOperationCounter?;
    private aemOperationDuration?;
    private aemOperationErrors?;
    private cacheHitCounter?;
    private cacheMissCounter?;
    private cacheOperationDuration?;
    private circuitBreakerState?;
    private circuitBreakerFailures?;
    private circuitBreakerSuccesses?;
    private bulkOperationCounter?;
    private bulkOperationDuration?;
    private bulkOperationItems?;
    private securityEventCounter?;
    private authenticationAttempts?;
    private authorizationFailures?;
    private businessMetricsGauge?;
    constructor(config?: Partial<MetricsConfig>);
    /**
     * Initialize Prometheus metrics
     */
    private initializeMetrics;
    /**
     * Initialize HTTP metrics
     */
    private initializeHttpMetrics;
    /**
     * Initialize AEM operation metrics
     */
    private initializeAEMOperationMetrics;
    /**
     * Initialize cache metrics
     */
    private initializeCacheMetrics;
    /**
     * Initialize circuit breaker metrics
     */
    private initializeCircuitBreakerMetrics;
    /**
     * Initialize bulk operation metrics
     */
    private initializeBulkOperationMetrics;
    /**
     * Initialize security metrics
     */
    private initializeSecurityMetrics;
    /**
     * Initialize business metrics
     */
    private initializeBusinessMetrics;
    /**
     * Record HTTP request metrics
     */
    recordHttpRequest(method: string, route: string, statusCode: number, duration: number, requestSize?: number, responseSize?: number, serverType?: string): void;
    /**
     * Record AEM operation metrics
     */
    recordAEMOperation(operation: string, resourceType: string, status: string, duration: number, serverType?: string): void;
    /**
     * Record AEM operation error
     */
    recordAEMOperationError(operation: string, resourceType: string, errorType: string, serverType?: string): void;
    /**
     * Record cache operation metrics
     */
    recordCacheOperation(cacheType: string, operation: string, hit: boolean, duration: number): void;
    /**
     * Record circuit breaker metrics
     */
    recordCircuitBreakerState(breakerName: string, state: 'CLOSED' | 'OPEN' | 'HALF_OPEN', serverType?: string): void;
    /**
     * Record circuit breaker failure
     */
    recordCircuitBreakerFailure(breakerName: string, errorType: string, serverType?: string): void;
    /**
     * Record circuit breaker success
     */
    recordCircuitBreakerSuccess(breakerName: string, serverType?: string): void;
    /**
     * Record bulk operation metrics
     */
    recordBulkOperation(operationType: string, status: string, duration: number, itemCount: number, serverType?: string): void;
    /**
     * Record security event metrics
     */
    recordSecurityEvent(eventType: string, severity: string, serverType?: string): void;
    /**
     * Record authentication attempt
     */
    recordAuthenticationAttempt(authType: string, status: string, serverType?: string): void;
    /**
     * Record authorization failure
     */
    recordAuthorizationFailure(resourceType: string, operation: string, serverType?: string): void;
    /**
     * Record business metrics
     */
    recordBusinessMetrics(metrics: BusinessMetrics, serverType?: string): void;
    /**
     * Get metrics in Prometheus format
     */
    getMetrics(): Promise<string>;
    /**
     * Get metrics registry
     */
    getRegistry(): import('prom-client').Registry;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<MetricsConfig>): void;
    /**
     * Reset all metrics
     */
    resetMetrics(): void;
}
export declare function getMetricsCollector(config?: Partial<MetricsConfig>): MetricsCollector;
//# sourceMappingURL=metrics.d.ts.map
