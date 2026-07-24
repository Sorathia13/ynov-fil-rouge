/**
 * PrismaClient singleton. A single pooled instance is shared across the process;
 * a global reference prevents connection exhaustion during dev hot-reload.
 */
import { PrismaClient } from '@prisma/client';
import { isProduction } from '../config/env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
