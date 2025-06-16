#!/usr/bin/env node

import { VcpkgPackageReadmeMcpServer } from './server.js';
import { logger } from './utils/logger.js';

async function main() {
  try {
    const server = new VcpkgPackageReadmeMcpServer();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    logger.info('Starting vcpkg package README MCP server...');
    await server.run();
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Unhandled error in main', { error });
    process.exit(1);
  });
}