/**
 * Configuration management system for AEMaaCS MCP servers
 */
import { AEMConfig } from '../types/aem.js';
export interface ServerConfig {
    aem: AEMConfig;
    server: ServerSettings;
    security: SecurityConfig;
    logging: LoggingConfig;
    cache: CacheConfig;
    retry: RetryConfig;
}
export interface ServerSettings {
    port: number;
    host: string;
    cors: {
        enabled: boolean;
        origins: string[];
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
    };
    timeout: number;
}
export interface SecurityConfig {
    enableInputValidation: boolean;
    enableAuditLogging: boolean;
    enableApiKeyAuth?: boolean;
    enableIPAllowlist?: boolean;
    maxRequestSize: string;
    allowedFileTypes: string[];
    maxFileSize: number;
    allowedIPs?: string[];
    apiKeys?: string[];
}
export interface LoggingConfig {
    level: 'error' | 'warn' | 'info' | 'debug';
    format: 'json' | 'simple';
    file?: {
        enabled: boolean;
        path: string;
        maxSize: string;
        maxFiles: number;
    };
    console: {
        enabled: boolean;
        colorize: boolean;
    };
}
export interface CacheConfig {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    maxMemory?: number;
    strategy: 'lru' | 'lfu' | 'ttl';
    redis?: {
        host: string;
        port: number;
        password?: string;
        db: number;
    };
}
export interface RetryConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}
export declare class ConfigManager {
    private static instance;
    private config;
    private configWatcher?;
    private configFile?;
    private lastModified?;
    private configListeners;
    private constructor();
    static getInstance(): ConfigManager;
    getConfig(): ServerConfig;
    getAEMConfig(): AEMConfig;
    getServerConfig(): ServerSettings;
    getSecurityConfig(): SecurityConfig;
    getLoggingConfig(): LoggingConfig;
    getCacheConfig(): CacheConfig;
    getRetryConfig(): RetryConfig;
    private loadConfig;
    private loadAuthConfig;
    /**
     * Reload configuration (useful for hot-reloading in development)
     */
    reloadConfig(): void;
    /**
     * Validate configuration
     */
    validateConfig(): {
        valid: boolean;
        errors?: string[];
    };
    /**
     * Add configuration change listener
     */
    addConfigListener(listener: () => void): void;
    /**
     * Remove configuration change listener
     */
    removeConfigListener(listener: () => void): void;
    /**
     * Start configuration file watcher for hot-reload
     */
    private startConfigWatcher;
    /**
     * Check for configuration file changes
     */
    private checkConfigFileChanges;
    /**
     * Notify all configuration listeners
     */
    private notifyConfigListeners;
    /**
     * Stop configuration watcher
     */
    stopConfigWatcher(): void;
    /**
     * Get configuration summary for debugging
     */
    getConfigSummary(): Record<string, any>;
    /**
     * Cleanup resources
     */
    cleanup(): void;
}
//# sourceMappingURL=index.d.ts.map