import { RequestHandler } from 'express';
import { prisma } from '../../../infrastructure/prisma/client';

/** Liveness: the process is up and serving. */
export const liveness: RequestHandler = (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
};

/** Readiness: dependencies (database) are reachable. */
export const readiness: RequestHandler = async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'error', db: 'down' });
  }
};
