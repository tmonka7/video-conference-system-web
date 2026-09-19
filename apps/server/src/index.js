import http from 'node:http';
import { API_PREFIX, createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './db/connect.js';
import { createSocketServer } from './realtime/index.js';

async function bootstrap() {
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);
  const io = createSocketServer(server);

  server.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `API listening on http://localhost:${env.PORT}${API_PREFIX}`,
    );
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down');
    // Stop accepting work, then let in-flight requests finish.
    io.close();
    server.close(() => logger.info('HTTP server closed'));

    try {
      await disconnectDatabase();
    } catch (error) {
      logger.error({ err: error }, 'Failed to close the database connection');
    }

    setTimeout(() => process.exit(0), 500).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception, exiting');
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start the server');
  process.exit(1);
});
