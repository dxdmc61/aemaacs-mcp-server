/**
 * Prometheus metrics collection for AEMaaCS MCP servers
 */

import { Logger } from './logger.js';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge, Summary } from 'prom-client';

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

export class MetricsCollector {
  private logger: Logger;
  private config: MetricsConfig;
  private customMetrics: Map<string, any> = new Map();

  // HTTP Metrics
  private httpRequestCounter?: Counter<string>;
  private httpRequestDuration?: Histogram<string>;
  private httpRequestSize?: Histogram<string>;
  private httpResponseSize?: Histogram<string>;

  // AEM Operation Metrics
  private aemOperationCounter?: Counter<string>;
  private aemOperationDuration?: Histogram<string>;
  private aemOperationErrors?: Counter<string>;

  // Cache Metrics
  private cacheHitCounter?: Counter<string>;
  private cacheMissCounter?: Counter<string>;
  private cacheOperationDuration?: Histogram<string>;

  // Circuit Breaker Metrics
  private circuitBreakerState?: Gauge<string>;
  private circuitBreakerFailures?: Counter<string>;
  private circuitBreakerSuccesses?: Counter<string>;

  // Bulk Operation Metrics
  private bulkOperationCounter?: Counter<string>;
  private bulkOperationDuration?: Histogram<string>;
  private bulkOperationItems?: Summary<string>;

  // Security Metrics
  private securityEventCounter?: Counter<string>;
  private authenticationAttempts?: Counter<string>;
  private authorizationFailures?: Counter<string>;

  // Business Metrics
  private businessMetricsGauge?: Gauge<string>;

  constructor(config?: Partial<MetricsConfig>) {
    this.logger = Logger.getInstance();
    this.config = {
      enabled: true,
      collectDefaultMetrics: true,
      defaultMetricsPrefix: 'aem_mcp_clean_',
      defaultMetricsTimeout: 5000,
      customMetrics: {
        httpRequests: true,
        aemOperations: true,
        cacheOperations: true,
        circuitBreaker: true,
        bulkOperations: true,
        securityEvents: true,
        businessMetrics: true
      },
      ...config
    };

    if (this.config.enabled) {
      this.initializeMetrics();
    }
  }

  /**
   * Initialize Prometheus metrics
   */
  private initializeMetrics(): void {
    try {
      // Collect default metrics if enabled
      if (this.config.collectDefaultMetrics) {
        collectDefaultMetrics({
          prefix: this.config.defaultMetricsPrefix
        });
      }

      // Initialize HTTP metrics
      if (this.config.customMetrics.httpRequests) {
        this.initializeHttpMetrics();
      }

      // Initialize AEM operation metrics
      if (this.config.customMetrics.aemOperations) {
        this.initializeAEMOperationMetrics();
      }

      // Initialize cache metrics
      if (this.config.customMetrics.cacheOperations) {
        this.initializeCacheMetrics();
      }

      // Initialize circuit breaker metrics
      if (this.config.customMetrics.circuitBreaker) {
        this.initializeCircuitBreakerMetrics();
      }

      // Initialize bulk operation metrics
      if (this.config.customMetrics.bulkOperations) {
        this.initializeBulkOperationMetrics();
      }

      // Initialize security metrics
      if (this.config.customMetrics.securityEvents) {
        this.initializeSecurityMetrics();
      }

      // Initialize business metrics
      if (this.config.customMetrics.businessMetrics) {
        this.initializeBusinessMetrics();
      }

      this.logger.info('Prometheus metrics initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Prometheus metrics', error as Error);
    }
  }

  /**
   * Initialize HTTP metrics
   */
  private initializeHttpMetrics(): void {
    this.httpRequestCounter = new Counter({
      name: 'aem_mcp_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'server_type']
    });

    this.httpRequestDuration = new Histogram({
      name: 'aem_mcp_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code', 'server_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
    });

    this.httpRequestSize = new Histogram({
      name: 'aem_mcp_http_request_size_bytes',
      help: 'HTTP request size in bytes',
      labelNames: ['method', 'route', 'server_type'],
      buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600]
    });

