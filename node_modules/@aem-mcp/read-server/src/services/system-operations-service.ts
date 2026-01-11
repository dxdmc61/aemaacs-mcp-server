/**
 * System Operations Service for AEMaaCS read operations
 * Handles async jobs, system health, system info, bundle status, and log files
 */

import { AEMHttpClient, RequestOptions } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

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

export class SystemOperationsService {
  private client: AEMHttpClient;
  private logger: Logger;

  constructor(client: AEMHttpClient) {
    this.client = client;
    this.logger = Logger.getInstance();
  }

  /**
   * Get async jobs for job monitoring
   */
  async getAsyncJobs(options: GetAsyncJobsOptions = {}): Promise<AEMResponse<AsyncJob[]>> {
    try {
      this.logger.debug('Getting async jobs', { options });

      const params: Record<string, any> = {
        'p.limit': options.limit || 50,
        'p.offset': options.offset || 0
      };

      // Add topic filter
      if (options.topic) {
        params['topic'] = options.topic;
      }

      // Add state filter
      if (options.state) {
        params['state'] = options.state;
      }

      const requestOptions: RequestOptions = {
        cache: true,
        cacheTtl: 30000, // Cache for 30 seconds (jobs change frequently)
        context: {
          operation: 'getAsyncJobs',
          resource: '/system/console/slingevent'
        }
      };

      const response = await this.client.get<any>('/system/console/slingevent.json', params, requestOptions);

      if (!response.success || !response.data) {
        throw new AEMException(
          'Failed to get async jobs',
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const jobs = this.parseAsyncJobsResponse(response.data);

      this.logger.debug('Successfully retrieved async jobs', { 
        jobCount: jobs.length
      });

      return {
        success: true,
        data: jobs,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0,
          cached: response.metadata?.cached
        }
      };

    } catch (error) {
      this.logger.error('Failed to get async jobs', error as Error);
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while getting async jobs',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error }
      );
    }
  }

  /**
   * Get system health for health checks
   */
  async getSystemHealth(): Promise<AEMResponse<SystemHealth>> {
    try {
      this.logger.debug('Getting system health');

      const requestOptions: RequestOptions = {
        cache: true,
        cacheTtl: 60000, // Cache for 1 minute
        context: {
          operation: 'getSystemHealth',
          resource: '/system/health'
        }
      };

      const response = await this.client.get<any>('/system/health.json', undefined, requestOptions);

      if (!response.success || !response.data) {
        throw new AEMException(
          'Failed to get system health',
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const systemHealth = this.parseSystemHealthResponse(response.data);

      this.logger.debug('Successfully retrieved system health', { 
        status: systemHealth.status,
        checkCount: systemHealth.checks.length
      });

      return {
        success: true,
        data: systemHealth,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0,
          cached: response.metadata?.cached
        }
      };

    } catch (error) {
      this.logger.error('Failed to get system health', error as Error);
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while getting system health',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error }
      );
    }
  }

  /**
   * Get system info for system information
   */
  async getSystemInfo(): Promise<AEMResponse<SystemInfo>> {
    try {
      this.logger.debug('Getting system info');

      const requestOptions: RequestOptions = {
        cache: true,
        cacheTtl: 300000, // Cache for 5 minutes
        context: {
          operation: 'getSystemInfo',
          resource: '/system/console/status-System%20Properties'
        }
      };

      const response = await this.client.get<any>('/system/console/status-System%20Properties.json', undefined, requestOptions);

      if (!response.success || !response.data) {
        throw new AEMException(
          'Failed to get system info',
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const systemInfo = this.parseSystemInfoResponse(response.data);

      this.logger.debug('Successfully retrieved system info', { 
        aemVersion: systemInfo.aemVersion,
        uptime: systemInfo.uptime
      });

      return {
        success: true,
        data: systemInfo,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0,
          cached: response.metadata?.cached
        }
      };

    } catch (error) {
      this.logger.error('Failed to get system info', error as Error);
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while getting system info',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error }
      );
    }
  }

  /**
   * Get bundle status for OSGi bundle monitoring
   */
  async getBundleStatus(): Promise<AEMResponse<BundleStatus>> {
    try {
      this.logger.debug('Getting bundle status');

      const requestOptions: RequestOptions = {
        cache: true,
        cacheTtl: 120000, // Cache for 2 minutes
        context: {
          operation: 'getBundleStatus',
          resource: '/system/console/bundles'
        }
      };

      const response = await this.client.get<any>('/system/console/bundles.json', undefined, requestOptions);

      if (!response.success || !response.data) {
        throw new AEMException(
          'Failed to get bundle status',
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const bundleStatus = this.parseBundleStatusResponse(response.data);

      this.logger.debug('Successfully retrieved bundle status', { 
        totalBundles: bundleStatus.totalBundles,
        activeBundles: bundleStatus.activeBundles
      });

      return {
        success: true,
        data: bundleStatus,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0,
          cached: response.metadata?.cached
        }
      };

    } catch (error) {
      this.logger.error('Failed to get bundle status', error as Error);
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while getting bundle status',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error }
      );
    }
  }

