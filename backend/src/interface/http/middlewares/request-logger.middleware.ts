import crypto from 'node:crypto';
import { RequestHandler } from 'express';
import { logger } from '../../../infrastructure/logging/logger';

/** Attach a correlation id and log each request once it completes. */
export const requestLogger: RequestHandler = (req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.http?.('request', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
    });
  });
  next();
};
