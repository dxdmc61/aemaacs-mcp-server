/**
 * Service wrapper with circuit breaker integration and fallback mechanisms
 */
import { CircuitBreakerRegistry } from './circuit-breaker.js';
import { Logger } from './logger.js';
import { AEMException } from './errors.js';
import { ErrorType } from '../types/aem.js';
export class ServiceWrapper {
    constructor(serviceName, config) {
        this.serviceName = serviceName;
        this.logger = Logger.getInstance();
        this.registry = CircuitBreakerRegistry.getInstance();
        this.config = {
            enableFallback: true,
            fallbackTimeout: 5000,
            retryAttempts: 3,
            retryDelay: 1000,
            enableMetrics: true,
            ...config
        };
        this.circuitBreaker = this.registry.getCircuitBreaker(`${serviceName}-circuit-breaker`, this.config.circuitBreakerConfig);
    }
    /**
     * Execute operation with circuit breaker protection and fallback
     */
    async executeWithProtection(operation, fallbackOperation, operationName) {
        const opName = operationName || 'unknown';
        try {
            // Execute with circuit breaker protection
            const result = await this.circuitBreaker.execute(operation);
            if (this.config.enableMetrics) {
                this.logger.debug(`Service ${this.serviceName} operation ${opName} completed successfully`);
            }
            return result;
        }
        catch (error) {
            this.logger.warn(`Service ${this.serviceName} operation ${opName} failed`, error);
            // Try fallback if available and enabled
            if (this.config.enableFallback && fallbackOperation) {
                try {
                    const fallbackResult = await this.executeFallback(fallbackOperation, opName);
                    return fallbackResult;
                }
                catch (fallbackError) {
                    this.logger.error(`Service ${this.serviceName} fallback for ${opName} also failed`, fallbackError);
                }
            }
            throw error;
        }
    }
    /**
     * Execute operation with retry logic
     */
    async executeWithRetry(operation, operationName) {
        const opName = operationName || 'unknown';
        let lastError = null;
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                const result = await this.executeWithProtection(operation, undefined, opName);
                if (attempt > 1) {
                    this.logger.info(`Service ${this.serviceName} operation ${opName} succeeded on attempt ${attempt}`);
                }
                return result;
            }
            catch (error) {
                lastError = error;
                if (attempt < this.config.retryAttempts) {
                    const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                    this.logger.debug(`Service ${this.serviceName} operation ${opName} failed on attempt ${attempt}, retrying in ${delay}ms`);
                    await this.sleep(delay);
                }
            }
        }
        this.logger.error(`Service ${this.serviceName} operation ${opName} failed after ${this.config.retryAttempts} attempts`);
        throw lastError || new AEMException(`Operation ${opName} failed after retries`, ErrorType.SERVER_ERROR, true);
    }
    /**
     * Execute fallback operation
     */
    async executeFallback(fallbackOperation, operationName) {
        this.logger.info(`Service ${this.serviceName} executing fallback for ${operationName}`);
        // Set a timeout for fallback operations
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new AEMException(`Fallback operation ${operationName} timed out`, ErrorType.TIMEOUT_ERROR, true));
            }, this.config.fallbackTimeout);
        });
        try {
            const result = await Promise.race([
                fallbackOperation(),
                timeoutPromise
            ]);
            this.logger.info(`Service ${this.serviceName} fallback for ${operationName} completed successfully`);
            return result;
        }
        catch (error) {
            this.logger.error(`Service ${this.serviceName} fallback for ${operationName} failed`, error);
            throw error;
        }
    }
    /**
     * Get circuit breaker statistics
     */
    getCircuitBreakerStats() {
        return this.circuitBreaker.getStats();
    }
    /**
     * Reset circuit breaker
     */
    resetCircuitBreaker() {
        this.circuitBreaker.reset();
        this.logger.info(`Circuit breaker for service ${this.serviceName} reset`);
    }
    /**
     * Force circuit breaker open
     */
    forceCircuitBreakerOpen() {
        this.circuitBreaker.forceOpen();
        this.logger.warn(`Circuit breaker for service ${this.serviceName} forced open`);
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.info(`Service ${this.serviceName} configuration updated`);
    }
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
/**
 * Decorator for automatically wrapping service methods with circuit breaker protection
 */
export function withCircuitBreaker(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args) {
        const operationName = `${target.constructor.name}.${propertyKey}`;
        return target.executeWithProtection(() => originalMethod.apply(this, args), undefined, operationName);
    };
}
/**
 * Decorator for automatically wrapping service methods with retry logic
 */
export function withRetry(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args) {
        const operationName = `${target.constructor.name}.${propertyKey}`;
        return target.executeWithRetry(() => originalMethod.apply(this, args), operationName);
    };
}
/**
 * Decorator for automatically wrapping service methods with fallback
 */
export function withFallback(fallbackMethod) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const operationName = `${target.constructor.name}.${propertyKey}`;
            const fallbackOperation = target[fallbackMethod];
            if (typeof fallbackOperation !== 'function') {
                throw new Error(`Fallback method ${fallbackMethod} not found or not a function`);
            }
            return target.executeWithProtection(() => originalMethod.apply(this, args), () => fallbackOperation.apply(this, args), operationName);
        };
    };
}
/**
 * Base class for services with health checking
 */
export class HealthCheckableService extends ServiceWrapper {
    /**
     * Get basic health status
     */
    async getBasicHealth() {
        const stats = this.getCircuitBreakerStats();
        let status = 'healthy';
        if (stats.state === 'OPEN') {
            status = 'unhealthy';
        }
        else if (stats.state === 'HALF_OPEN') {
            status = 'degraded';
        }
        return {
            name: this.serviceName,
            status,
            circuitBreakerState: stats.state,
            metrics: {
                totalRequests: stats.totalRequests,
                failureCount: stats.failureCount,
                successCount: stats.successCount
            }
        };
    }
}
//# sourceMappingURL=service-wrapper.js.map