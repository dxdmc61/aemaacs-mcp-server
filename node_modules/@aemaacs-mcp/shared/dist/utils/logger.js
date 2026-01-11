/**
 * Logging and monitoring utilities for AEMaaCS MCP servers
 */
import winston from 'winston';
import { ConfigManager } from '../config/index.js';
export class Logger {
    constructor() {
        const config = ConfigManager.getInstance().getLoggingConfig();
        this.winston = this.createLogger(config);
        this.auditLogger = this.createAuditLogger(config);
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    createLogger(config) {
        const transports = [];
        // Console transport
        // In STDIO mode (MCP), logs must go to stderr to avoid interfering with JSON-RPC protocol on stdout
        const isStdioMode = process.argv.includes('--stdio');
        if (config.console.enabled) {
            const consoleTransportOptions = {
                format: winston.format.combine(winston.format.timestamp(), config.console.colorize ? winston.format.colorize() : winston.format.uncolorize(), config.format === 'json'
                    ? winston.format.json()
                    : winston.format.simple())
            };
            // In STDIO mode, redirect all logs to stderr
            if (isStdioMode) {
                consoleTransportOptions.stderrLevels = ['error', 'warn', 'info', 'debug', 'verbose', 'silly'];
            }
            transports.push(new winston.transports.Console(consoleTransportOptions));
        }
        // File transport
        if (config.file?.enabled) {
            transports.push(new winston.transports.File({
                filename: config.file.path,
                maxsize: this.parseSize(config.file.maxSize),
                maxFiles: config.file.maxFiles,
                format: winston.format.combine(winston.format.timestamp(), winston.format.json())
            }));
        }
        return winston.createLogger({
            level: config.level,
            transports,
            defaultMeta: {
                service: 'aemaacs-mcp-server'
            }
        });
    }
    createAuditLogger(config) {
        const transports = [];
        // Always log audit events to file if file logging is enabled
        if (config.file?.enabled) {
            const auditPath = config.file.path.replace('.log', '-audit.log');
            transports.push(new winston.transports.File({
                filename: auditPath,
                maxsize: this.parseSize(config.file.maxSize),
                maxFiles: config.file.maxFiles,
                format: winston.format.combine(winston.format.timestamp(), winston.format.json())
            }));
        }
        // Also log to console in development
        if (config.console.enabled && config.level === 'debug') {
            transports.push(new winston.transports.Console({
                format: winston.format.combine(winston.format.timestamp(), winston.format.colorize(), winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    return `${timestamp} [AUDIT] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
                }))
            }));
        }
        return winston.createLogger({
            level: 'info',
            transports,
            defaultMeta: {
                service: 'aemaacs-mcp-server',
                type: 'audit'
            }
        });
    }
    parseSize(size) {
        const units = {
            'b': 1,
            'k': 1024,
            'm': 1024 * 1024,
            'g': 1024 * 1024 * 1024
        };
        const match = size.toLowerCase().match(/^(\d+)([bkmg]?)$/);
        if (!match) {
            return 10 * 1024 * 1024; // Default 10MB
        }
        const [, num, unit] = match;
        const numValue = parseInt(num || '10');
        const unitMultiplier = units[unit || 'b'] || 1;
        return numValue * unitMultiplier;
    }
    debug(message, context) {
        this.winston.debug(message, context);
    }
    info(message, context) {
        this.winston.info(message, context);
    }
    warn(message, context) {
        this.winston.warn(message, context);
    }
    error(message, error, context) {
        this.winston.error(message, {
            ...context,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : undefined
        });
    }
    audit(event) {
        this.auditLogger.info('Audit Event', event);
    }
    /**
     * Create a child logger with default context
     */
    child(defaultContext) {
        return new ChildLogger(this, defaultContext);
    }
    /**
     * Log operation start
     */
    logOperationStart(operation, context) {
        this.info(`Operation started: ${operation}`, {
            requestId: context.requestId,
            userId: context.userId,
            operation: context.operation,
            resource: context.resource,
            timestamp: context.timestamp
        });
    }
    /**
     * Log operation completion
     */
    logOperationComplete(operation, context, duration, success = true) {
        const level = success ? 'info' : 'warn';
        const message = `Operation ${success ? 'completed' : 'failed'}: ${operation}`;
        this.winston.log(level, message, {
            requestId: context.requestId,
            userId: context.userId,
            operation: context.operation,
            resource: context.resource,
            duration,
            success
        });
        // Also create audit event
        this.audit({
            timestamp: new Date(),
            level: success ? 'info' : 'warn',
            type: 'operation',
            user: context.userId,
            operation: context.operation,
            resource: context.resource,
            result: success ? 'success' : 'failure',
            details: { duration },
            context
        });
    }
    /**
     * Log security event
     */
    logSecurityEvent(event, context, details) {
        this.warn(`Security event: ${event}`, {
            requestId: context.requestId,
            userId: context.userId,
            operation: context.operation,
            resource: context.resource,
            ...details
        });
        this.audit({
            timestamp: new Date(),
            level: 'warn',
            type: 'security',
            user: context.userId,
            operation: event,
            resource: context.resource,
            result: 'failure',
            details,
            context
        });
    }
}
export class ChildLogger {
    constructor(parent, defaultContext) {
        this.parent = parent;
        this.defaultContext = defaultContext;
    }
    mergeContext(context) {
        return { ...this.defaultContext, ...context };
    }
    debug(message, context) {
        this.parent.debug(message, this.mergeContext(context));
    }
    info(message, context) {
        this.parent.info(message, this.mergeContext(context));
    }
    warn(message, context) {
        this.parent.warn(message, this.mergeContext(context));
    }
    error(message, error, context) {
        this.parent.error(message, error, this.mergeContext(context));
    }
}
export class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.logger = Logger.getInstance();
    }
    static getInstance() {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }
    startOperation(operationId, operation) {
        return new OperationTimer(operationId, operation, this);
    }
    recordOperation(operationId, operation, duration, success) {
        const key = operation;
        const existing = this.metrics.get(key) || {
            operation,
            count: 0,
            totalDuration: 0,
            avgDuration: 0,
            minDuration: Infinity,
            maxDuration: 0,
            successCount: 0,
            errorCount: 0,
            successRate: 0
        };
        existing.count++;
        existing.totalDuration += duration;
        existing.avgDuration = existing.totalDuration / existing.count;
        existing.minDuration = Math.min(existing.minDuration, duration);
        existing.maxDuration = Math.max(existing.maxDuration, duration);
        if (success) {
            existing.successCount++;
        }
        else {
            existing.errorCount++;
        }
        existing.successRate = existing.successCount / existing.count;
        this.metrics.set(key, existing);
        // Log slow operations
        if (duration > 5000) { // 5 seconds
            this.logger.warn(`Slow operation detected: ${operation}`, {
                operationId,
                duration,
                operation
            });
        }
    }
    getMetrics() {
        return Array.from(this.metrics.values());
    }
    getMetricsForOperation(operation) {
        return this.metrics.get(operation);
    }
    resetMetrics() {
        this.metrics.clear();
    }
}
export class OperationTimer {
    constructor(operationId, operation, monitor) {
        this.operationId = operationId;
        this.operation = operation;
        this.monitor = monitor;
        this.startTime = Date.now();
    }
    end(success = true) {
        const duration = Date.now() - this.startTime;
        this.monitor.recordOperation(this.operationId, this.operation, duration, success);
        return duration;
    }
}
//# sourceMappingURL=logger.js.map