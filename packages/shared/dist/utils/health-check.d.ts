/**
 * Comprehensive health check system for AEMaaCS MCP servers
 */
import { AEMHttpClient } from '../client/aem-http-client.js';
import { CacheManager } from './cache.js';
import { MetricsCollector } from './metrics.js';
export interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    uptime: number;
    components: {
        server: ComponentHealth;
        aem: ComponentHealth;
        cache: ComponentHealth;
        database?: ComponentHealth;
        external_services?: ComponentHealth;
        security: ComponentHealth;
        metrics: ComponentHealth;
    };
    dependencies: {
        aem_connectivity: DependencyHealth;
        redis_cache?: DependencyHealth;
        prometheus_metrics?: DependencyHealth;
    };
    performance: {
        memory_usage: PerformanceMetric;
        cpu_usage?: PerformanceMetric;
        response_time: PerformanceMetric;
        throughput: PerformanceMetric;
    };
    business_metrics: {
        active_connections: number;
        total_requests: number;
        error_rate: number;
        cache_hit_rate: number;
    };
}
export interface ComponentHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    details?: Record<string, any>;
    last_check: string;
    response_time_ms?: number;
}
export interface DependencyHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    response_time_ms?: number;
    version?: string;
    last_check: string;
}
export interface PerformanceMetric {
    current: number;
    average: number;
    peak: number;
    threshold: number;
    unit: string;
}
export interface HealthCheckConfig {
    enabled: boolean;
    check_interval: number;
    timeout: number;
    aem_endpoint: string;
    cache_endpoint?: string;
    metrics_endpoint?: string;
    performance_thresholds: {
        memory_usage_mb: number;
        response_time_ms: number;
        error_rate_percent: number;
        cache_hit_rate_percent: number;
    };
}
export declare class HealthCheckService {
    private logger;
    private config;
    private client;
    private cacheManager?;
    private metricsCollector?;
    private startTime;
    private requestCount;
    private errorCount;
    private responseTimes;
    private lastHealthCheck?;
    constructor(config: HealthCheckConfig, client: AEMHttpClient, cacheManager?: CacheManager, metricsCollector?: MetricsCollector);
    /**
     * Perform comprehensive health check
     */
    performHealthCheck(): Promise<HealthCheckResult>;
    /**
     * Check server health
     */
    private checkServerHealth;
    /**
     * Check AEM health
     */
    private checkAEMHealth;
    /**
     * Check cache health
     */
    private checkCacheHealth;
    /**
     * Check security health
     */
    private checkSecurityHealth;
    /**
     * Check metrics health
     */
    private checkMetricsHealth;
    /**
     * Check AEM dependency
     */
    private checkAEMDependency;
    /**
     * Check cache dependency
     */
    private checkCacheDependency;
    /**
     * Check metrics dependency
     */
    private checkMetricsDependency;
    /**
     * Get performance metrics
     */
    private getPerformanceMetrics;
    /**
     * Get business metrics
     */
    private getBusinessMetrics;
    /**
     * Determine overall health status
     */
    private determineOverallStatus;
    /**
     * Get settled result from Promise.allSettled
     */
    private getSettledResult;
    /**
     * Get last health check result
     */
    getLastHealthCheck(): HealthCheckResult | undefined;
    /**
     * Get health check summary
     */
    getHealthSummary(): {
        status: string;
        message: string;
        timestamp: string;
    };
    /**
     * Get status message
     */
    private getStatusMessage;
}
//# sourceMappingURL=health-check.d.ts.map
