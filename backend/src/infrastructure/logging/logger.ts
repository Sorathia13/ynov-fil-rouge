/**
 * Structured application logger (Winston).
 * JSON in production for log aggregation; colourised, human-readable in dev.
 * Silent during tests to keep the reporter output clean.
 */
import winston from 'winston';
import { config, isProduction, isTest } from '../config/env';

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${message}${rest}`;
  }),
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: isProduction ? prodFormat : devFormat,
  defaultMeta: { service: 'smartbooking-api' },
  transports: [new winston.transports.Console({ silent: isTest })],
});
