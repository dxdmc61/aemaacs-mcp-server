/**
 * Service wrapper with circuit breaker integration and fallback mechanisms
 */
import { CircuitBreakerConfig } from './circuit-breaker.js';
export interface ServiceWrapperConfig {
    circuitBreakerConfig?: CircuitBreakerConfig;
    enableFallback: boolean;
    fallbackTimeout: number;
    retryAttempts: number;
    retryDelay: number;
    enableMetrics: boolean;
}
export interface FallbackResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    source: 'primary' | 'fallback' | 'cache';
}
export declare abstract class ServiceWrapper {
    protected serviceName: string;
    protected logger: import('./logger.js').Logger;
    protected circuitBreaker: import('./circuit-breaker.js').CircuitBreaker;
    protected config: ServiceWrapperConfig;
    protected registry: import('./circuit-breaker.js').CircuitBreakerRegistry;
    constructor(serviceName: string, config?: Partial<ServiceWrapperConfig>);
    /**
     * Execute operation with circuit breaker protection and fallback
     */
    executeWithProtection<T>(operation: () => Promise<T>, fallbackOperation?: () => Promise<T>, operationName?: string): Promise<T>;
    /**
     * Execute operation with retry logic
     */
    executeWithRetry<T>(operation: () => Promise<T>, operationName?: string): Promise<T>;
    /**
     * Execute fallback operation
     */
    private executeFallback;
    /**
     * Get circuit breaker statistics
     */
    getCircuitBreakerStats(): any;
    /**
     * Reset circuit breaker
     */
    resetCircuitBreaker(): void;
    /**
     * Force circuit breaker open
     */
    forceCircuitBreakerOpen(): void;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ServiceWrapperConfig>): void;
    /**
     * Sleep utility
     */
    private sleep;
}
/**
 * Decorator for automatically wrapping service methods with circuit breaker protection
 */
export declare function withCircuitBreaker<T extends ServiceWrapper>(target: T, propertyKey: string, descriptor: PropertyDescriptor): void;
/**
 * Decorator for automatically wrapping service methods with retry logic
 */
export declare function withRetry<T extends ServiceWrapper>(target: T, propertyKey: string, descriptor: PropertyDescriptor): void;
/**
 * Decorator for automatically wrapping service methods with fallback
 */
export declare function withFallback<T extends ServiceWrapper>(fallbackMethod: string): (target: T, propertyKey: string, descriptor: PropertyDescriptor) => void;
/**
 * Service health check interface
 */
export interface ServiceHealth {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    circuitBreakerState: string;
    lastError?: string;
    metrics?: Record<string, any>;
}
/**
 * Base class for services with health checking
 */
export declare abstract class HealthCheckableService extends ServiceWrapper {
    abstract getHealth(): Promise<ServiceHealth>;
    /**
     * Get basic health status
     */
    getBasicHealth(): Promise<ServiceHealth>;
}
//# sourceMappingURL=service-wrapper.d.ts.map
