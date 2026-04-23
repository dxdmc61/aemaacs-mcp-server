/**
 * Structured audit logging for compliance and security
 * Implements comprehensive logging for all operations with compliance features
 */
import { Logger } from './logger.js';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
export class AuditLogger {
    constructor(config) {
        this.logQueue = [];
        this.processingQueue = false;
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
    logEvent(event) {
        if (!this.config.enabled) {
            return;
        }
        const auditEvent = {
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
    logOperationStart(operation, resource, resourceType, action, userId, sessionId, requestId, metadata) {
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
    logOperationComplete(operation, resource, resourceType, action, outcome, userId, sessionId, requestId, metadata, error) {
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
    logSecurityEvent(operation, resource, severity, userId, sessionId, requestId, metadata) {
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
    logDataAccess(operation, resource, resourceType, action, userId, sessionId, requestId, metadata) {
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
    logConfigurationChange(operation, resource, action, userId, sessionId, requestId, metadata) {
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
    async getAuditTrail(resource, startDate, endDate, userId, action) {
        // This would typically query a database or log storage system
        // For now, we'll return an empty array as this is a file-based implementation
        return [];
    }
    /**
     * Export audit logs for compliance
     */
    async exportAuditLogs(startDate, endDate, format = 'json') {
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
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.info('Audit logger configuration updated', newConfig);
    }
    /**
     * Get statistics
     */
    getStats() {
        return {
            queueSize: this.logQueue.length,
            config: { ...this.config }
        };
    }
    /**
     * Initialize log directory
     */
    async initializeLogDirectory() {
        try {
            await fs.mkdir(this.config.logDirectory, { recursive: true });
        }
        catch (error) {
            this.logger.error('Failed to create audit log directory', error);
        }
    }
    /**
     * Start queue processor
     */
    startQueueProcessor() {
        setInterval(() => {
            if (this.logQueue.length > 0 && !this.processingQueue) {
                this.processQueue();
            }
        }, 1000); // Process queue every second
    }
    /**
     * Process log queue
     */
    async processQueue() {
        if (this.processingQueue) {
            return;
        }
        this.processingQueue = true;
        const events = this.logQueue.splice(0, 100); // Process up to 100 events at a time
        try {
            for (const event of events) {
                await this.writeEventToFile(event);
            }
        }
        catch (error) {
            this.logger.error('Failed to process audit log queue', error);
            // Put events back in queue for retry
            this.logQueue.unshift(...events);
        }
        finally {
            this.processingQueue = false;
        }
    }
    /**
     * Process event immediately (for critical events)
     */
    async processEventImmediately(event) {
        try {
            await this.writeEventToFile(event);
        }
        catch (error) {
            this.logger.error('Failed to write critical audit event', error);
        }
    }
    /**
     * Write event to file
     */
    async writeEventToFile(event) {
        try {
            const logFile = path.join(this.config.logDirectory, `audit-${this.getDateString()}.log`);
            const logEntry = JSON.stringify(event) + '\n';
            await fs.appendFile(logFile, logEntry);
        }
        catch (error) {
            this.logger.error('Failed to write audit event to file', error);
        }
    }
    /**
     * Start log rotation
     */
    startLogRotation() {
        this.logRotationTimer = setInterval(() => {
            this.rotateLogs();
        }, 24 * 60 * 60 * 1000); // Daily rotation
    }
    /**
     * Rotate log files
     */
    async rotateLogs() {
        try {
            const files = await fs.readdir(this.config.logDirectory);
            const logFiles = files.filter(f => f.startsWith('audit-') && f.endsWith('.log'));
            // Sort by date and remove old files
            logFiles.sort();
            const filesToRemove = logFiles.slice(0, -this.config.maxLogFiles);
            for (const file of filesToRemove) {
                await fs.unlink(path.join(this.config.logDirectory, file));
            }
        }
        catch (error) {
            this.logger.error('Failed to rotate audit logs', error);
        }
    }
    /**
     * Get severity for action
     */
    getSeverityForAction(action) {
        const severityMap = {
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
    sanitizeMetadata(metadata) {
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
    getDateString() {
        const now = new Date();
        return now.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
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
let auditLogger = null;
export function getAuditLogger(config) {
    if (!auditLogger) {
        auditLogger = new AuditLogger(config);
    }
    return auditLogger;
}
//# sourceMappingURL=audit-logger.js.map