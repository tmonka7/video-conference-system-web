import pino from 'pino';
import { env } from './env.js';

const prettyTransport = {
  target: 'pino-pretty',
  options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
};

export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  transport: env.isProduction || env.isTest ? undefined : prettyTransport,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passcode'],
    remove: true,
  },
});
