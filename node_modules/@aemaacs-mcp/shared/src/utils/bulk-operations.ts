/**
 * Bulk operations utility with progress tracking and async job management
 */

import { Logger } from './logger.js';
import { AEMException } from './errors.js';
import { ErrorType } from '../types/aem.js';
import { randomUUID } from 'crypto';

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

export class BulkOperationsManager {
  private logger: Logger;
  private activeJobs: Map<string, BulkOperationJob> = new Map();
  private jobHistory: BulkOperationJob[] = [];
  private maxHistorySize: number = 100;

  constructor() {
    this.logger = Logger.getInstance();
    
    // Clean up old jobs periodically
    setInterval(() => this.cleanupOldJobs(), 300000); // Every 5 minutes
  }

  /**
   * Execute bulk operation with progress tracking
   */
  async executeBulkOperation<T, R>(
    operationType: string,
    items: T[],
    operation: (item: T, index: number) => Promise<R>,
    options: BulkOperationOptions = {},
    createdBy?: string
  ): Promise<BulkOperationJob> {
    const jobId = randomUUID();
    const startTime = new Date();
    
    const job: BulkOperationJob = {
      id: jobId,
      type: operationType,
      status: 'pending',
      progress: {
        operationId: jobId,
        status: 'pending',
        totalItems: items.length,
        processedItems: 0,
        successfulItems: 0,
        failedItems: 0,
        currentBatch: 0,
        totalBatches: 0,
        percentage: 0,
        startTime,
        lastUpdate: startTime,
        errors: []
      },
      createdAt: startTime,
      updatedAt: startTime,
      createdBy,
      metadata: {
        batchSize: options.batchSize || 10,
        maxConcurrency: options.maxConcurrency || 5,
        continueOnError: options.continueOnError !== false
      }
    };

    this.activeJobs.set(jobId, job);
    this.logger.info(`Started bulk operation: ${operationType}`, { jobId, totalItems: items.length });

    // Execute operation asynchronously
    this.executeOperationAsync(job, items, operation, options).catch(error => {
      this.logger.error(`Bulk operation failed: ${operationType}`, error as Error, { jobId });
      job.status = 'failed';
      job.progress.status = 'failed';
      job.updatedAt = new Date();
    });

    return job;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): BulkOperationJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): BulkOperationJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Get job history
   */
  getJobHistory(limit: number = 50): BulkOperationJob[] {
    return this.jobHistory.slice(-limit);
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (job && (job.status === 'pending' || job.status === 'running')) {
      job.status = 'cancelled';
      job.progress.status = 'cancelled';
      job.updatedAt = new Date();
      this.logger.info(`Cancelled bulk operation: ${job.type}`, { jobId });
      return true;
    }
    return false;
  }

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
  } {
    const allJobs = [...this.activeJobs.values(), ...this.jobHistory];
    const completedJobs = allJobs.filter(job => job.status === 'completed');
    const failedJobs = allJobs.filter(job => job.status === 'failed');
    
    const totalDuration = completedJobs.reduce((sum, job) => {
      if (job.result) {
        return sum + job.result.duration;
      }
      return sum;
    }, 0);

    const totalItemsProcessed = completedJobs.reduce((sum, job) => {
      if (job.result) {
        return sum + job.result.processedItems;
      }
      return sum;
    }, 0);

    return {
      activeJobs: this.activeJobs.size,
      totalJobs: allJobs.length,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      averageDuration: completedJobs.length > 0 ? totalDuration / completedJobs.length : 0,
      totalItemsProcessed
    };
  }

  /**
   * Execute operation asynchronously
   */
  private async executeOperationAsync<T, R>(
    job: BulkOperationJob,
    items: T[],
    operation: (item: T, index: number) => Promise<R>,
    options: BulkOperationOptions
  ): Promise<void> {
    const startTime = Date.now();
    const batchSize = options.batchSize || 10;
    const maxConcurrency = options.maxConcurrency || 5;
    const delayBetweenBatches = options.delayBetweenBatches || 100;
    const continueOnError = options.continueOnError !== false;
    const timeout = options.timeout || 300000; // 5 minutes default

    job.status = 'running';
    job.progress.status = 'running';
    job.progress.startTime = new Date();
    job.progress.totalBatches = Math.ceil(items.length / batchSize);

    const results: R[] = [];
    const errors: BulkOperationError[] = [];
    let processedItems = 0;
    let successfulItems = 0;
    let failedItems = 0;

    try {
      // Process items in batches
      for (let batchIndex = 0; batchIndex < job.progress.totalBatches; batchIndex++) {
        // Check if job was cancelled (status can be changed externally by cancelJob)
        const currentStatus = this.activeJobs.get(job.id)?.status;
        if (currentStatus === 'cancelled') {
          job.status = 'cancelled';
          break;
        }

        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, items.length);
        const batchItems = items.slice(batchStart, batchEnd);

        job.progress.currentBatch = batchIndex + 1;
        job.progress.lastUpdate = new Date();

        // Process batch with concurrency control
        const batchResults = await this.processBatch(
          batchItems,
          batchStart,
          operation,
          maxConcurrency,
          timeout,
          continueOnError
        );

        // Update progress
        processedItems += batchResults.processed;
        successfulItems += batchResults.successful;
        failedItems += batchResults.failed;
        errors.push(...batchResults.errors);
        results.push(...batchResults.results);

        job.progress.processedItems = processedItems;
        job.progress.successfulItems = successfulItems;
        job.progress.failedItems = failedItems;
        job.progress.percentage = Math.round((processedItems / items.length) * 100);
        job.progress.errors = errors;
        job.progress.estimatedTimeRemaining = this.calculateEstimatedTimeRemaining(
          startTime,
          processedItems,
          items.length
        );

        job.updatedAt = new Date();

        // Delay between batches if specified
        if (delayBetweenBatches > 0 && batchIndex < job.progress.totalBatches - 1) {
          await this.sleep(delayBetweenBatches);
        }
      }

      // Complete job
      const endTime = new Date();
      const duration = endTime.getTime() - startTime;

      const result: BulkOperationResult<R> = {
        success: failedItems === 0,
        totalItems: items.length,
        processedItems,
        successfulItems,
        failedItems,
        errors,
        results,
        duration,
        startTime: new Date(startTime),
        endTime
      };

      job.status = failedItems === 0 ? 'completed' : 'failed';
      job.progress.status = job.status;
      job.result = result;
      job.updatedAt = endTime;

      this.logger.info(`Completed bulk operation: ${job.type}`, {
        jobId: job.id,
        totalItems: items.length,
        successfulItems,
        failedItems,
        duration
      });

      // Move to history
      this.moveJobToHistory(job);

    } catch (error) {
      job.status = 'failed';
      job.progress.status = 'failed';
      job.updatedAt = new Date();

      this.logger.error(`Bulk operation failed: ${job.type}`, error as Error, {
        jobId: job.id,
        processedItems,
        successfulItems,
        failedItems
      });

      // Move to history
      this.moveJobToHistory(job);
    }
  }

  /**
   * Process a batch of items with concurrency control
   */
  private async processBatch<T, R>(
    batchItems: T[],
    startIndex: number,
    operation: (item: T, index: number) => Promise<R>,
    maxConcurrency: number,
    timeout: number,
    continueOnError: boolean
  ): Promise<{
    processed: number;
    successful: number;
    failed: number;
    errors: BulkOperationError[];
    results: R[];
  }> {
    const results: R[] = [];
    const errors: BulkOperationError[] = [];
    let successful = 0;
    let failed = 0;

    // Process items with concurrency control
    const semaphore = new Semaphore(maxConcurrency);
    const promises = batchItems.map(async (item, batchIndex) => {
      const globalIndex = startIndex + batchIndex;
      
      return semaphore.acquire(async () => {
        try {
          const result = await Promise.race([
            operation(item, globalIndex),
            this.createTimeoutPromise(timeout)
          ]);
          
          results.push(result);
          successful++;
          return { success: true, result, index: globalIndex };
        } catch (error) {
          const errorInfo: BulkOperationError = {
            itemIndex: globalIndex,
            item,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          };
          
          errors.push(errorInfo);
          failed++;
          
          if (!continueOnError) {
            throw error;
          }
          
          return { success: false, error: errorInfo, index: globalIndex };
        }
      });
    });

    await Promise.all(promises);

    return {
      processed: batchItems.length,
      successful,
      failed,
      errors,
      results
    };
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateEstimatedTimeRemaining(
    startTime: number,
    processedItems: number,
    totalItems: number
  ): number | undefined {
    if (processedItems === 0) {
      return undefined;
    }

    const elapsedTime = Date.now() - startTime;
    const averageTimePerItem = elapsedTime / processedItems;
    const remainingItems = totalItems - processedItems;
    
    return Math.round(averageTimePerItem * remainingItems);
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new AEMException(
          'Operation timeout',
          ErrorType.TIMEOUT_ERROR,
          true
        ));
      }, timeout);
    });
  }

  /**
   * Move job to history
   */
  private moveJobToHistory(job: BulkOperationJob): void {
    this.activeJobs.delete(job.id);
    this.jobHistory.push(job);
    
    // Maintain history size limit
    if (this.jobHistory.length > this.maxHistorySize) {
      this.jobHistory.shift();
    }
  }

  /**
   * Clean up old jobs
   */
  private cleanupOldJobs(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    this.jobHistory = this.jobHistory.filter(job => {
      return job.updatedAt > cutoffTime;
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Semaphore for concurrency control
 */
class Semaphore {
  private permits: number;
  private waitingQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.release();
        }
      };

      if (this.permits > 0) {
        this.permits--;
        execute();
      } else {
        this.waitingQueue.push(execute);
      }
    });
  }

  private release(): void {
    if (this.waitingQueue.length > 0) {
      const next = this.waitingQueue.shift();
      if (next) {
        next();
      }
    } else {
      this.permits++;
    }
  }
}

// Singleton instance
let bulkOperationsManager: BulkOperationsManager | null = null;

export function getBulkOperationsManager(): BulkOperationsManager {
  if (!bulkOperationsManager) {
    bulkOperationsManager = new BulkOperationsManager();
  }
  return bulkOperationsManager;
}
