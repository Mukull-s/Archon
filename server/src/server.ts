import { createApp } from './app';
import { env } from './config';
import { logger } from './utils';


const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Archon API running`, {
    port: env.PORT,
    env: env.NODE_ENV,
    url: `http://localhost:${env.PORT}`,
  });
  logger.info(`📋 Health check: http://localhost:${env.PORT}/api/health`);
});

// Set connection and header timeouts to 10 minutes to avoid premature drop on large repositories
server.timeout = 600000;
server.keepAliveTimeout = 600000;
server.headersTimeout = 605000;


function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown — connections did not close in time.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));


process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception — shutting down', {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

export default server;
