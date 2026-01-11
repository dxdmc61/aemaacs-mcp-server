/**
 * System Operations Service for AEMaaCS read operations
 * Handles async jobs, system health, system info, bundle status, and log files
 */
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
export interface AsyncJob {
    id: string;
    topic: string;
    state: 'queued' | 'active' | 'succeeded' | 'failed' | 'cancelled' | 'dropped';
    created: Date;
    started?: Date;
    finished?: Date;
    jobConsumer?: string;
    resultMessage?: string;
    retryCount: number;
    retryMaxCount: number;
    properties: Record<string, any>;
}
export interface SystemHealth {
    status: 'ok' | 'warn' | 'critical' | 'unknown';
    checks: HealthCheck[];
    overallScore: number;
    timestamp: Date;
}
export interface HealthCheck {
    name: string;
    status: 'ok' | 'warn' | 'critical' | 'unknown';
    message?: string;
    details?: Record<string, any>;
    tags?: string[];
}
export interface SystemInfo {
    aemVersion: string;
    buildNumber?: string;
    runMode: string[];
    startupTime: Date;
    uptime: number;
    javaVersion: string;
    javaVendor: string;
    osName: string;
    osVersion: string;
    availableProcessors: number;
    maxMemory: number;
    totalMemory: number;
    freeMemory: number;
    usedMemory: number;
    systemProperties: Record<string, any>;
}
export interface BundleInfo {
    id: number;
    name: string;
    symbolicName: string;
    version: string;
    state: 'uninstalled' | 'installed' | 'resolved' | 'starting' | 'stopping' | 'active' | 'fragment';
    stateRaw: number;
    location?: string;
    lastModified: Date;
    fragment: boolean;
    services?: ServiceInfo[];
}
export interface ServiceInfo {
    id: number;
    objectClass: string[];
    usingBundles?: number[];
    properties: Record<string, any>;
}
export interface BundleStatus {
    totalBundles: number;
    activeBundles: number;
    resolvedBundles: number;
    installedBundles: number;
    fragmentBundles: number;
    bundles: BundleInfo[];
}
export interface LogFile {
    name: string;
    path: string;
    size: number;
    lastModified: Date;
    type: 'error' | 'access' | 'request' | 'audit' | 'other';
    canRead: boolean;
}
export interface LogFileContent {
    fileName: string;
    content: string;
    lines: LogLine[];
    totalLines: number;
    fromLine: number;
    toLine: number;
}
export interface LogLine {
    lineNumber: number;
    timestamp?: Date;
    level?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';
    logger?: string;
    message: string;
    thread?: string;
}
export interface GetAsyncJobsOptions {
    topic?: string;
    state?: 'queued' | 'active' | 'succeeded' | 'failed' | 'cancelled' | 'dropped';
    limit?: number;
    offset?: number;
}
export interface GetLogFilesOptions {
    type?: 'error' | 'access' | 'request' | 'audit' | 'other';
    pattern?: string;
}
export interface GetLogFileContentOptions {
    startLine?: number;
    endLine?: number;
    tail?: number;
    follow?: boolean;
}
export declare class SystemOperationsService {
    private client;
    private logger;
    constructor(client: AEMHttpClient);
    /**
     * Get async jobs for job monitoring
     */
    getAsyncJobs(options?: GetAsyncJobsOptions): Promise<AEMResponse<AsyncJob[]>>;
    /**
     * Get system health for health checks
     */
    getSystemHealth(): Promise<AEMResponse<SystemHealth>>;
    /**
     * Get system info for system information
     */
    getSystemInfo(): Promise<AEMResponse<SystemInfo>>;
    /**
     * Get bundle status for OSGi bundle monitoring
     */
    getBundleStatus(): Promise<AEMResponse<BundleStatus>>;
    /**
     * Get log files for log file access
     */
    getLogFiles(options?: GetLogFilesOptions): Promise<AEMResponse<LogFile[]>>;
    /**
     * Get log file content
     */
    getLogFileContent(fileName: string, options?: GetLogFileContentOptions): Promise<AEMResponse<LogFileContent>>;
    /**
     * Parse async jobs response
     */
    private parseAsyncJobsResponse;
    /**
     * Parse system health response
     */
    private parseSystemHealthResponse;
    /**
     * Parse system info response
     */
    private parseSystemInfoResponse;
    /**
     * Parse bundle status response
     */
    private parseBundleStatusResponse;
    /**
     * Parse log files response
     */
    private parseLogFilesResponse;
    /**
     * Parse log file content response
     */
    private parseLogFileContentResponse;
    /**
     * Map data to AsyncJob
     */
    private mapToAsyncJob;
    /**
     * Map data to BundleInfo
     */
    private mapToBundleInfo;
    /**
     * Map data to LogFile
     */
    private mapToLogFile;
    /**
     * Parse log line
     */
    private parseLogLine;
    /**
     * Map health status string to enum
     */
    private mapHealthStatus;
    /**
     * Map job state string to enum
     */
    private mapJobState;
    /**
     * Map bundle state string to enum
     */
    private mapBundleState;
    /**
     * Map log file type based on name
     */
    private mapLogFileType;
}
//# sourceMappingURL=system-operations-service.d.ts.map