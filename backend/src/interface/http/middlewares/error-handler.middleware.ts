import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../../domain/errors';
import { logger } from '../../../infrastructure/logging/logger';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/** Central error translator: domain/validation/jwt/prisma errors → stable JSON. */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload', details: err.flatten() },
    });
    return;
  }

  const asRecord = err as { name?: string; code?: string; message?: string; stack?: string };

  if (asRecord.name === 'JsonWebTokenError' || asRecord.name === 'TokenExpiredError') {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    return;
  }

  // Prisma unique constraint violation
  if (asRecord.code === 'P2002') {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'Resource already exists' } });
    return;
  }
  // Prisma record-not-found on update/delete
  if (asRecord.code === 'P2025') {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
    return;
  }

  logger.error('Unhandled error', {
    message: asRecord.message,
    stack: asRecord.stack,
    requestId: req.requestId,
  });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}
