import { createApp } from './app';
import { config } from './infrastructure/config/env';
import { logger } from './infrastructure/logging/logger';
import { prisma } from './infrastructure/prisma/client';

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info(`SmartBooking API listening on port ${config.PORT} (${config.NODE_ENV})`);
});

/** Graceful shutdown: stop accepting connections, then close the DB pool. */
function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  // Force-exit if connections do not drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
