/**
 * Unit tests for System Operations Service
 */

import { SystemOperationsService, AsyncJob, SystemHealth, SystemInfo, BundleStatus, LogFile, LogFileContent, GetAsyncJobsOptions, GetLogFilesOptions, GetLogFileContentOptions } from '../services/system-operations-service.js';
import { AEMHttpClient } from '@aemaacs-mcp/shared';
import { AEMResponse } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';

// Mock the AEM HTTP Client
jest.mock('../../../shared/src/client/aem-http-client.js');
jest.mock('../../../shared/src/utils/logger.js');

describe('SystemOperationsService', () => {
  let systemOpsService: SystemOperationsService;
  let mockClient: jest.Mocked<AEMHttpClient>;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      upload: jest.fn(),
      getStats: jest.fn(),
      clearCache: jest.fn(),
      resetCircuitBreaker: jest.fn(),
      close: jest.fn()
    } as unknown as jest.Mocked<AEMHttpClient>;

    systemOpsService = new SystemOperationsService(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAsyncJobs', () => {
    const mockJobsResponse = {
      success: true,
      data: {
        jobs: [
          {
            id: 'job-1',
            topic: 'com/adobe/granite/workflow/job',
            state: 'active',
            created: '2024-01-15T10:30:00.000Z',
            started: '2024-01-15T10:31:00.000Z',
            jobConsumer: 'WorkflowJobConsumer',
            retryCount: '0',
            retryMaxCount: '3',
            properties: {
              'workflow.instance.id': 'workflow-123',
              'payload': '/content/mysite/en/home'
            }
          },
          {
            id: 'job-2',
            topic: 'com/adobe/granite/replication/job',
            state: 'succeeded',
            created: '2024-01-15T10:25:00.000Z',
            started: '2024-01-15T10:26:00.000Z',
            finished: '2024-01-15T10:27:00.000Z',
            jobConsumer: 'ReplicationJobConsumer',
            resultMessage: 'Content replicated successfully',
            retryCount: '0',
            retryMaxCount: '5'
          },
          {
            id: 'job-3',
            topic: 'com/adobe/granite/maintenance/job',
            state: 'failed',
            created: '2024-01-15T10:20:00.000Z',
            started: '2024-01-15T10:21:00.000Z',
            finished: '2024-01-15T10:22:00.000Z',
            jobConsumer: 'MaintenanceJobConsumer',
            resultMessage: 'Job failed due to insufficient permissions',
            retryCount: '2',
            retryMaxCount: '3'
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 150,
        cached: false
      }
    };

    it('should get async jobs successfully', async () => {
      mockClient.get.mockResolvedValue(mockJobsResponse);

      const result = await systemOpsService.getAsyncJobs();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      
      const job1 = result.data![0];
      expect(job1.id).toBe('job-1');
      expect(job1.topic).toBe('com/adobe/granite/workflow/job');
      expect(job1.state).toBe('active');
      expect(job1.created).toEqual(new Date('2024-01-15T10:30:00.000Z'));
      expect(job1.started).toEqual(new Date('2024-01-15T10:31:00.000Z'));
      expect(job1.jobConsumer).toBe('WorkflowJobConsumer');
      expect(job1.retryCount).toBe(0);
      expect(job1.retryMaxCount).toBe(3);
      expect(job1.properties).toEqual({
        'workflow.instance.id': 'workflow-123',
        'payload': '/content/mysite/en/home'
      });

      const job2 = result.data![1];
      expect(job2.state).toBe('succeeded');
      expect(job2.finished).toEqual(new Date('2024-01-15T10:27:00.000Z'));
      expect(job2.resultMessage).toBe('Content replicated successfully');

      const job3 = result.data![2];
      expect(job3.state).toBe('failed');
      expect(job3.retryCount).toBe(2);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/system/console/slingevent.json',
        expect.objectContaining({
          'p.limit': 50,
          'p.offset': 0
        }),
        expect.objectContaining({
          cacheTtl: 30000
        })
      );
    });

    it('should get jobs with filtering options', async () => {
      mockClient.get.mockResolvedValue(mockJobsResponse);

      const options: GetAsyncJobsOptions = {
        topic: 'com/adobe/granite/workflow/job',
        state: 'active',
        limit: 25,
        offset: 10
      };

      await systemOpsService.getAsyncJobs(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/system/console/slingevent.json',
        expect.objectContaining({
          'topic': 'com/adobe/granite/workflow/job',
          'state': 'active',
          'p.limit': 25,
          'p.offset': 10
        }),
        expect.any(Object)
      );
    });

    it('should handle array format response', async () => {
      const arrayResponse = {
        ...mockJobsResponse,
        data: [
          {
            id: 'job-1',
            topic: 'test/topic',
            state: 'queued',
            created: '2024-01-15T10:30:00.000Z',
            retryCount: '0',
            retryMaxCount: '1'
          }
        ]
      };

      mockClient.get.mockResolvedValue(arrayResponse);

      const result = await systemOpsService.getAsyncJobs();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe('job-1');
    });
  });

  describe('getSystemHealth', () => {
    const mockHealthResponse = {
      success: true,
      data: {
        status: 'ok',
        score: '85',
        results: [
          {
            name: 'Disk Space Check',
            status: 'ok',
            message: 'Sufficient disk space available',
            details: {
              'available': '50GB',
              'used': '30GB',
              'total': '80GB'
            },
            tags: ['disk', 'storage']
          },
          {
            name: 'Memory Check',
            status: 'warn',
            message: 'Memory usage is high',
            details: {
              'used': '7GB',
              'max': '8GB',
              'percentage': '87.5'
            },
            tags: ['memory', 'performance']
          },
          {
            name: 'Bundle Check',
            status: 'critical',
            message: 'Some bundles are not active',
            details: {
              'total': '500',
              'active': '485',
              'failed': '15'
            },
            tags: ['osgi', 'bundles']
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 200,
        cached: false
      }
    };

    it('should get system health successfully', async () => {
      mockClient.get.mockResolvedValue(mockHealthResponse);

      const result = await systemOpsService.getSystemHealth();

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('ok');
      expect(result.data!.overallScore).toBe(85);
      expect(result.data!.checks).toHaveLength(3);

      const check1 = result.data!.checks[0];
      expect(check1.name).toBe('Disk Space Check');
      expect(check1.status).toBe('ok');
      expect(check1.message).toBe('Sufficient disk space available');
      expect(check1.details).toEqual({
        'available': '50GB',
        'used': '30GB',
        'total': '80GB'
      });
      expect(check1.tags).toEqual(['disk', 'storage']);

      const check2 = result.data!.checks[1];
      expect(check2.status).toBe('warn');

      const check3 = result.data!.checks[2];
      expect(check3.status).toBe('critical');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/system/health.json',
        undefined,
        expect.objectContaining({
          cacheTtl: 60000
        })
      );
    });

    it('should handle different health status values', async () => {
      const testCases = [
        { input: 'green', expected: 'ok' },
        { input: 'yellow', expected: 'warn' },
        { input: 'warning', expected: 'warn' },
        { input: 'red', expected: 'critical' },
        { input: 'error', expected: 'critical' },
        { input: 'unknown', expected: 'unknown' }
      ];

      for (const testCase of testCases) {
        const response = {
          ...mockHealthResponse,
          data: {
            ...mockHealthResponse.data,
            status: testCase.input
          }
        };

        mockClient.get.mockResolvedValue(response);

        const result = await systemOpsService.getSystemHealth();
        expect(result.data!.status).toBe(testCase.expected);

        jest.clearAllMocks();
      }
    });
  });

  describe('getSystemInfo', () => {
    const mockSystemInfoResponse = {
      success: true,
      data: {
        props: {
          'sling.product.version': '6.5.0',
          'sling.product.build': '20240115-123456',
          'sling.run.modes': 'author,crx3,crx3tar',
          'felix.startlevel.bundle': '1705312200000',
          'java.vm.uptime': '86400000',
          'java.version': '11.0.16',
          'java.vendor': 'Eclipse Adoptium',
          'os.name': 'Linux',
          'os.version': '5.4.0-74-generic',
          'java.vm.availableProcessors': '4',
          'java.vm.maxMemory': '8589934592',
          'java.vm.totalMemory': '4294967296',
          'java.vm.freeMemory': '1073741824'
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 100,
        cached: false
      }
    };

    it('should get system info successfully', async () => {
      mockClient.get.mockResolvedValue(mockSystemInfoResponse);

      const result = await systemOpsService.getSystemInfo();

      expect(result.success).toBe(true);
      expect(result.data!.aemVersion).toBe('6.5.0');
      expect(result.data!.buildNumber).toBe('20240115-123456');
      expect(result.data!.runMode).toEqual(['author', 'crx3', 'crx3tar']);
      expect(result.data!.uptime).toBe(86400000);
      expect(result.data!.javaVersion).toBe('11.0.16');
      expect(result.data!.javaVendor).toBe('Eclipse Adoptium');
      expect(result.data!.osName).toBe('Linux');
      expect(result.data!.osVersion).toBe('5.4.0-74-generic');
      expect(result.data!.availableProcessors).toBe(4);
      expect(result.data!.maxMemory).toBe(8589934592);
      expect(result.data!.totalMemory).toBe(4294967296);
      expect(result.data!.freeMemory).toBe(1073741824);
      expect(result.data!.usedMemory).toBe(3221225472); // totalMemory - freeMemory

      expect(mockClient.get).toHaveBeenCalledWith(
        '/system/console/status-System%20Properties.json',
        undefined,
        expect.objectContaining({
          cacheTtl: 300000
        })
      );
    });

    it('should handle missing properties gracefully', async () => {
      const minimalResponse = {
        ...mockSystemInfoResponse,
        data: {
          props: {
            'java.version': '8.0.0'
          }
        }
      };

      mockClient.get.mockResolvedValue(minimalResponse);

      const result = await systemOpsService.getSystemInfo();

      expect(result.success).toBe(true);
      expect(result.data!.aemVersion).toBe('unknown');
      expect(result.data!.javaVersion).toBe('8.0.0');
      expect(result.data!.runMode).toEqual(['']);
    });
  });

  describe('getBundleStatus', () => {
    const mockBundleStatusResponse = {
      success: true,
      data: {
        data: [
          {
            id: '1',
            name: 'System Bundle',
            symbolicName: 'org.apache.felix.framework',
            version: '7.0.5',
            state: 'active',
            stateRaw: '32',
            location: 'System Bundle',
            lastModified: '1705312200000',
            fragment: false,
            services: [
              {
                id: '1',
                objectClass: ['org.osgi.framework.BundleContext'],
                properties: {
                  'service.id': '1'
                }
              }
            ]
          },
          {
            id: '2',
            name: 'Apache Sling Commons Log',
            symbolicName: 'org.apache.sling.commons.log',
            version: '5.4.0',
            state: 'active',
            stateRaw: '32',
            lastModified: '1705312210000',
            fragment: false
          },
          {
            id: '3',
            name: 'Fragment Bundle',
            symbolicName: 'com.example.fragment',
            version: '1.0.0',
            state: 'resolved',
            stateRaw: '4',
            lastModified: '1705312220000',
            fragment: true
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 180,
        cached: false
      }
    };

    it('should get bundle status successfully', async () => {
      mockClient.get.mockResolvedValue(mockBundleStatusResponse);

      const result = await systemOpsService.getBundleStatus();

      expect(result.success).toBe(true);
      expect(result.data!.totalBundles).toBe(3);
      expect(result.data!.activeBundles).toBe(2);
      expect(result.data!.resolvedBundles).toBe(1);
      expect(result.data!.installedBundles).toBe(0);
      expect(result.data!.fragmentBundles).toBe(1);
      expect(result.data!.bundles).toHaveLength(3);

      const bundle1 = result.data!.bundles[0];
      expect(bundle1.id).toBe(1);
      expect(bundle1.name).toBe('System Bundle');
      expect(bundle1.symbolicName).toBe('org.apache.felix.framework');
      expect(bundle1.version).toBe('7.0.5');
      expect(bundle1.state).toBe('active');
      expect(bundle1.stateRaw).toBe(32);
      expect(bundle1.fragment).toBe(false);
      expect(bundle1.services).toHaveLength(1);
      expect(bundle1.services![0].objectClass).toEqual(['org.osgi.framework.BundleContext']);

      const bundle3 = result.data!.bundles[2];
      expect(bundle3.fragment).toBe(true);
      expect(bundle3.state).toBe('resolved');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/system/console/bundles.json',
        undefined,
        expect.objectContaining({
          cacheTtl: 120000
        })
      );
    });

    it('should handle different bundle states', async () => {
      const testCases = [
        { input: 'uninstalled', expected: 'uninstalled' },
        { input: 'installed', expected: 'installed' },
        { input: 'resolved', expected: 'resolved' },
        { input: 'starting', expected: 'starting' },
        { input: 'stopping', expected: 'stopping' },
        { input: 'active', expected: 'active' },
        { input: 'fragment', expected: 'fragment' }
      ];

      for (const testCase of testCases) {
        const response = {
          ...mockBundleStatusResponse,
          data: {
            data: [{
              id: '1',
              name: 'Test Bundle',
              symbolicName: 'test.bundle',
              version: '1.0.0',
              state: testCase.input,
              stateRaw: '1',
              lastModified: '1705312200000',
              fragment: false
            }]
          }
        };

        mockClient.get.mockResolvedValue(response);

        const result = await systemOpsService.getBundleStatus();
        expect(result.data!.bundles[0].state).toBe(testCase.expected);

        jest.clearAllMocks();
      }
    });
  });

  describe('getLogFiles', () => {
    const mockLogFilesResponse = {
      success: true,
      data: {
        files: [
          {
            name: 'error.log',
            path: '/opt/aem/crx-quickstart/logs/error.log',
            size: '1048576',
            lastModified: '1705312200000',
            canRead: true
          },
          {
            name: 'access.log',
            path: '/opt/aem/crx-quickstart/logs/access.log',
            size: '2097152',
            lastModified: '1705312100000',
            canRead: true
          },
          {
            name: 'request.log',
            path: '/opt/aem/crx-quickstart/logs/request.log',
            size: '524288',
            lastModified: '1705312000000',
            canRead: false
          }
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 120,
        cached: false
      }
    };

    it('should get log files successfully', async () => {
      mockClient.get.mockResolvedValue(mockLogFilesResponse);

      const result = await systemOpsService.getLogFiles();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      
      const errorLog = result.data![0];
      expect(errorLog.name).toBe('error.log');
      expect(errorLog.path).toBe('/opt/aem/crx-quickstart/logs/error.log');
      expect(errorLog.size).toBe(1048576);
      expect(errorLog.lastModified).toEqual(new Date(1705312200000));
      expect(errorLog.type).toBe('error');
      expect(errorLog.canRead).toBe(true);

      const accessLog = result.data![1];
      expect(accessLog.type).toBe('access');

      const requestLog = result.data![2];
      expect(requestLog.type).toBe('request');
      expect(requestLog.canRead).toBe(false);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/system/console/slinglog/files.json',
        {},
        expect.objectContaining({
          cacheTtl: 300000
        })
      );
    });

    it('should get log files with filtering options', async () => {
      mockClient.get.mockResolvedValue(mockLogFilesResponse);

      const options: GetLogFilesOptions = {
        type: 'error',
        pattern: '*.log'
      };

      await systemOpsService.getLogFiles(options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/system/console/slinglog/files.json',
        expect.objectContaining({
          'type': 'error',
          'pattern': '*.log'
        }),
        expect.any(Object)
      );
    });
  });

  describe('getLogFileContent', () => {
    const mockLogContentResponse = {
      success: true,
      data: {
        content: '2024-01-15 10:30:00,123 ERROR [main] com.example.Service - An error occurred\n2024-01-15 10:30:01,456 WARN [worker-1] com.example.Worker - Warning message\n2024-01-15 10:30:02,789 INFO [http-thread] com.example.Controller - Request processed',
        totalLines: '3',
        fromLine: '1',
        toLine: '3',
        lines: [
          '2024-01-15 10:30:00,123 ERROR [main] com.example.Service - An error occurred',
          '2024-01-15 10:30:01,456 WARN [worker-1] com.example.Worker - Warning message',
          '2024-01-15 10:30:02,789 INFO [http-thread] com.example.Controller - Request processed'
        ]
      },
      metadata: {
        timestamp: new Date(),
        requestId: 'test-request-id',
        duration: 80,
        cached: false
      }
    };

    it('should get log file content successfully', async () => {
      const fileName = 'error.log';
      mockClient.get.mockResolvedValue(mockLogContentResponse);

      const result = await systemOpsService.getLogFileContent(fileName);

      expect(result.success).toBe(true);
      expect(result.data!.fileName).toBe(fileName);
      expect(result.data!.totalLines).toBe(3);
      expect(result.data!.fromLine).toBe(1);
      expect(result.data!.toLine).toBe(3);
      expect(result.data!.lines).toHaveLength(3);

      const line1 = result.data!.lines[0];
      expect(line1.lineNumber).toBe(1);
      expect(line1.level).toBe('ERROR');
      expect(line1.thread).toBe('main');
      expect(line1.message).toBe('2024-01-15 10:30:00,123 ERROR [main] com.example.Service - An error occurred');

      const line2 = result.data!.lines[1];
      expect(line2.level).toBe('WARN');
      expect(line2.thread).toBe('worker-1');

      const line3 = result.data!.lines[2];
      expect(line3.level).toBe('INFO');
      expect(line3.thread).toBe('http-thread');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/system/console/slinglog/content.json',
        expect.objectContaining({
          'file': fileName
        }),
        expect.objectContaining({
          cacheTtl: 60000
        })
      );
    });

    it('should get log content with options', async () => {
      const fileName = 'error.log';
      const options: GetLogFileContentOptions = {
        startLine: 10,
        endLine: 20,
        tail: 50,
        follow: true
      };

      mockClient.get.mockResolvedValue(mockLogContentResponse);

      await systemOpsService.getLogFileContent(fileName, options);

      expect(mockClient.get).toHaveBeenCalledWith(
        '/system/console/slinglog/content.json',
        expect.objectContaining({
          'file': fileName,
          'startLine': '10',
          'endLine': '20',
          'tail': '50'
        }),
        expect.objectContaining({
          cache: false,
          cacheTtl: 0
        })
      );
    });

    it('should throw validation error for empty file name', async () => {
      await expect(systemOpsService.getLogFileContent('')).rejects.toThrow(AEMException);
      await expect(systemOpsService.getLogFileContent('')).rejects.toThrow('File name is required');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockClient.get.mockRejectedValue(networkError);

      await expect(systemOpsService.getAsyncJobs()).rejects.toThrow(AEMException);
      await expect(systemOpsService.getAsyncJobs()).rejects.toThrow('Unexpected error while getting async jobs');
    });

    it('should preserve original AEMException', async () => {
      const originalError = new AEMException('Original error', 'AUTHENTICATION_ERROR', false);
      mockClient.get.mockRejectedValue(originalError);

      await expect(systemOpsService.getSystemHealth()).rejects.toThrow('Original error');
    });

    it('should handle malformed responses', async () => {
      const malformedResponse = {
        success: false,
        data: null
      };
      mockClient.get.mockResolvedValue(malformedResponse);

      await expect(systemOpsService.getBundleStatus()).rejects.toThrow(AEMException);
      await expect(systemOpsService.getBundleStatus()).rejects.toThrow('Failed to get bundle status');
    });
  });

  describe('caching behavior', () => {
    it('should use appropriate cache TTL for different operations', async () => {
      const mockResponse = {
        success: true,
        data: {},
        metadata: { cached: false }
      };

      mockClient.get.mockResolvedValue(mockResponse);

      // Test async jobs (30 seconds cache)
      await systemOpsService.getAsyncJobs();
      expect(mockClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          cacheTtl: 30000
        })
      );

      jest.clearAllMocks();

      // Test system health (1 minute cache)
      await systemOpsService.getSystemHealth();
      expect(mockClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          cacheTtl: 60000
        })
      );

      jest.clearAllMocks();

      // Test system info (5 minutes cache)
      await systemOpsService.getSystemInfo();
      expect(mockClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          cacheTtl: 300000
        })
      );
    });
  });
});
