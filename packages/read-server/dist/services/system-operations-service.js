/**
 * System Operations Service for AEMaaCS read operations
 * Handles async jobs, system health, system info, bundle status, and log files
 */
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';
export class SystemOperationsService {
    constructor(client) {
        this.client = client;
        this.logger = Logger.getInstance();
    }
    /**
     * Get async jobs for job monitoring
     */
    async getAsyncJobs(options = {}) {
        try {
            this.logger.debug('Getting async jobs', { options });
            const params = {
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
            const requestOptions = {
                cache: true,
                cacheTtl: 30000, // Cache for 30 seconds (jobs change frequently)
                context: {
                    operation: 'getAsyncJobs',
                    resource: '/system/console/slingevent'
                }
            };
            const response = await this.client.get('/system/console/slingevent.json', params, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to get async jobs', 'SERVER_ERROR', true, undefined, { response });
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
        }
        catch (error) {
            this.logger.error('Failed to get async jobs', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while getting async jobs', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * Get system health for health checks
     */
    async getSystemHealth() {
        try {
            this.logger.debug('Getting system health');
            const requestOptions = {
                cache: true,
                cacheTtl: 60000, // Cache for 1 minute
                context: {
                    operation: 'getSystemHealth',
                    resource: '/system/health'
                }
            };
            const response = await this.client.get('/system/health.json', undefined, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to get system health', 'SERVER_ERROR', true, undefined, { response });
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
        }
        catch (error) {
            this.logger.error('Failed to get system health', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while getting system health', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * Get system info for system information
     */
    async getSystemInfo() {
        try {
            this.logger.debug('Getting system info');
            const requestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'getSystemInfo',
                    resource: '/system/console/status-System%20Properties'
                }
            };
            const response = await this.client.get('/system/console/status-System%20Properties.json', undefined, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to get system info', 'SERVER_ERROR', true, undefined, { response });
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
        }
        catch (error) {
            this.logger.error('Failed to get system info', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while getting system info', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * Get bundle status for OSGi bundle monitoring
     */
    async getBundleStatus() {
        try {
            this.logger.debug('Getting bundle status');
            const requestOptions = {
                cache: true,
                cacheTtl: 120000, // Cache for 2 minutes
                context: {
                    operation: 'getBundleStatus',
                    resource: '/system/console/bundles'
                }
            };
            const response = await this.client.get('/system/console/bundles.json', undefined, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to get bundle status', 'SERVER_ERROR', true, undefined, { response });
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
        }
        catch (error) {
            this.logger.error('Failed to get bundle status', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while getting bundle status', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * Get log files for log file access
     */
    async getLogFiles(options = {}) {
        try {
            this.logger.debug('Getting log files', { options });
            const params = {};
            // Add type filter
            if (options.type) {
                params['type'] = options.type;
            }
            // Add pattern filter
            if (options.pattern) {
                params['pattern'] = options.pattern;
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'getLogFiles',
                    resource: '/system/console/slinglog'
                }
            };
            const response = await this.client.get('/system/console/slinglog/files.json', params, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to get log files', 'SERVER_ERROR', true, undefined, { response });
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
        }
        catch (error) {
            this.logger.error('Failed to get log files', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while getting log files', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * Get log file content
     */
    async getLogFileContent(fileName, options = {}) {
        try {
            this.logger.debug('Getting log file content', { fileName, options });
            if (!fileName) {
                throw new AEMException('File name is required', 'VALIDATION_ERROR', false);
            }
            const params = {
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
            const requestOptions = {
                cache: options.follow ? false : true,
                cacheTtl: options.follow ? 0 : 60000, // Cache for 1 minute unless following
                context: {
                    operation: 'getLogFileContent',
                    resource: `/system/console/slinglog/${fileName}`
                }
            };
            const response = await this.client.get('/system/console/slinglog/content.json', params, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to get log file content for ${fileName}`, 'SERVER_ERROR', true, undefined, { response });
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
        }
        catch (error) {
            this.logger.error('Failed to get log file content', error, { fileName });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting log file content for ${fileName}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, fileName });
        }
    }
    /**
     * Parse async jobs response
     */
    parseAsyncJobsResponse(data) {
        const jobs = [];
        if (Array.isArray(data)) {
            for (const job of data) {
                jobs.push(this.mapToAsyncJob(job));
            }
        }
        else if (data.jobs && Array.isArray(data.jobs)) {
            for (const job of data.jobs) {
                jobs.push(this.mapToAsyncJob(job));
            }
        }
        return jobs;
    }
    /**
     * Parse system health response
     */
    parseSystemHealthResponse(data) {
        const checks = [];
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
    parseSystemInfoResponse(data) {
        const props = data.props || data.properties || {};
        return {
            aemVersion: props['sling.product.version'] || props['aem.version'] || 'unknown',
            buildNumber: props['sling.product.build'] || props['aem.build'],
            runMode: (props['sling.run.modes'] || '').split(',').filter((mode) => mode.trim()),
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
    parseBundleStatusResponse(data) {
        const bundles = [];
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
    parseLogFilesResponse(data) {
        const logFiles = [];
        if (Array.isArray(data)) {
            for (const file of data) {
                logFiles.push(this.mapToLogFile(file));
            }
        }
        else if (data.files && Array.isArray(data.files)) {
            for (const file of data.files) {
                logFiles.push(this.mapToLogFile(file));
            }
        }
        return logFiles;
    }
    /**
     * Parse log file content response
     */
    parseLogFileContentResponse(data, fileName) {
        const lines = [];
        const content = data.content || '';
        if (data.lines && Array.isArray(data.lines)) {
            for (let i = 0; i < data.lines.length; i++) {
                const line = data.lines[i];
                lines.push(this.parseLogLine(line, i + (data.fromLine || 1)));
            }
        }
        else if (content) {
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
    mapToAsyncJob(data) {
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
    mapToBundleInfo(data) {
        const services = [];
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
    mapToLogFile(data) {
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
    parseLogLine(line, lineNumber) {
        // Basic log line parsing - can be enhanced for specific log formats
        const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[.,]\d{3})/);
        const levelMatch = line.match(/\b(ERROR|WARN|INFO|DEBUG|TRACE)\b/);
        const threadMatch = line.match(/\[([^\]]+)\]/);
        const loggerMatch = line.match(/\b([a-zA-Z0-9._]+\.[A-Z][a-zA-Z0-9._]*)\b/);
        return {
            lineNumber,
            timestamp: timestampMatch ? new Date(timestampMatch[1].replace(',', '.')) : undefined,
            level: levelMatch ? levelMatch[1] : undefined,
            thread: threadMatch ? threadMatch[1] : undefined,
            logger: loggerMatch ? loggerMatch[1] : undefined,
            message: line
        };
    }
    /**
     * Map health status string to enum
     */
    mapHealthStatus(status) {
        if (!status)
            return 'unknown';
        const statusLower = status.toLowerCase();
        if (statusLower === 'ok' || statusLower === 'green')
            return 'ok';
        if (statusLower === 'warn' || statusLower === 'warning' || statusLower === 'yellow')
            return 'warn';
        if (statusLower === 'critical' || statusLower === 'error' || statusLower === 'red')
            return 'critical';
        return 'unknown';
    }
    /**
     * Map job state string to enum
     */
    mapJobState(state) {
        if (!state)
            return 'queued';
        const stateLower = state.toLowerCase();
        if (stateLower === 'active' || stateLower === 'running')
            return 'active';
        if (stateLower === 'succeeded' || stateLower === 'completed')
            return 'succeeded';
        if (stateLower === 'failed' || stateLower === 'error')
            return 'failed';
        if (stateLower === 'cancelled')
            return 'cancelled';
        if (stateLower === 'dropped')
            return 'dropped';
        return 'queued';
    }
    /**
     * Map bundle state string to enum
     */
    mapBundleState(state) {
        if (!state)
            return 'installed';
        const stateLower = state.toLowerCase();
        if (stateLower === 'uninstalled')
            return 'uninstalled';
        if (stateLower === 'installed')
            return 'installed';
        if (stateLower === 'resolved')
            return 'resolved';
        if (stateLower === 'starting')
            return 'starting';
        if (stateLower === 'stopping')
            return 'stopping';
        if (stateLower === 'active')
            return 'active';
        if (stateLower === 'fragment')
            return 'fragment';
        return 'installed';
    }
    /**
     * Map log file type based on name
     */
    mapLogFileType(fileName) {
        const nameLower = fileName.toLowerCase();
        if (nameLower.includes('error'))
            return 'error';
        if (nameLower.includes('access'))
            return 'access';
        if (nameLower.includes('request'))
            return 'request';
        if (nameLower.includes('audit'))
            return 'audit';
        return 'other';
    }
}
//# sourceMappingURL=system-operations-service.js.map