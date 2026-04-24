/**
 * Structured audit logging for compliance and security
 * Implements comprehensive logging for all operations with compliance features
 */

import { Logger } from './logger.js';
import { ErrorType } from '../types/aem.js';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: 'operation_start' | 'operation_complete' | 'operation_failed' | 'security_event' | 'data_access' | 'configuration_change';
  operation: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  resource: string;
  resourceType: 'page' | 'asset' | 'user' | 'group' | 'workflow' | 'launch' | 'version' | 'acl' | 'template' | 'component' | 'system';
  action: 'create' | 'read' | 'update' | 'delete' | 'move' | 'copy' | 'publish' | 'unpublish' | 'activate' | 'deactivate' | 'lock' | 'unlock' | 'login' | 'logout' | 'permission_change';
  outcome: 'success' | 'failure' | 'partial';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  compliance?: {
    dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
    retentionPeriod: number; // days
    legalHold: boolean;
    encryptionRequired: boolean;
  };
}

export interface AuditLoggerConfig {
  enabled: boolean;
  logLevel: 'all' | 'security' | 'data_access' | 'operations';
  retentionDays: number;
  maxLogFileSize: string;
  maxLogFiles: number;
  encryptLogs: boolean;
  includeRequestData: boolean;
  includeResponseData: boolean;
  sensitiveDataFields: string[];
  complianceMode: boolean;
  logDirectory: string;
  backupEnabled: boolean;
  backupRetentionDays: number;
}

export class AuditLogger {
  private logger: Logger;
  private config: AuditLoggerConfig;
  private logQueue: AuditEvent[] = [];
  private processingQueue: boolean = false;
  private logRotationTimer?:ReturnType<typeof setTimeout>;

  constructor(config?: Partial<AuditLoggerConfig>) {
    this.logger = Logger.getInstance();
    this.config = {
      enabled: true,
      logLevel: 'all',
      retentionDays: 2555, // 7 years for compliance
      maxLogFileSize: '100MB',
      maxLogFiles: 10,
      encryptLogs: false,
      includeRequestData: true,
      includeResponseData: false,
      sensitiveDataFields: ['password', 'token', 'secret', 'key', 'credential'],
      complianceMode: true,
      logDirectory: './logs/audit',
      backupEnabled: true,
      backupRetentionDays: 365,
      ...config
    };

    this.initializeLogDirectory();
    this.startLogRotation();
    this.startQueueProcessor();
  }

  /**
   * Log an audit event
   */
  logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    if (!this.config.enabled) {
      return;
    }

    const auditEvent: AuditEvent = {
      ...event,
      id: randomUUID(),
      timestamp: new Date()
    };

    // Add to queue for batch processing
    this.logQueue.push(auditEvent);