  /**
   * Get log files for log file access
   */
  async getLogFiles(options: GetLogFilesOptions = {}): Promise<AEMResponse<LogFile[]>> {
    try {
      this.logger.debug('Getting log files', { options });

      const params: Record<string, any> = {};

      // Add type filter
      if (options.type) {
        params['type'] = options.type;
      }

      // Add pattern filter
      if (options.pattern) {
        params['pattern'] = options.pattern;
      }

      const requestOptions: RequestOptions = {
        cache: true,
        cacheTtl: 300000, // Cache for 5 minutes
        context: {
          operation: 'getLogFiles',
          resource: '/system/console/slinglog'
        }
      };

      const response = await this.client.get<any>('/system/console/slinglog/files.json', params, requestOptions);

      if (!response.success || !response.data) {
        throw new AEMException(
          'Failed to get log files',
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const logFiles = this.parseLogFilesResponse(response.data);

      this.logger.debug('Successfully retrieved log files', { 
        fileCount: logFiles.length
      });

      return {
        success: true,
        data: logFiles,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0,
          cached: response.metadata?.cached
        }
      };

    } catch (error) {
      this.logger.error('Failed to get log files', error as Error);
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        'Unexpected error while getting log files',
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error }
      );
    }
  }

  /**
   * Get log file content
   */
  async getLogFileContent(fileName: string, options: GetLogFileContentOptions = {}): Promise<AEMResponse<LogFileContent>> {
    try {
      this.logger.debug('Getting log file content', { fileName, options });

      if (!fileName) {
        throw new AEMException(
          'File name is required',
          'VALIDATION_ERROR',
          false
        );
      }

      const params: Record<string, any> = {
        'file': fileName
      };

      // Add line range options
      if (options.startLine !== undefined) {
        params['startLine'] = options.startLine.toString();
      }
      if (options.endLine !== undefined) {
        params['endLine'] = options.endLine.toString();
      }
      if (options.tail !== undefined) {
        params['tail'] = options.tail.toString();
      }

      const requestOptions: RequestOptions = {
        cache: options.follow ? false : true,
        cacheTtl: options.follow ? 0 : 60000, // Cache for 1 minute unless following
        context: {
          operation: 'getLogFileContent',
          resource: `/system/console/slinglog/${fileName}`
        }
      };

      const response = await this.client.get<any>('/system/console/slinglog/content.json', params, requestOptions);

      if (!response.success || !response.data) {
        throw new AEMException(
          `Failed to get log file content for ${fileName}`,
          'SERVER_ERROR',
          true,
          undefined,
          { response }
        );
      }

      const logFileContent = this.parseLogFileContentResponse(response.data, fileName);

      this.logger.debug('Successfully retrieved log file content', { 
        fileName,
        totalLines: logFileContent.totalLines
      });

      return {
        success: true,
        data: logFileContent,
        metadata: {
          timestamp: new Date(),
          requestId: response.metadata?.requestId || '',
          duration: response.metadata?.duration || 0,
          cached: response.metadata?.cached
        }
      };

    } catch (error) {
      this.logger.error('Failed to get log file content', error as Error, { fileName });
      
      if (error instanceof AEMException) {
        throw error;
      }
      
      throw new AEMException(
        `Unexpected error while getting log file content for ${fileName}`,
        'UNKNOWN_ERROR',
        false,
        undefined,
        { originalError: error, fileName }
      );
    }
  }

  /**
   * Parse async jobs response
   */
  private parseAsyncJobsResponse(data: any): AsyncJob[] {
    const jobs: AsyncJob[] = [];
    
    if (Array.isArray(data)) {
      for (const job of data) {
        jobs.push(this.mapToAsyncJob(job));
      }
    } else if (data.jobs && Array.isArray(data.jobs)) {
      for (const job of data.jobs) {
        jobs.push(this.mapToAsyncJob(job));
      }
    }
    
    return jobs;
  }

  /**
   * Parse system health response
   */
  private parseSystemHealthResponse(data: any): SystemHealth {
    const checks: HealthCheck[] = [];
    
    if (data.results && Array.isArray(data.results)) {
      for (const result of data.results) {
        checks.push({
          name: result.name || 'Unknown Check',
          status: this.mapHealthStatus(result.status),
          message: result.message,
          details: result.details || {},
          tags: result.tags || []
        });
      }
    }
    
    return {
      status: this.mapHealthStatus(data.status),
      checks,
      overallScore: parseInt(data.score) || 0,
      timestamp: new Date()
    };
  }

  /**
   * Parse system info response
   */
  private parseSystemInfoResponse(data: any): SystemInfo {
    const props = data.props || data.properties || {};
    
    return {
      aemVersion: props['sling.product.version'] || props['aem.version'] || 'unknown',
      buildNumber: props['sling.product.build'] || props['aem.build'],
      runMode: (props['sling.run.modes'] || '').split(',').filter((mode: string) => mode.trim()),
      startupTime: props['felix.startlevel.bundle'] ? new Date(parseInt(props['felix.startlevel.bundle'])) : new Date(),
      uptime: parseInt(props['java.vm.uptime']) || 0,
      javaVersion: props['java.version'] || 'unknown',
      javaVendor: props['java.vendor'] || 'unknown',
      osName: props['os.name'] || 'unknown',
      osVersion: props['os.version'] || 'unknown',
      availableProcessors: parseInt(props['java.vm.availableProcessors']) || 0,
      maxMemory: parseInt(props['java.vm.maxMemory']) || 0,
      totalMemory: parseInt(props['java.vm.totalMemory']) || 0,
      freeMemory: parseInt(props['java.vm.freeMemory']) || 0,
      usedMemory: (parseInt(props['java.vm.totalMemory']) || 0) - (parseInt(props['java.vm.freeMemory']) || 0),
      systemProperties: props
    };
  }

  /**
   * Parse bundle status response
   */
  private parseBundleStatusResponse(data: any): BundleStatus {
    const bundles: BundleInfo[] = [];
    
    if (data.data && Array.isArray(data.data)) {
      for (const bundle of data.data) {
        bundles.push(this.mapToBundleInfo(bundle));
      }
    }
    
    const activeBundles = bundles.filter(b => b.state === 'active').length;
    const resolvedBundles = bundles.filter(b => b.state === 'resolved').length;
    const installedBundles = bundles.filter(b => b.state === 'installed').length;
    const fragmentBundles = bundles.filter(b => b.fragment).length;
    
    return {
      totalBundles: bundles.length,
      activeBundles,
      resolvedBundles,
      installedBundles,
      fragmentBundles,
      bundles
    };
  }

  /**
   * Parse log files response
   */
  private parseLogFilesResponse(data: any): LogFile[] {
    const logFiles: LogFile[] = [];
    
    if (Array.isArray(data)) {
      for (const file of data) {
        logFiles.push(this.mapToLogFile(file));
      }
    } else if (data.files && Array.isArray(data.files)) {
      for (const file of data.files) {
        logFiles.push(this.mapToLogFile(file));
      }
    }
    
    return logFiles;
  }

  /**
   * Parse log file content response
   */
  private parseLogFileContentResponse(data: any, fileName: string): LogFileContent {
    const lines: LogLine[] = [];
    const content = data.content || '';
    
    if (data.lines && Array.isArray(data.lines)) {
      for (let i = 0; i < data.lines.length; i++) {
        const line = data.lines[i];
        lines.push(this.parseLogLine(line, i + (data.fromLine || 1)));
      }
    } else if (content) {
      // Parse content into lines
      const contentLines = content.split('\n');
      for (let i = 0; i < contentLines.length; i++) {
        lines.push(this.parseLogLine(contentLines[i], i + 1));
      }
    }
    
    return {
      fileName,
      content,
      lines,
      totalLines: parseInt(data.totalLines) || lines.length,
      fromLine: parseInt(data.fromLine) || 1,
      toLine: parseInt(data.toLine) || lines.length
    };
  }

  /**
   * Map data to AsyncJob
   */
  private mapToAsyncJob(data: any): AsyncJob {
    return {
      id: data.id || data.jobId || 'unknown',
      topic: data.topic || 'unknown',
      state: this.mapJobState(data.state),
      created: data.created ? new Date(data.created) : new Date(),
      started: data.started ? new Date(data.started) : undefined,
      finished: data.finished ? new Date(data.finished) : undefined,
      jobConsumer: data.jobConsumer,
      resultMessage: data.resultMessage,
      retryCount: parseInt(data.retryCount) || 0,
      retryMaxCount: parseInt(data.retryMaxCount) || 0,
      properties: data.properties || {}
    };
  }

  /**
   * Map data to BundleInfo
   */
  private mapToBundleInfo(data: any): BundleInfo {
    const services: ServiceInfo[] = [];
    
    if (data.services && Array.isArray(data.services)) {
      for (const service of data.services) {
        services.push({
          id: parseInt(service.id) || 0,
          objectClass: service.objectClass || [],
          usingBundles: service.usingBundles || [],
          properties: service.properties || {}
        });
      }
    }
    
    return {
      id: parseInt(data.id) || 0,
      name: data.name || 'unknown',
      symbolicName: data.symbolicName || data.name || 'unknown',
      version: data.version || '0.0.0',
      state: this.mapBundleState(data.state),
      stateRaw: parseInt(data.stateRaw) || 0,
      location: data.location,
      lastModified: data.lastModified ? new Date(parseInt(data.lastModified)) : new Date(),
      fragment: Boolean(data.fragment),
      services: services.length > 0 ? services : undefined
    };
  }

  /**
   * Map data to LogFile
   */
  private mapToLogFile(data: any): LogFile {
    return {
      name: data.name || 'unknown',
      path: data.path || data.name || 'unknown',
      size: parseInt(data.size) || 0,
      lastModified: data.lastModified ? new Date(data.lastModified) : new Date(),
      type: this.mapLogFileType(data.name || data.path || ''),
      canRead: Boolean(data.canRead !== false)
    };
  }

  /**
   * Parse log line
   */
  private parseLogLine(line: string, lineNumber: number): LogLine {
    // Basic log line parsing - can be enhanced for specific log formats
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[.,]\d{3})/);
    const levelMatch = line.match(/\b(ERROR|WARN|INFO|DEBUG|TRACE)\b/);
    const threadMatch = line.match(/\[([^\]]+)\]/);
    const loggerMatch = line.match(/\b([a-zA-Z0-9._]+\.[A-Z][a-zA-Z0-9._]*)\b/);
    
    return {
      lineNumber,
      timestamp: timestampMatch ? new Date(timestampMatch[1].replace(',', '.')) : undefined,
      level: levelMatch ? levelMatch[1] as any : undefined,
      thread: threadMatch ? threadMatch[1] : undefined,
      logger: loggerMatch ? loggerMatch[1] : undefined,
      message: line
    };
  }

  /**
   * Map health status string to enum
   */
  private mapHealthStatus(status: string): 'ok' | 'warn' | 'critical' | 'unknown' {
    if (!status) return 'unknown';
    
    const statusLower = status.toLowerCase();
    if (statusLower === 'ok' || statusLower === 'green') return 'ok';
    if (statusLower === 'warn' || statusLower === 'warning' || statusLower === 'yellow') return 'warn';
    if (statusLower === 'critical' || statusLower === 'error' || statusLower === 'red') return 'critical';
    
    return 'unknown';
  }

  /**
   * Map job state string to enum
   */
  private mapJobState(state: string): 'queued' | 'active' | 'succeeded' | 'failed' | 'cancelled' | 'dropped' {
    if (!state) return 'queued';
    
    const stateLower = state.toLowerCase();
    if (stateLower === 'active' || stateLower === 'running') return 'active';
    if (stateLower === 'succeeded' || stateLower === 'completed') return 'succeeded';
    if (stateLower === 'failed' || stateLower === 'error') return 'failed';
    if (stateLower === 'cancelled') return 'cancelled';
    if (stateLower === 'dropped') return 'dropped';
    
    return 'queued';
  }

  /**
   * Map bundle state string to enum
   */
  private mapBundleState(state: string): 'uninstalled' | 'installed' | 'resolved' | 'starting' | 'stopping' | 'active' | 'fragment' {
    if (!state) return 'installed';
    
    const stateLower = state.toLowerCase();
    if (stateLower === 'uninstalled') return 'uninstalled';
    if (stateLower === 'installed') return 'installed';
    if (stateLower === 'resolved') return 'resolved';
    if (stateLower === 'starting') return 'starting';
    if (stateLower === 'stopping') return 'stopping';
    if (stateLower === 'active') return 'active';
    if (stateLower === 'fragment') return 'fragment';
    
    return 'installed';
  }

  /**
   * Map log file type based on name
   */
  private mapLogFileType(fileName: string): 'error' | 'access' | 'request' | 'audit' | 'other' {
    const nameLower = fileName.toLowerCase();
    
    if (nameLower.includes('error')) return 'error';
    if (nameLower.includes('access')) return 'access';
    if (nameLower.includes('request')) return 'request';
    if (nameLower.includes('audit')) return 'audit';
    
    return 'other';
  }
}