    this.httpResponseSize = new Histogram({
      name: 'aem_mcp_http_response_size_bytes',
      help: 'HTTP response size in bytes',
      labelNames: ['method', 'route', 'status_code', 'server_type'],
      buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600]
    });
  }

  /**
   * Initialize AEM operation metrics
   */
  private initializeAEMOperationMetrics(): void {
    this.aemOperationCounter = new Counter({
      name: 'aem_mcp_aem_operations_total',
      help: 'Total number of AEM operations',
      labelNames: ['operation', 'resource_type', 'status', 'server_type']
    });

    this.aemOperationDuration = new Histogram({
      name: 'aem_mcp_aem_operation_duration_seconds',
      help: 'AEM operation duration in seconds',
      labelNames: ['operation', 'resource_type', 'status', 'server_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
    });

    this.aemOperationErrors = new Counter({
      name: 'aem_mcp_aem_operation_errors_total',
      help: 'Total number of AEM operation errors',
      labelNames: ['operation', 'resource_type', 'error_type', 'server_type']
    });
  }

  /**
   * Initialize cache metrics
   */
  private initializeCacheMetrics(): void {
    this.cacheHitCounter = new Counter({
      name: 'aem_mcp_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type', 'operation']
    });

    this.cacheMissCounter = new Counter({
      name: 'aem_mcp_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type', 'operation']
    });

    this.cacheOperationDuration = new Histogram({
      name: 'aem_mcp_cache_operation_duration_seconds',
      help: 'Cache operation duration in seconds',
      labelNames: ['cache_type', 'operation', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
    });
  }

  /**
   * Initialize circuit breaker metrics
   */
  private initializeCircuitBreakerMetrics(): void {
    this.circuitBreakerState = new Gauge({
      name: 'aem_mcp_circuit_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
      labelNames: ['breaker_name', 'server_type']
    });

    this.circuitBreakerFailures = new Counter({
      name: 'aem_mcp_circuit_breaker_failures_total',
      help: 'Total number of circuit breaker failures',
      labelNames: ['breaker_name', 'error_type', 'server_type']
    });

    this.circuitBreakerSuccesses = new Counter({
      name: 'aem_mcp_circuit_breaker_successes_total',
      help: 'Total number of circuit breaker successes',
      labelNames: ['breaker_name', 'server_type']
    });
  }

  /**
   * Initialize bulk operation metrics
   */
  private initializeBulkOperationMetrics(): void {
    this.bulkOperationCounter = new Counter({
      name: 'aem_mcp_bulk_operations_total',
      help: 'Total number of bulk operations',
      labelNames: ['operation_type', 'status', 'server_type']
    });

    this.bulkOperationDuration = new Histogram({
      name: 'aem_mcp_bulk_operation_duration_seconds',
      help: 'Bulk operation duration in seconds',
      labelNames: ['operation_type', 'status', 'server_type'],
      buckets: [1, 5, 10, 30, 60, 300, 600, 1800]
    });

    this.bulkOperationItems = new Summary({
      name: 'aem_mcp_bulk_operation_items',
      help: 'Number of items processed in bulk operations',
      labelNames: ['operation_type', 'server_type'],
      percentiles: [0.5, 0.9, 0.95, 0.99]
    });
  }

  /**
   * Initialize security metrics
   */
  private initializeSecurityMetrics(): void {
    this.securityEventCounter = new Counter({
      name: 'aem_mcp_security_events_total',
      help: 'Total number of security events',
      labelNames: ['event_type', 'severity', 'server_type']
    });

    this.authenticationAttempts = new Counter({
      name: 'aem_mcp_authentication_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['auth_type', 'status', 'server_type']
    });

    this.authorizationFailures = new Counter({
      name: 'aem_mcp_authorization_failures_total',
      help: 'Total number of authorization failures',
      labelNames: ['resource_type', 'operation', 'server_type']
    });
  }

  /**
   * Initialize business metrics
   */
  private initializeBusinessMetrics(): void {
    this.businessMetricsGauge = new Gauge({
      name: 'aem_mcp_business_metrics',
      help: 'Business metrics for AEM operations',
      labelNames: ['metric_type', 'server_type']
    });
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    requestSize?: number,
    responseSize?: number,
    serverType: string = 'unknown'
  ): void {
    if (!this.config.enabled || !this.config.customMetrics.httpRequests) {
      return;
    }

    try {
      const labels = {
        method,
        route,
        status_code: statusCode.toString(),
        server_type: serverType
      };

      this.httpRequestCounter?.inc(labels);
      this.httpRequestDuration?.observe(labels, duration / 1000);

      if (requestSize !== undefined) {
        this.httpRequestSize?.observe({
          method,
          route,
          server_type: serverType
        }, requestSize);
      }

      if (responseSize !== undefined) {
        this.httpResponseSize?.observe(labels, responseSize);
      }
    } catch (error) {
      this.logger.warn('Failed to record HTTP request metrics', error as Error);
    }
  }

  /**
   * Record AEM operation metrics
   */
  recordAEMOperation(
    operation: string,
    resourceType: string,
    status: string,
    duration: number,
    serverType: string = 'unknown'
  ): void {
    if (!this.config.enabled || !this.config.customMetrics.aemOperations) {
      return;
    }

    try {
      const labels = {
        operation,
        resource_type: resourceType,
        status,
        server_type: serverType
      };

      this.aemOperationCounter?.inc(labels);
      this.aemOperationDuration?.observe(labels, duration / 1000);
    } catch (error) {
      this.logger.warn('Failed to record AEM operation metrics', error as Error);
    }
  }

  /**
   * Record AEM operation error
   */
  recordAEMOperationError(
    operation: string,
    resourceType: string,
    errorType: string,
    serverType: string = 'unknown'
  ): void {
    if (!this.config.enabled || !this.config.customMetrics.aemOperations) {
      return;
    }

    try {
      this.aemOperationErrors?.inc({
        operation,
        resource_type: resourceType,
        error_type: errorType,
        server_type: serverType
      });
    } catch (error) {
      this.logger.warn('Failed to record AEM operation error metrics', error as Error);
    }
  }

  /**
   * Record cache operation metrics
   */
  recordCacheOperation(
    cacheType: string,
    operation: string,
    hit: boolean,
    duration: number
  ): void {
    if (!this.config.enabled || !this.config.customMetrics.cacheOperations) {
      return;
    }

    try {
      const labels = {
        cache_type: cacheType,
        operation
      };

      if (hit) {
        this.cacheHitCounter?.inc(labels);
      } else {
        this.cacheMissCounter?.inc(labels);
      }

      this.cacheOperationDuration?.observe({
        ...labels,
        status: hit ? 'hit' : 'miss'
      }, duration / 1000);
    } catch (error) {
      this.logger.warn('Failed to record cache operation metrics', error as Error);
    }
  }

  /**
   * Record circuit breaker metrics
   */
  recordCircuitBreakerState(
    breakerName: string,
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN',
    serverType: string = 'unknown'
  ): void {
    if (!this.config.enabled || !this.config.customMetrics.circuitBreaker) {
      return;
    }

    try {
      const stateValue = state === 'CLOSED' ? 0 : state === 'OPEN' ? 1 : 2;
      
      this.circuitBreakerState?.set({
        breaker_name: breakerName,
        server_type: serverType
      }, stateValue);
    } catch (error) {
      this.logger.warn('Failed to record circuit breaker state metrics', error as Error);
    }
  }

  /**
   * Record circuit breaker failure
   */
  recordCircuitBreakerFailure(
    breakerName: string,
    errorType: string,
    serverType: string = 'unknown'
  ): void {
    if (!this.config.enabled || !this.config.customMetrics.circuitBreaker) {
      return;
    }

    try {
      this.circuitBreakerFailures?.inc({
        breaker_name: breakerName,
        error_type: errorType,
        server_type: serverType
      });
    } catch (error) {
      this.logger.warn('Failed to record circuit breaker failure metrics', error as Error);
    }
  }

  /**
   * Record circuit breaker success
   */
  recordCircuitBreakerSuccess(
    breakerName: string,
    serverType: string = 'unknown'
  ): void {
    if (!this.config.enabled || !this.config.customMetrics.circuitBreaker) {
      return;
    }

    try {
      this.circuitBreakerSuccesses?.inc({
        breaker_name: breakerName,
        server_type: serverType
      });
    } catch (error) {
      this.logger.warn('Failed to record circuit breaker success metrics', error as Error);
    }
  }

  /**
   * Record bulk operation metrics
   */
  recordBulkOperation(
    operationType: string,
    status: string,
    duration: number,
    itemCount: number,
    serverType: string = 'unknown'
  ): void {
    if (!this.config.enabled || !this.config.customMetrics.bulkOperations) {
      return;
    }

    try {
      const labels = {
        operation_type: operationType,
        status,
        server_type: serverType
      };

      this.bulkOperationCounter?.inc(labels);
      this.bulkOperationDuration?.observe(labels, duration / 1000);
      this.bulkOperationItems?.observe({
        operation_type: operationType,
        server_type: serverType
      }, itemCount);
    } catch (error) {
      this.logger.warn('Failed to record bulk operation metrics', error as Error);
    }
  }

  /**
   * Record security event metrics
   */
  recordSecurityEvent(
    eventType: string,
    severity: string,
    serverType: string = 'unknown'
  ): void {
    if (!this.config.enabled || !this.config.customMetrics.securityEvents) {
      return;
    }

    try {
      this.securityEventCounter?.inc({
        event_type: eventType,
        severity,
        server_type: serverType
      });
    } catch (error) {
      this.logger.warn('Failed to record security event metrics', error as Error);
    }
  }

  /**
   * Record authentication attempt
   */
  recordAuthenticationAttempt(
    authType: string,
    status: string,
    serverType: string = 'unknown'
  ): void {
    if (!this.config.enabled || !this.config.customMetrics.securityEvents) {
      return;
    }

    try {
      this.authenticationAttempts?.inc({
        auth_type: authType,
        status,
        server_type: serverType
      });
    } catch (error) {
      this.logger.warn('Failed to record authentication attempt metrics', error as Error);
    }
  }

  /**
   * Record authorization failure
   */
  recordAuthorizationFailure(
    resourceType: string,
    operation: string,
    serverType: string = 'unknown'
  ): void {
    if (!this.config.enabled || !this.config.customMetrics.securityEvents) {
      return;
    }

    try {
      this.authorizationFailures?.inc({
        resource_type: resourceType,
        operation,
        server_type: serverType
      });
    } catch (error) {
      this.logger.warn('Failed to record authorization failure metrics', error as Error);
    }
  }

  /**
   * Record business metrics
   */
  recordBusinessMetrics(metrics: BusinessMetrics, serverType: string = 'unknown'): void {
    if (!this.config.enabled || !this.config.customMetrics.businessMetrics) {
      return;
    }

    try {
      const metricEntries = Object.entries(metrics);
      for (const [metricType, value] of metricEntries) {
        this.businessMetricsGauge?.set({
          metric_type: metricType,
          server_type: serverType
        }, value);
      }
    } catch (error) {
      this.logger.warn('Failed to record business metrics', error as Error);
    }
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    try {
      return await register.metrics();
    } catch (error) {
      this.logger.error('Failed to get metrics', error as Error);
      return '';
    }
  }

  /**
   * Get metrics registry
   */
  getRegistry() {
    return register;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MetricsConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Metrics configuration updated');
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    try {
      register.clear();
      this.initializeMetrics();
      this.logger.info('Metrics reset successfully');
    } catch (error) {
      this.logger.error('Failed to reset metrics', error as Error);
    }
  }
}

// Singleton instance
let metricsCollector: MetricsCollector | null = null;

export function getMetricsCollector(config?: Partial<MetricsConfig>): MetricsCollector {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector(config);
  }
  return metricsCollector;
}