    // Immediate logging for critical events
    if (auditEvent.severity === 'critical') {
      this.processEventImmediately(auditEvent);
    }
  }

  /**
   * Log operation start
   */
  logOperationStart(
    operation: string,
    resource: string,
    resourceType: AuditEvent['resourceType'],
    action: AuditEvent['action'],
    userId?: string,
    sessionId?: string,
    requestId?: string,
    metadata?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: 'operation_start',
      operation,
      resource,
      resourceType,
      action,
      userId,
      sessionId,
      requestId,
      outcome: 'success',
      severity: this.getSeverityForAction(action),
      metadata: this.sanitizeMetadata(metadata)
    });
  }

  /**
   * Log operation completion
   */
  logOperationComplete(
    operation: string,
    resource: string,
    resourceType: AuditEvent['resourceType'],
    action: AuditEvent['action'],
    outcome: AuditEvent['outcome'],
    userId?: string,
    sessionId?: string,
    requestId?: string,
    metadata?: Record<string, any>,
    error?: { code: string; message: string; stack?: string }
  ): void {
    this.logEvent({
      eventType: 'operation_complete',
      operation,
      resource,
      resourceType,
      action,
      userId,
      sessionId,
      requestId,
      outcome,
      severity: outcome === 'failure' ? 'high' : this.getSeverityForAction(action),
      metadata: this.sanitizeMetadata(metadata),
      error
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(
    operation: string,
    resource: string,
    severity: AuditEvent['severity'],
    userId?: string,
    sessionId?: string,
    requestId?: string,
    metadata?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: 'security_event',
      operation,
      resource,
      resourceType: 'system',
      action: 'read', // Default action for security events
      userId,
      sessionId,
      requestId,
      outcome: 'failure',
      severity,
      metadata: this.sanitizeMetadata(metadata)
    });
  }

  /**
   * Log data access
   */
  logDataAccess(
    operation: string,
    resource: string,
    resourceType: AuditEvent['resourceType'],
    action: AuditEvent['action'],
    userId?: string,
    sessionId?: string,
    requestId?: string,
    metadata?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: 'data_access',
      operation,
      resource,
      resourceType,
      action,
      userId,
      sessionId,
      requestId,
      outcome: 'success',
      severity: 'low',
      metadata: this.sanitizeMetadata(metadata)
    });
  }

  /**
   * Log configuration change
   */
  logConfigurationChange(
    operation: string,
    resource: string,
    action: AuditEvent['action'],
    userId?: string,
    sessionId?: string,
    requestId?: string,
    metadata?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: 'configuration_change',
      operation,
      resource,
      resourceType: 'system',
      action,
      userId,
      sessionId,
      requestId,
      outcome: 'success',
      severity: 'medium',
      metadata: this.sanitizeMetadata(metadata)
    });
  }

  /**
   * Get audit trail for a resource
   */
  async getAuditTrail(
    resource: string,
    startDate?: Date,
    endDate?: Date,
    userId?: string,
    action?: AuditEvent['action']
  ): Promise<AuditEvent[]> {
    // This would typically query a database or log storage system
    // For now, we'll return an empty array as this is a file-based implementation
    return [];
  }

  /**
   * Export audit logs for compliance
   */
  async exportAuditLogs(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<string> {
    // Implementation would depend on the storage backend
    // For now, return a placeholder
    return JSON.stringify({
      startDate,
      endDate,
      format,
      message: 'Audit log export not implemented'
    });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AuditLoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Audit logger configuration updated', newConfig);
  }

  /**
   * Get statistics
   */
  getStats(): {
    queueSize: number;
    config: AuditLoggerConfig;
  } {
    return {
      queueSize: this.logQueue.length,
      config: { ...this.config }
    };
  }

  /**
   * Initialize log directory
   */
  private async initializeLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.logDirectory, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create audit log directory', error as Error);
    }
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (this.logQueue.length > 0 && !this.processingQueue) {
        this.processQueue();
      }
    }, 1000); // Process queue every second
  }

  /**
   * Process log queue
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;
    const events = this.logQueue.splice(0, 100); // Process up to 100 events at a time

    try {
      for (const event of events) {
        await this.writeEventToFile(event);
      }
    } catch (error) {
      this.logger.error('Failed to process audit log queue', error as Error);
      // Put events back in queue for retry
      this.logQueue.unshift(...events);
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Process event immediately (for critical events)
   */
  private async processEventImmediately(event: AuditEvent): Promise<void> {
    try {
      await this.writeEventToFile(event);
    } catch (error) {
      this.logger.error('Failed to write critical audit event', error as Error);
    }
  }

  /**
   * Write event to file
   */
  private async writeEventToFile(event: AuditEvent): Promise<void> {
    try {
      const logFile = path.join(this.config.logDirectory, `audit-${this.getDateString()}.log`);
      const logEntry = `${JSON.stringify(event)  }\n`;
      
      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      this.logger.error('Failed to write audit event to file', error as Error);
    }
  }

  /**
   * Start log rotation
   */
  private startLogRotation(): void {
    this.logRotationTimer = setInterval(() => {
      this.rotateLogs();
    }, 24 * 60 * 60 * 1000); // Daily rotation
  }

  /**
   * Rotate log files
   */
  private async rotateLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files.filter(f => f.startsWith('audit-') && f.endsWith('.log'));
      
      // Sort by date and remove old files
      logFiles.sort();
      const filesToRemove = logFiles.slice(0, -this.config.maxLogFiles);
      
      for (const file of filesToRemove) {
        await fs.unlink(path.join(this.config.logDirectory, file));
      }
    } catch (error) {
      this.logger.error('Failed to rotate audit logs', error as Error);
    }
  }

  /**
   * Get severity for action
   */
  private getSeverityForAction(action: AuditEvent['action']): AuditEvent['severity'] {
    const severityMap: Record<AuditEvent['action'], AuditEvent['severity']> = {
      'create': 'medium',
      'read': 'low',
      'update': 'medium',
      'delete': 'high',
      'move': 'medium',
      'copy': 'low',
      'publish': 'high',
      'unpublish': 'high',
      'activate': 'high',
      'deactivate': 'high',
      'lock': 'medium',
      'unlock': 'medium',
      'login': 'low',
      'logout': 'low',
      'permission_change': 'critical'
    };

    return severityMap[action] || 'low';
  }

  /**
   * Sanitize metadata to remove sensitive data
   */
  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) {
      return undefined;
    }

    const sanitized = { ...metadata };

    for (const field of this.config.sensitiveDataFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Get date string for log file naming
   */
  private getDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.logRotationTimer) {
      clearInterval(this.logRotationTimer);
    }

    // Process remaining events in queue
    if (this.logQueue.length > 0) {
      await this.processQueue();
    }
  }
}

// Singleton instance
let auditLogger: AuditLogger | null = null;

export function getAuditLogger(config?: Partial<AuditLoggerConfig>): AuditLogger {
  if (!auditLogger) {
    auditLogger = new AuditLogger(config);
  }
  return auditLogger;
}
