/**
 * Shared utilities and types for AEMaaCS MCP servers
 */

// Types
export * from './types/aem.js';
export * from './types/mcp.js';

// General configuration (export with aliases to avoid conflicts)
export {
  ConfigManager as BaseConfigManager,
  ServerConfig,
  ServerSettings,
  SecurityConfig,
  LoggingConfig,
  CacheConfig,
  RetryConfig
} from './config/index.js';

// Server-specific configuration (this is the main ConfigManager for servers)
export {
  ConfigManager,
  AEMConnectionConfig,
  ServerConfig as ServerSpecificConfig,
  ReadServerConfig,
  WriteServerConfig
} from './config/server-config.js';

// Utilities - export explicitly to avoid naming conflicts
export { AEMException, ErrorHandler, ErrorRetryConfig } from './utils/errors.js';
// Note: RetryHandler from errors.js is deprecated, use the one from retry-handler.js
export * from './utils/validation.js';
export { Logger } from './utils/logger.js';
export * from './utils/dangerous-operations.js';
export { AuditLogger, AuditEvent } from './utils/audit-logger.js';
export * from './utils/service-wrapper.js';
export * from './utils/metrics.js';
export * from './utils/bulk-operations.js';
export * from './utils/health-check.js';
export { 
  RetryHandler, 
  getRetryHandler,
  RetryOptions,
  RetryResult
} from './utils/retry-handler.js';

// Client
export * from './client/aem-http-client.js';