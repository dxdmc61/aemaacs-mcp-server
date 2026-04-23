/**
 * Bulk operations utility with progress tracking and async job management
 */
export interface BulkOperationOptions {
    batchSize?: number;
    maxConcurrency?: number;
    delayBetweenBatches?: number;
    continueOnError?: boolean;
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
}
export interface BulkOperationResult<T> {
    success: boolean;
    totalItems: number;
    processedItems: number;
    successfulItems: number;
    failedItems: number;
    errors: BulkOperationError[];
    results: T[];
    duration: number;
    startTime: Date;
    endTime: Date;
}
export interface BulkOperationError {
    itemIndex: number;
    item: any;
    error: string;
    timestamp: Date;
}
export interface BulkOperationProgress {
    operationId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    totalItems: number;
    processedItems: number;
    successfulItems: number;
    failedItems: number;
    currentBatch: number;
    totalBatches: number;
    percentage: number;
    estimatedTimeRemaining?: number;
    startTime: Date;
    lastUpdate: Date;
    errors: BulkOperationError[];
}
export interface BulkOperationJob {
    id: string;
    type: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: BulkOperationProgress;
    result?: BulkOperationResult<any>;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string;
    metadata?: Record<string, any>;
}
export declare class BulkOperationsManager {
    private logger;
    private activeJobs;
    private jobHistory;
    private maxHistorySize;
    constructor();
    /**
     * Execute bulk operation with progress tracking
     */
    executeBulkOperation<T, R>(operationType: string, items: T[], operation: (item: T, index: number) => Promise<R>, options?: BulkOperationOptions, createdBy?: string): Promise<BulkOperationJob>;
    /**
     * Get job status
     */
    getJobStatus(jobId: string): BulkOperationJob | null;
    /**
     * Get all active jobs
     */
    getActiveJobs(): BulkOperationJob[];
    /**
     * Get job history
     */
    getJobHistory(limit?: number): BulkOperationJob[];
    /**
     * Cancel a job
     */
    cancelJob(jobId: string): boolean;
    /**
     * Get operation statistics
     */
    getStatistics(): {
        activeJobs: number;
        totalJobs: number;
        completedJobs: number;
        failedJobs: number;
        averageDuration: number;
        totalItemsProcessed: number;
    };
    /**
     * Execute operation asynchronously
     */
    private executeOperationAsync;
    /**
     * Process a batch of items with concurrency control
     */
    private processBatch;
    /**
     * Calculate estimated time remaining
     */
    private calculateEstimatedTimeRemaining;
    /**
     * Create timeout promise
     */
    private createTimeoutPromise;
    /**
     * Move job to history
     */
    private moveJobToHistory;
    /**
     * Clean up old jobs
     */
    private cleanupOldJobs;
    /**
     * Sleep utility
     */
    private sleep;
}
export declare function getBulkOperationsManager(): BulkOperationsManager;
//# sourceMappingURL=bulk-operations.d.ts.map
