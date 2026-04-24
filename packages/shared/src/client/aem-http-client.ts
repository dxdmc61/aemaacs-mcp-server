/**
 * AEMaaCS HTTP client with authentication and advanced features
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { AEMConfig, AEMCredentials, AEMResponse, OperationContext, ErrorType } from '../types/aem.js';
import { Logger, PerformanceMonitor } from '../utils/logger.js';
import { AEMException, RetryHandler, ErrorRetryConfig } from '../utils/errors.js';
import { CircuitBreaker, CircuitBreakerRegistry } from '../utils/circuit-breaker.js';
import { CacheFactory, CacheManager } from '../utils/cache.js';
import { ResponseProcessor } from '../utils/response-processor.js';
import { ConfigManager } from '../config/index.js';
import { randomUUID } from 'crypto';

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

export class AEMHttpClient {
  private axiosInstance: AxiosInstance;
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private circuitBreaker?: CircuitBreaker;
  private cache?: CacheManager;
  private responseProcessor: ResponseProcessor;
  private retryHandler?: RetryHandler;
  private config: AEMConfig;
  private authToken?: string;
  private tokenExpiry?: Date;

  constructor(options: AEMHttpClientOptions = {}) {
    this.config = options.config || ConfigManager.getInstance().getAEMConfig();
    this.logger = Logger.getInstance();
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.responseProcessor = new ResponseProcessor();
    
    // Initialize cache if enabled
    if (options.enableCaching !== false) {
      this.cache = CacheFactory.getInstance();
    }

    // Initialize circuit breaker if enabled
    if (options.enableCircuitBreaker !== false) {
      this.circuitBreaker = CircuitBreakerRegistry.getInstance().getCircuitBreaker(
        `aem-${this.config.host}:${this.config.port}`,
        {
          failureThreshold: 5,
          recoveryTimeout: 60000,
          monitoringPeriod: 300000
        }
      );
    }

    // Initialize retry handler if enabled
    if (options.enableRetry !== false) {
      const retryConfig: ErrorRetryConfig = {
        maxAttempts: this.config.retryAttempts,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.TIMEOUT_ERROR, ErrorType.SERVER_ERROR]
      };
      this.retryHandler = new RetryHandler(retryConfig);
    }

    // Create axios instance
    this.axiosInstance = this.createAxiosInstance(options);
    
    // Set up interceptors
    this.setupRequestInterceptors();
    this.setupResponseInterceptors();
  }

  /**
   * Perform GET request
   */
  async get<T = any>(path: string, params?: Record<string, any>, options?: RequestOptions): Promise<AEMResponse<T>> {
    return this.request<T>('GET', path, undefined, { ...options, params });
  }

  /**
   * Perform POST request
   */
  async post<T = any>(path: string, data?: any, options?: RequestOptions): Promise<AEMResponse<T>> {
    return this.request<T>('POST', path, data, options);
  }

  /**
   * Perform PUT request
   */
  async put<T = any>(path: string, data?: any, options?: RequestOptions): Promise<AEMResponse<T>> {
    return this.request<T>('PUT', path, data, options);
  }

  /**
   * Perform DELETE request
   */
  async delete<T = any>(path: string, options?: RequestOptions): Promise<AEMResponse<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  /**
   * Upload file
   */
  async upload<T = any>(
    path: string, 
    file: Buffer, 
    metadata?: Record<string, any>,
    options?: RequestOptions
  ): Promise<AEMResponse<T>> {
    const formData = new FormData();
    
    // Add file
    const blob = new Blob([file], { type: metadata?.mimeType || 'application/octet-stream' });
    formData.append('file', blob, metadata?.filename || 'upload');
    
    // Add metadata
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        if (key !== 'filename' && key !== 'mimeType') {
          formData.append(key, String(value));
        }
      }
    }

    return this.request<T>('POST', path, formData, {
      ...options,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...options?.headers
      }
    });
  }

  /**
   * Generic request method
   */
  private async request<T>(
    method: string,
    path: string,
    data?: any,
    options: RequestOptions & { params?: Record<string, any>; headers?: Record<string, string> } = {}
  ): Promise<AEMResponse<T>> {
    const context: OperationContext = {
      requestId: randomUUID(),
      operation: `${method} ${path}`,
      resource: path,
      timestamp: new Date(),
      ...options.context
    };

    const timer = this.performanceMonitor.startOperation(context.requestId, context.operation);

    try {
      // Check cache for GET requests
      if (method === 'GET' && options.cache !== false && this.cache) {
        const cacheKey = this.generateCacheKey(method, path, options.params);
        const cached = await this.cache.get<T>(cacheKey);
        if (cached !== null) {
          const duration = timer.end(true);
          this.logger.debug('Cache hit', { 
            requestId: context.requestId, 
            cacheKey, 
            duration 
          });
          return this.responseProcessor.processSuccess(cached, context.requestId, duration, true);
        }
      }

      // Execute request with circuit breaker and retry
      const executeRequest = async (): Promise<AxiosResponse<any>> => {
        await this.ensureAuthenticated();
        
        const requestConfig: AxiosRequestConfig = {
          method,
          url: this.buildUrl(path),
          data,
          params: options.params,
          timeout: options.timeout || this.config.timeout,
          headers: {
            ...this.getAuthHeaders(),
            ...options.headers
          }
        };

        return this.axiosInstance.request(requestConfig);
      };

      let response: AxiosResponse<any>;

      // Use circuit breaker if enabled
      if (this.circuitBreaker && options.circuitBreaker !== false) {
        response = await this.circuitBreaker.execute(executeRequest);
      } else {
        response = await executeRequest();
      }

      // Use retry handler if enabled
      if (this.retryHandler && options.retries !== 0) {
        response = await this.retryHandler.executeWithRetry(
          () => this.circuitBreaker ? this.circuitBreaker.execute(executeRequest) : executeRequest(),
          context
        );
      }

      // Check HTTP status code - axios doesn't throw on 4xx by default
      if (response.status >= 400) {
        const errorMessage = response.status === 401 || response.status === 403
          ? `Authentication failed (HTTP ${response.status})`
          : `HTTP ${response.status}: ${response.statusText || 'Request failed'}`;
        
        const httpError = new Error(`HTTP ${response.status}: ${response.statusText || 'Request failed'}`);
        this.logger.error('AEM HTTP error response', httpError, {
          requestId: context.requestId,
          status: response.status,
          statusText: response.statusText,
          url: response.config?.url,
          responseBody: typeof response.data === 'string' 
            ? response.data.substring(0, 500)
            : JSON.stringify(response.data).substring(0, 500),
          headers: response.headers
        });

        throw new AEMException(
          errorMessage,
          response.status === 401 || response.status === 403 ? 'AUTHENTICATION_ERROR' : 'SERVER_ERROR',
          response.status >= 500, // Retry on server errors
          undefined,
          {
            statusCode: response.status,
            statusText: response.statusText,
            responseBody: response.data,
            responseHeaders: response.headers
          }
        );
      }

      // Check if response is HTML (login page) instead of JSON
      const contentType = response.headers['content-type'] || '';
      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      if (contentType.includes('text/html') || responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        const htmlError = new Error('AEM returned HTML instead of JSON - likely authentication issue');
        this.logger.error('AEM returned HTML instead of JSON - likely authentication issue', htmlError, {
          requestId: context.requestId,
          url: response.config?.url,
          contentType,
          responsePreview: responseText.substring(0, 200)
        });

        throw new AEMException(
          'Authentication failed: AEM returned login page instead of JSON',
          'AUTHENTICATION_ERROR',
          false,
          undefined,
          {
            statusCode: response.status,
            contentType,
            responsePreview: responseText.substring(0, 500)
          }
        );
      }

      // Process AEM-specific response
      const processedData = this.responseProcessor.processAEMResponse(response.data, context.operation);

      // Cache successful GET responses
      if (method === 'GET' && options.cache !== false && this.cache) {
        const cacheKey = this.generateCacheKey(method, path, options.params);
        const ttl = options.cacheTtl || 300000; // 5 minutes default
        await this.cache.set(cacheKey, processedData, ttl);
      }

      const duration = timer.end(true);
      return this.responseProcessor.processSuccess(processedData, context.requestId, duration, false);

    } catch (error) {
      const duration = timer.end(false);
      this.logger.error('AEM request failed', error as Error, {
        requestId: context.requestId,
        method,
        path,
        duration
      });

      return this.responseProcessor.processError(error as Error, context.requestId, duration) as AEMResponse<T>;
    }
  }

  /**
   * Create axios instance with configuration
   */
  private createAxiosInstance(options: AEMHttpClientOptions): AxiosInstance {
    const config: AxiosRequestConfig = {
      baseURL: `${this.config.protocol}://${this.config.host}:${this.config.port}${this.config.basePath || ''}`,
      timeout: this.config.timeout,
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    };

    // Configure connection pooling
    if (options.connectionPooling !== false) {
      const httpAgent = new HttpAgent({
        keepAlive: true,
        maxSockets: 10,
        maxFreeSockets: 5,
        timeout: 60000
      });

      const httpsAgent = new HttpsAgent({
        keepAlive: true,
        maxSockets: 10,
        maxFreeSockets: 5,
        timeout: 60000,
        rejectUnauthorized: true
      });
      config.httpAgent = httpAgent;
      config.httpsAgent = httpsAgent;
    }

    return axios.create(config);
  }

  /**
   * Setup request interceptors
   */
  private setupRequestInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const requestId = randomUUID();
        config.headers['X-Request-ID'] = requestId;
        (config as any).metadata = { requestId, startTime: Date.now() };

        // Log request headers for debugging authentication issues
        const cookieHeader = config.headers?.['Cookie'];
        const authHeader = config.headers?.['Authorization'];
        const userAgentHeader = config.headers?.['User-Agent'];
        
        const authHeaders = {
          cookie: (typeof cookieHeader === 'string' && cookieHeader) ? 
            `${cookieHeader.substring(0, 100)  }...` : 
            'NOT SET',
          authorization: (typeof authHeader === 'string' && authHeader) ? 
            `${authHeader.substring(0, 50)  }...` : 
            'NOT SET',
          userAgent: (typeof userAgentHeader === 'string' && userAgentHeader) ? 
            userAgentHeader : 
            'NOT SET'
        };

        this.logger.debug('AEM request started', {
          requestId,
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params,
          authHeaders
        });

        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Setup response interceptors
   */
  private setupResponseInterceptors(): void {
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const requestId = (response.config as any).metadata?.requestId;
        const startTime = (response.config as any).metadata?.startTime;
        const duration = startTime ? Date.now() - startTime : 0;

        this.logger.debug('AEM request completed', {
          requestId,
          status: response.status,
          duration,
          url: response.config.url
        });

        return response;
      },
      (error: AxiosError) => {
        const requestId = (error.config as any)?.metadata?.requestId;
        const startTime = (error.config as any)?.metadata?.startTime;
        const duration = startTime ? Date.now() - startTime : 0;

        // Extract response details for better error reporting
        const statusCode = error.response?.status;
        const responseData = error.response?.data;
        const responseHeaders = error.response?.headers;
        
        // Extract request headers for debugging
        const cookieHeader = error.config?.headers?.['Cookie'];
        const authHeader = error.config?.headers?.['Authorization'];
        const userAgentHeader = error.config?.headers?.['User-Agent'];
        
        const requestHeaders = {
          cookie: (typeof cookieHeader === 'string' && cookieHeader) ? 
            `${cookieHeader.substring(0, 100)  }...` : 
            'NOT SET',
          authorization: (typeof authHeader === 'string' && authHeader) ? 
            `${authHeader.substring(0, 50)  }...` : 
            'NOT SET',
          userAgent: (typeof userAgentHeader === 'string' && userAgentHeader) ? 
            userAgentHeader : 
            'NOT SET'
        };

        // Log detailed error information
        this.logger.error('AEM request failed', error, {
          requestId,
          status: statusCode,
          statusText: error.response?.statusText,
          duration,
          url: error.config?.url,
          method: error.config?.method?.toUpperCase(),
          message: error.message,
          responseBody: typeof responseData === 'string' 
            ? responseData.substring(0, 500) // First 500 chars
            : JSON.stringify(responseData).substring(0, 500),
          requestHeaders,
          wwwAuthenticate: responseHeaders?.['www-authenticate'] || 'NOT SET'
        });

        // Convert Axios error to AEMException with more context
        if (statusCode === 401 || statusCode === 403) {
          const authException = new AEMException(
            `Authentication failed: ${error.message}`,
            'AUTHENTICATION_ERROR',
            false,
            undefined,
            {
              statusCode,
              responseBody: responseData,
              originalError: error
            }
          );
          return Promise.reject(authException);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Ensure authentication is valid
   */
  private async ensureAuthenticated(): Promise<void> {
    const auth = this.config.authentication;
    
    // Token auth - use the provided access token directly, no refresh needed
    if (auth.type === 'token') {
      if (!auth.accessToken) {
        throw new AEMException(
          'Access token is required for token authentication',
          'AUTHENTICATION_ERROR',
          false
        );
      }
      // Token is provided directly, no refresh needed
      return;
    }
    
    // Basic auth is handled in headers
    if (auth.type === 'basic') {
      return;
    }

    // OAuth and service-account need token refresh
    if (auth.type === 'oauth' || auth.type === 'service-account') {
      // Check if token is expired
      if (!this.authToken || (this.tokenExpiry && new Date() >= this.tokenExpiry)) {
        await this.refreshAuthToken();
      }
    }
  }

  /**
   * Refresh authentication token
   */
  private async refreshAuthToken(): Promise<void> {
    const auth = this.config.authentication;

    try {
      if (auth.type === 'oauth') {
        await this.refreshOAuthToken(auth);
      } else if (auth.type === 'service-account') {
        await this.refreshServiceAccountToken(auth);
      }
    } catch (error) {
      this.logger.error('Failed to refresh auth token', error as Error);
      throw new AEMException(
        'Authentication failed',
        'AUTHENTICATION_ERROR',
        false,
        undefined,
        { originalError: error }
      );
    }
  }

  /**
   * Refresh OAuth token
   */
  private async refreshOAuthToken(auth: AEMCredentials): Promise<void> {
    try {
      this.logger.debug('Refreshing OAuth token');
      
      if (!auth.clientId || !auth.clientSecret) {
        throw new Error('OAuth client ID and secret are required');
      }

      // For AEMaaCS, we need to use Adobe IMS for token exchange
      const tokenEndpoint = 'https://ims-na1.adobelogin.com/ims/token/v3';
      
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', auth.clientId);
      params.append('client_secret', auth.clientSecret);
      params.append('scope', 'openid,AdobeID,read_organizations,additional_info.projectedProductContext');

      const response = await this.axiosInstance.post(tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      if (!response.data || !response.data.access_token) {
        throw new Error('Invalid OAuth response: missing access token');
      }

      this.authToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
      
      this.logger.debug('OAuth token refreshed successfully', {
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type
      });

    } catch (error) {
      this.logger.error('Failed to refresh OAuth token', error as Error);
      throw new AEMException(
        'OAuth token refresh failed',
        'AUTHENTICATION_ERROR',
        true,
        60000, // Retry after 1 minute
        { originalError: error }
      );
    }
  }

  /**
   * Refresh service account token
   */
  private async refreshServiceAccountToken(auth: AEMCredentials): Promise<void> {
    try {
      this.logger.debug('Refreshing service account token');
      
      if (!auth.clientId || !auth.clientSecret) {
        throw new Error('Service account client ID and secret are required');
      }

      // For AEMaaCS service accounts, we need to generate a JWT and exchange it for an access token
      const jwt = this.generateServiceAccountJWT(auth);
      
      const tokenEndpoint = 'https://ims-na1.adobelogin.com/ims/exchange/jwt';
      
      const params = new URLSearchParams();
      params.append('client_id', auth.clientId);
      params.append('client_secret', auth.clientSecret);
      params.append('jwt_token', jwt);

      const response = await this.axiosInstance.post(tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      if (!response.data || !response.data.access_token) {
        throw new Error('Invalid service account response: missing access token');
      }

      this.authToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
      
      this.logger.debug('Service account token refreshed successfully', {
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type
      });

    } catch (error) {
      this.logger.error('Failed to refresh service account token', error as Error);
      throw new AEMException(
        'Service account token refresh failed',
        'AUTHENTICATION_ERROR',
        true,
        60000, // Retry after 1 minute
        { originalError: error }
      );
    }
  }

  /**
   * Generate JWT for service account authentication
   */
  private generateServiceAccountJWT(auth: AEMCredentials): string {
    const crypto = require('crypto');
    
    // JWT header
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    // JWT payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: auth.clientId,
      sub: auth.clientId, // For service accounts, subject is same as issuer
      aud: `https://ims-na1.adobelogin.com/c/${  auth.clientId}`,
      exp: now + 3600, // Token expires in 1 hour
      iat: now,
      scope: 'openid,AdobeID,read_organizations,additional_info.projectedProductContext'
    };

    // Encode header and payload
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    // Create signature
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const privateKey = auth.privateKey || process.env.AEM_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error('Private key is required for service account authentication');
    }

    const signature = crypto
      .createSign('RSA-SHA256')
      .update(signatureInput)
      .sign(privateKey, 'base64url');

    return `${signatureInput}.${signature}`;
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    const auth = this.config.authentication;
    const headers: Record<string, string> = {};

    switch (auth.type) {
      case 'token': {
        // Direct token authentication - for AEMaaCS browser session tokens
        // Check if a full cookie string is provided via AEM_COOKIES env var
        const fullCookies = process.env.AEM_COOKIES || (auth as any).cookies;
        if (fullCookies) {
          // Use the complete cookie string from browser
          headers['Cookie'] = fullCookies;
          // Add User-Agent to match browser requests (AEMaaCS may check this)
          headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
          
          // Log cookie presence for debugging (truncated)
          this.logger.debug('Using cookies for authentication', {
            cookieLength: fullCookies.length,
            cookiePreview: `${fullCookies.substring(0, 50)}...`
          });
        } else if (auth.accessToken) {
          // Fallback: use just the login-token cookie
          headers['Cookie'] = `login-token=login:${auth.accessToken}`;
          headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
          this.logger.debug('Using accessToken for login-token cookie');
        } else {
          this.logger.warn('No cookies or accessToken found for token authentication');
        }
        break;
      }

      case 'basic': {
        if (auth.username && auth.password) {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
      }

      case 'oauth':
      case 'service-account': {
        // Use refreshed OAuth/service-account token as Bearer
        if (this.authToken) {
          headers['Authorization'] = `Bearer ${this.authToken}`;
        } else if (auth.accessToken) {
          // Fallback to provided access token if no refreshed token
          headers['Authorization'] = `Bearer ${auth.accessToken}`;
        }
        break;
      }
    }

    return headers;
  }

  /**
   * Build full URL
   */
  private buildUrl(path: string): string {
    // Remove leading slash if present to avoid double slashes
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return cleanPath;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(method: string, path: string, params?: Record<string, any>): string {
    const paramsStr = params ? JSON.stringify(params) : '';
    return `aem:${method}:${path}:${Buffer.from(paramsStr).toString('base64')}`;
  }

  /**
   * Get client statistics
   */
  getStats(): {
    circuitBreaker?: any;
    cache?: any;
    performance?: any;
  } {
    const stats: any = {};

    if (this.circuitBreaker) {
      stats.circuitBreaker = this.circuitBreaker.getStats();
    }

    if (this.cache) {
      stats.cache = this.cache.getStats();
    }

    stats.performance = this.performanceMonitor.getMetrics();

    return stats;
  }

  /**
   * Clear cache
   */
  async clearCache(pattern?: string): Promise<void> {
    if (this.cache) {
      if (pattern) {
        await this.cache.invalidatePattern(pattern);
      } else {
        await this.cache.clear();
      }
    }
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    if (this.circuitBreaker) {
      this.circuitBreaker.reset();
    }
  }

  /**
   * Close client and cleanup resources
   */
  async close(): Promise<void> {
    // Close any open connections
    if (this.axiosInstance.defaults.httpAgent) {
      this.axiosInstance.defaults.httpAgent.destroy();
    }
    if (this.axiosInstance.defaults.httpsAgent) {
      this.axiosInstance.defaults.httpsAgent.destroy();
    }

    this.logger.info('AEM HTTP client closed');
  }
}

/**
 * Factory function to create AEM HTTP client
 */
export function createAEMHttpClient(options?: AEMHttpClientOptions): AEMHttpClient {
  return new AEMHttpClient(options);
}