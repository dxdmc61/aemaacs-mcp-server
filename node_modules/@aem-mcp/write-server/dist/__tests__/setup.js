/**
 * Test setup for write server
 */
import { ConfigManager } from '@aemaacs-mcp/shared';
// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.AEM_HOST = 'localhost';
process.env.AEM_PORT = '4502';
process.env.AEM_USERNAME = 'admin';
process.env.AEM_PASSWORD = 'admin';
process.env.SERVER_PORT = '8081';
process.env.LOG_LEVEL = 'error';
process.env.CACHE_ENABLED = 'false';
// Initialize config manager for tests
ConfigManager.getInstance();
// Global test timeout
jest.setTimeout(30000);
//# sourceMappingURL=setup.js.map