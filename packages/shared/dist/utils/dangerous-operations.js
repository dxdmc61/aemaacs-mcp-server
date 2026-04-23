/**
 * Dangerous operations confirmation utility
 * Provides confirmation mechanisms for potentially destructive operations
 */
import { Logger } from './logger.js';
import { AEMException } from './errors.js';
import { ErrorType } from '../types/aem.js';
export class DangerousOperationsManager {
    constructor(config) {
        this.pendingConfirmations = new Map();
        this.logger = Logger.getInstance();
        this.config = {
            requireConfirmation: true,
            confirmationTimeout: 300000, // 5 minutes
            allowedOperations: [],
            blockedOperations: [],
            bypassConfirmationFor: [],
            ...config
        };
        // Clean up expired confirmations every minute
        setInterval(() => this.cleanupExpiredConfirmations(), 60000);
    }
    /**
     * Check if an operation requires confirmation
     */
    isDangerousOperation(operation, userId) {
        // Check if user can bypass confirmation
        if (userId && this.config.bypassConfirmationFor.includes(userId)) {
            return false;
        }
        // Check if operation is explicitly blocked
        if (this.config.blockedOperations.includes(operation)) {
            return true;
        }
        // Check if operation is in allowed list (if specified)
        if (this.config.allowedOperations.length > 0 && !this.config.allowedOperations.includes(operation)) {
            return true;
        }
        // Check against known dangerous operations
        const dangerousOperations = [
            'delete_page',
            'delete_asset',
            'delete_user',
            'delete_group',
            'delete_workflow',
            'delete_launch',
            'move_page',
            'move_asset',
            'bulk_delete',
            'bulk_move',
            'clear_cache',
            'reset_password',
            'disable_user',
            'lock_page',
            'unlock_page',
            'publish_page',
            'unpublish_page',
            'activate_tree',
            'deactivate_tree',
            'create_launch',
            'delete_launch',
            'promote_launch',
            'create_version',
            'restore_version',
            'delete_version',
            'update_acl',
            'delete_acl',
            'create_workflow',
            'delete_workflow',
            'start_workflow',
            'abort_workflow'
        ];
        return dangerousOperations.includes(operation);
    }
    /**
     * Request confirmation for a dangerous operation
     */
    requestConfirmation(operation, resource, userId, metadata) {
        if (!this.config.requireConfirmation) {
            throw new AEMException('Confirmation not required for this operation', ErrorType.VALIDATION_ERROR, false);
        }
        if (!this.isDangerousOperation(operation, userId)) {
            throw new AEMException('Operation does not require confirmation', ErrorType.VALIDATION_ERROR, false);
        }
        const confirmationId = this.generateConfirmationId();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.config.confirmationTimeout);
        const confirmation = {
            operation,
            resource,
            confirmationId,
            timestamp: now,
            expiresAt,
            metadata: {
                userId,
                ...metadata
            }
        };
        this.pendingConfirmations.set(confirmationId, confirmation);
        this.logger.warn('Dangerous operation confirmation requested', {
            operation,
            resource,
            confirmationId,
            userId,
            expiresAt
        });
        return confirmation;
    }
    /**
     * Confirm a dangerous operation
     */
    confirmOperation(confirmationId, userId) {
        const confirmation = this.pendingConfirmations.get(confirmationId);
        if (!confirmation) {
            throw new AEMException('Invalid confirmation ID', ErrorType.VALIDATION_ERROR, false);
        }
        if (confirmation.expiresAt < new Date()) {
            this.pendingConfirmations.delete(confirmationId);
            throw new AEMException('Confirmation has expired', ErrorType.VALIDATION_ERROR, false);
        }
        // Verify user matches (if provided)
        if (userId && confirmation.metadata?.userId && confirmation.metadata.userId !== userId) {
            throw new AEMException('Confirmation user mismatch', ErrorType.VALIDATION_ERROR, false);
        }
        // Remove confirmation from pending list
        this.pendingConfirmations.delete(confirmationId);
        this.logger.info('Dangerous operation confirmed', {
            operation: confirmation.operation,
            resource: confirmation.resource,
            confirmationId,
            userId
        });
        return true;
    }
    /**
     * Cancel a pending confirmation
     */
    cancelConfirmation(confirmationId, userId) {
        const confirmation = this.pendingConfirmations.get(confirmationId);
        if (!confirmation) {
            return false;
        }
        // Verify user matches (if provided)
        if (userId && confirmation.metadata?.userId && confirmation.metadata.userId !== userId) {
            throw new AEMException('Confirmation user mismatch', ErrorType.VALIDATION_ERROR, false);
        }
        this.pendingConfirmations.delete(confirmationId);
        this.logger.info('Dangerous operation confirmation cancelled', {
            operation: confirmation.operation,
            resource: confirmation.resource,
            confirmationId,
            userId
        });
        return true;
    }
    /**
     * Get pending confirmations for a user
     */
    getPendingConfirmations(userId) {
        const confirmations = Array.from(this.pendingConfirmations.values());
        if (userId) {
            return confirmations.filter(c => c.metadata?.userId === userId);
        }
        return confirmations;
    }
    /**
     * Check if operation is blocked
     */
    isOperationBlocked(operation) {
        return this.config.blockedOperations.includes(operation);
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.info('Dangerous operations configuration updated', {
            requireConfirmation: this.config.requireConfirmation,
            confirmationTimeout: this.config.confirmationTimeout,
            allowedOperationsCount: this.config.allowedOperations.length,
            blockedOperationsCount: this.config.blockedOperations.length
        });
    }
    /**
     * Generate unique confirmation ID
     */
    generateConfirmationId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2);
        return `conf_${timestamp}_${random}`;
    }
    /**
     * Clean up expired confirmations
     */
    cleanupExpiredConfirmations() {
        const now = new Date();
        let cleanedCount = 0;
        for (const [id, confirmation] of this.pendingConfirmations.entries()) {
            if (confirmation.expiresAt < now) {
                this.pendingConfirmations.delete(id);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            this.logger.debug(`Cleaned up ${cleanedCount} expired confirmations`);
        }
    }
    /**
     * Get statistics about confirmations
     */
    getStats() {
        return {
            pendingConfirmations: this.pendingConfirmations.size,
            config: { ...this.config }
        };
    }
}
// Singleton instance
let dangerousOpsManager = null;
export function getDangerousOperationsManager(config) {
    if (!dangerousOpsManager) {
        dangerousOpsManager = new DangerousOperationsManager(config);
    }
    return dangerousOpsManager;
}
/**
 * Middleware for Express to handle dangerous operation confirmations
 */
