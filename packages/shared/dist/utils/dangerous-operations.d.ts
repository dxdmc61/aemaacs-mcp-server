/**
 * Dangerous operations confirmation utility
 * Provides confirmation mechanisms for potentially destructive operations
 */
export interface DangerousOperationConfig {
    requireConfirmation: boolean;
    confirmationTimeout: number;
    allowedOperations: string[];
    blockedOperations: string[];
    bypassConfirmationFor: string[];
}
export interface OperationConfirmation {
    operation: string;
    resource: string;
    confirmationId: string;
    timestamp: Date;
    expiresAt: Date;
    metadata?: Record<string, any>;
}
export declare class DangerousOperationsManager {
    private logger;
    private config;
    private pendingConfirmations;
    constructor(config?: Partial<DangerousOperationConfig>);
    /**
     * Check if an operation requires confirmation
     */
    isDangerousOperation(operation: string, userId?: string): boolean;
    /**
     * Request confirmation for a dangerous operation
     */
    requestConfirmation(operation: string, resource: string, userId?: string, metadata?: Record<string, any>): OperationConfirmation;
    /**
     * Confirm a dangerous operation
     */
    confirmOperation(confirmationId: string, userId?: string): boolean;
    /**
     * Cancel a pending confirmation
     */
    cancelConfirmation(confirmationId: string, userId?: string): boolean;
    /**
     * Get pending confirmations for a user
     */
    getPendingConfirmations(userId?: string): OperationConfirmation[];
    /**
     * Check if operation is blocked
     */
    isOperationBlocked(operation: string): boolean;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<DangerousOperationConfig>): void;
    /**
     * Generate unique confirmation ID
     */
    private generateConfirmationId;
    /**
     * Clean up expired confirmations
     */
    private cleanupExpiredConfirmations;
    /**
     * Get statistics about confirmations
     */
    getStats(): {
        pendingConfirmations: number;
        config: DangerousOperationConfig;
    };
}
export declare function getDangerousOperationsManager(config?: Partial<DangerousOperationConfig>): DangerousOperationsManager;
/**
 * Middleware for Express to handle dangerous operation confirmations
 */
export declare function createDangerousOperationMiddleware(): {
    requireConfirmation: (req: any, res: any, next: any) => any;
    confirmOperation: (req: any, res: any, next: any) => any;
};
//# sourceMappingURL=dangerous-operations.d.ts.map
