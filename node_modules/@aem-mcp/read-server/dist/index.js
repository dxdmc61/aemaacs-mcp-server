#!/usr/bin/env node
/**
 * AEM Read Server Entry Point
 * Supports both MCP protocol over STDIO and HTTP REST API
 */
// Load environment variables from .env file FIRST
// Set DOTENV_CONFIG_SILENT before importing to suppress any console output
process.env.DOTENV_CONFIG_SILENT = 'true';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
// Manually load .env to avoid dotenv v17's console output
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
    const envConfig = dotenv.parse(readFileSync(envPath));
    for (const key in envConfig) {
        if (process.env[key] === undefined) {
            process.env[key] = envConfig[key];
        }
    }
}
import { AEMHttpClient, ConfigManager, Logger } from '@aemaacs-mcp/shared';
import { STDIOHandler } from './mcp/stdio-handler.js';
async function main() {
    const logger = Logger.getInstance();
    try {
        // Load configuration
        const configManager = ConfigManager.getInstance();
        const config = configManager.loadReadServerConfig();
        logger.info('Starting AEM Read Server', {
            mode: process.argv.includes('--stdio') ? 'MCP/STDIO' : 'HTTP',
            aemHost: config.aem.host
        });
        // Initialize AEM HTTP client (uses ConfigManager internally for AEM connection config)
        const client = new AEMHttpClient({
            enableCircuitBreaker: true,
            enableCaching: true,
            enableRetry: true
        });
        // Check if running in STDIO mode (for MCP)
        if (process.argv.includes('--stdio')) {
            logger.info('Starting in MCP STDIO mode');
            const stdioHandler = new STDIOHandler(client);
            stdioHandler.start();
            // Handle graceful shutdown
            process.on('SIGINT', () => {
                logger.info('Received SIGINT, shutting down gracefully');
                stdioHandler.stop();
                process.exit(0);
            });
            process.on('SIGTERM', () => {
                logger.info('Received SIGTERM, shutting down gracefully');
                stdioHandler.stop();
                process.exit(0);
            });
        }
        else {
            // HTTP mode
            logger.info('Starting in HTTP mode');
            const { HTTPHandler } = await import('./http/http-handler.js');
            const httpHandler = new HTTPHandler(client, config);
            await httpHandler.start();
            logger.info('AEM Read Server started successfully', {
                host: config.server.host,
                port: config.server.port
            });
            // Handle graceful shutdown
            process.on('SIGINT', () => {
                logger.info('Received SIGINT, shutting down gracefully');
                process.exit(0);
            });
            process.on('SIGTERM', () => {
                logger.info('Received SIGTERM, shutting down gracefully');
                process.exit(0);
            });
        }
    }
    catch (error) {
        logger.error('Failed to start AEM Read Server', error);
        process.exit(1);
    }
}
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    const logger = Logger.getInstance();
    logger.error('Unhandled promise rejection', reason, { promise });
    process.exit(1);
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    const logger = Logger.getInstance();
    logger.error('Uncaught exception', error);
    process.exit(1);
});
main().catch((error) => {
    const logger = Logger.getInstance();
    logger.error('Fatal error in main', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map