/**
 * Server Configuration Management
 * Handles configuration loading, validation, and environment variable support
 */

import { Logger } from '../utils/logger.js';

export interface AEMConnectionConfig {
  host: string;
  port?: number;
  protocol: 'http' | 'https';
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ServerConfig {
  server: {
    port: number;
    host: string;
    cors: {
      enabled: boolean;
      origins: string[];
    };
    rateLimit: {
      enabled: boolean;
      windowMs: number;
      maxRequests: number;
    };
  };
  aem: AEMConnectionConfig;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    file?: string;
  };
  security: {
    apiKeys?: string[];
    allowedIPs?: string[];
    requireAuth: boolean;
  };
}

export interface ReadServerConfig extends ServerConfig {
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

export interface WriteServerConfig extends ServerConfig {
  validation: {
    strict: boolean;
    allowDangerousOperations: boolean;
  };
  backup: {
    enabled: boolean;
    retentionDays: number;
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration for read server
   */
  public loadReadServerConfig(): ReadServerConfig {
    try {
      const config: ReadServerConfig = {
        server: {
          port: this.getEnvNumber('READ_SERVER_PORT', 3001),
          host: this.getEnvString('READ_SERVER_HOST', '0.0.0.0'),
          cors: {
            enabled: this.getEnvBoolean('CORS_ENABLED', true),
            origins: this.getEnvArray('CORS_ORIGINS', ['*'])
          },
          rateLimit: {
            enabled: this.getEnvBoolean('RATE_LIMIT_ENABLED', true),
            windowMs: this.getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
            maxRequests: this.getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100)
          }
        },
        aem: this.loadAEMConfig(),
        logging: this.loadLoggingConfig(),
        security: this.loadSecurityConfig(),
        cache: {
          enabled: this.getEnvBoolean('CACHE_ENABLED', true),
          ttl: this.getEnvNumber('CACHE_TTL', 300),
          maxSize: this.getEnvNumber('CACHE_MAX_SIZE', 1000)
        }
      };

      this.validateConfig(config);
      this.logger.info('Read server configuration loaded successfully');
      return config;

    } catch (error) {
      this.logger.error('Failed to load read server configuration', error as Error);
      throw new Error(`Configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load configuration for write server
   */
  public loadWriteServerConfig(): WriteServerConfig {
    try {
      const config: WriteServerConfig = {
        server: {
          port: this.getEnvNumber('WRITE_SERVER_PORT', 3002),
          host: this.getEnvString('WRITE_SERVER_HOST', '0.0.0.0'),
          cors: {
            enabled: this.getEnvBoolean('CORS_ENABLED', false),
            origins: this.getEnvArray('CORS_ORIGINS', [])
          },
          rateLimit: {
            enabled: this.getEnvBoolean('RATE_LIMIT_ENABLED', true),
            windowMs: this.getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
            maxRequests: this.getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 50)
          }
        },
        aem: this.loadAEMConfig(),
        logging: this.loadLoggingConfig(),
        security: this.loadSecurityConfig(),
        validation: {
          strict: this.getEnvBoolean('VALIDATION_STRICT', true),
          allowDangerousOperations: this.getEnvBoolean('ALLOW_DANGEROUS_OPERATIONS', false)
        },
        backup: {
          enabled: this.getEnvBoolean('BACKUP_ENABLED', true),
          retentionDays: this.getEnvNumber('BACKUP_RETENTION_DAYS', 30)
        }
      };

      this.validateConfig(config);
      this.logger.info('Write server configuration loaded successfully');
      return config;

    } catch (error) {
      this.logger.error('Failed to load write server configuration', error as Error);
      throw new Error(`Configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load AEM connection configuration
   */
  private loadAEMConfig(): AEMConnectionConfig {
    const host = this.getEnvString('AEM_HOST');
    if (!host) {
      throw new Error('AEM_HOST environment variable is required');
    }

    return {
      host,
      port: this.getEnvNumber('AEM_PORT', 4502),
      protocol: this.getEnvString('AEM_PROTOCOL', 'https') as 'http' | 'https',
      username: process.env.AEM_USERNAME,
      password: process.env.AEM_PASSWORD,
      clientId: process.env.AEM_CLIENT_ID,
      clientSecret: process.env.AEM_CLIENT_SECRET,
      accessToken: process.env.AEM_ACCESS_TOKEN,
      timeout: this.getEnvNumber('AEM_TIMEOUT', 30000),
      retryAttempts: this.getEnvNumber('AEM_RETRY_ATTEMPTS', 3),
      retryDelay: this.getEnvNumber('AEM_RETRY_DELAY', 1000)
    };
  }

  /**
   * Load logging configuration
   */
  private loadLoggingConfig() {
    return {
      level: this.getEnvString('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
      format: this.getEnvString('LOG_FORMAT', 'json') as 'json' | 'text',
      file: process.env.LOG_FILE
    };
  }

  /**
   * Load security configuration
   */
  private loadSecurityConfig() {
    return {
      apiKeys: this.getEnvArray('API_KEYS'),
      allowedIPs: this.getEnvArray('ALLOWED_IPS'),
      requireAuth: this.getEnvBoolean('REQUIRE_AUTH', true)
    };
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: ServerConfig): void {
    // Validate server configuration
    if (config.server.port < 1 || config.server.port > 65535) {
      throw new Error('Server port must be between 1 and 65535');
    }

    // Validate AEM configuration
    if (!config.aem.host) {
      throw new Error('AEM host is required');
    }

    if (!['http', 'https'].includes(config.aem.protocol)) {
      throw new Error('AEM protocol must be http or https');
    }

    // Validate authentication
    const hasBasicAuth = config.aem.username && config.aem.password;
    const hasOAuth = config.aem.clientId && config.aem.clientSecret;
    const hasToken = config.aem.accessToken;

    if (!hasBasicAuth && !hasOAuth && !hasToken) {
      throw new Error('AEM authentication is required (username/password, OAuth, or access token)');
    }

    // Validate logging configuration
    if (!['debug', 'info', 'warn', 'error'].includes(config.logging.level)) {
      throw new Error('Log level must be debug, info, warn, or error');
    }

    if (!['json', 'text'].includes(config.logging.format)) {
      throw new Error('Log format must be json or text');
    }

    this.logger.debug('Configuration validation passed');
  }

  /**
   * Get environment variable as string
   */
  private getEnvString(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${key} is required`);
    }
    return value;
  }

  /**
   * Get environment variable as number
   */
  private getEnvNumber(key: string, defaultValue?: number): number {
    const value = process.env[key];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${key} is required`);
    }
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key} must be a valid number`);
    }
    return parsed;
  }

  /**
   * Get environment variable as boolean
   */
  private getEnvBoolean(key: string, defaultValue?: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${key} is required`);
    }
    
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }

  /**
   * Get environment variable as array
   */
  private getEnvArray(key: string, defaultValue?: string[]): string[] {
    const value = process.env[key];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      return [];
    }
    
    return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
  }
}