export function createDangerousOperationMiddleware() {
    const manager = getDangerousOperationsManager();
    return {
        /**
         * Middleware to check if operation requires confirmation
         */
        requireConfirmation: (req, res, next) => {
            const operation = req.body?.method || req.path;
            const userId = req.headers['x-user-id'] || req.user?.id;
            if (manager.isDangerousOperation(operation, userId)) {
                const resource = req.body?.params?.path || req.body?.params?.pagePath || 'unknown';
                try {
                    const confirmation = manager.requestConfirmation(operation, resource, userId, {
                        ip: req.ip,
                        userAgent: req.get('User-Agent')
                    });
                    return res.status(202).json({
                        success: false,
                        requiresConfirmation: true,
                        confirmation: {
                            id: confirmation.confirmationId,
                            operation: confirmation.operation,
                            resource: confirmation.resource,
                            expiresAt: confirmation.expiresAt,
                            message: `Operation "${operation}" on "${resource}" requires confirmation`
                        }
                    });
                }
                catch (error) {
                    if (error instanceof AEMException) {
                        return res.status(400).json({
                            success: false,
                            error: error.toAEMError()
                        });
                    }
                    throw error;
                }
            }
            next();
        },
        /**
         * Middleware to confirm operation
         */
        confirmOperation: (req, res, next) => {
            const confirmationId = req.body?.confirmationId || req.headers['x-confirmation-id'];
            const userId = req.headers['x-user-id'] || req.user?.id;
            if (!confirmationId) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_CONFIRMATION_ID',
                        message: 'Confirmation ID is required for this operation',
                        recoverable: false
                    }
                });
            }
            try {
                manager.confirmOperation(confirmationId, userId);
                next();
            }
            catch (error) {
                if (error instanceof AEMException) {
                    return res.status(400).json({
                        success: false,
                        error: error.toAEMError()
                    });
                }
                throw error;
            }
        }
    };
}
//# sourceMappingURL=dangerous-operations.js.map