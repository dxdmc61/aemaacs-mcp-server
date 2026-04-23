/**
 * Structured audit logging for compliance and security
 * Implements comprehensive logging for all operations with compliance features
 */
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
        retentionPeriod: number;
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
export declare class AuditLogger {
    private logger;
    private config;
    private logQueue;
    private processingQueue;
    private logRotationTimer?;
    constructor(config?: Partial<AuditLoggerConfig>);
    /**
     * Log an audit event
     */
    logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): void;
    /**
     * Log operation start
     */
    logOperationStart(operation: string, resource: string, resourceType: AuditEvent['resourceType'], action: AuditEvent['action'], userId?: string, sessionId?: string, requestId?: string, metadata?: Record<string, any>): void;
    /**
     * Log operation completion
     */
    logOperationComplete(operation: string, resource: string, resourceType: AuditEvent['resourceType'], action: AuditEvent['action'], outcome: AuditEvent['outcome'], userId?: string, sessionId?: string, requestId?: string, metadata?: Record<string, any>, error?: {
        code: string;
        message: string;
        stack?: string;
    }): void;
    /**
     * Log security event
     */
    logSecurityEvent(operation: string, resource: string, severity: AuditEvent['severity'], userId?: string, sessionId?: string, requestId?: string, metadata?: Record<string, any>): void;
    /**
     * Log data access
     */
    logDataAccess(operation: string, resource: string, resourceType: AuditEvent['resourceType'], action: AuditEvent['action'], userId?: string, sessionId?: string, requestId?: string, metadata?: Record<string, any>): void;
    /**
     * Log configuration change
     */
    logConfigurationChange(operation: string, resource: string, action: AuditEvent['action'], userId?: string, sessionId?: string, requestId?: string, metadata?: Record<string, any>): void;
    /**
     * Get audit trail for a resource
     */
    getAuditTrail(resource: string, startDate?: Date, endDate?: Date, userId?: string, action?: AuditEvent['action']): Promise<AuditEvent[]>;
    /**
     * Export audit logs for compliance
     */
    exportAuditLogs(startDate: Date, endDate: Date, format?: 'json' | 'csv' | 'xml'): Promise<string>;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<AuditLoggerConfig>): void;
    /**
     * Get statistics
     */
    getStats(): {
        queueSize: number;
        config: AuditLoggerConfig;
    };
    /**
     * Initialize log directory
     */
    private initializeLogDirectory;
    /**
     * Start queue processor
     */
    private startQueueProcessor;
    /**
     * Process log queue
     */
    private processQueue;
    /**
     * Process event immediately (for critical events)
     */
    private processEventImmediately;
    /**
     * Write event to file
     */
    private writeEventToFile;
    /**
     * Start log rotation
     */
    private startLogRotation;
    /**
     * Rotate log files
     */
    private rotateLogs;
    /**
     * Get severity for action
     */
    private getSeverityForAction;
    /**
     * Sanitize metadata to remove sensitive data
     */
    private sanitizeMetadata;
    /**
     * Get date string for log file naming
     */
    private getDateString;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
export declare function getAuditLogger(config?: Partial<AuditLoggerConfig>): AuditLogger;
//# sourceMappingURL=audit-logger.d.ts.map
