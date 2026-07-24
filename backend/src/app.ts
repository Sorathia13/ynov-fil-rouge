import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import { Container, buildContainer } from './container';
import { NotFoundError } from './domain/errors';
import { config } from './infrastructure/config/env';
import { mountSwagger } from './docs/swagger';
import { liveness, readiness } from './interface/http/controllers/health.controller';
import { errorHandler } from './interface/http/middlewares/error-handler.middleware';
import { globalRateLimiter } from './interface/http/middlewares/rate-limit.middleware';
import { requestLogger } from './interface/http/middlewares/request-logger.middleware';
import { metricsHandler, metricsMiddleware } from './interface/http/metrics';
import { apiRouter } from './interface/http/routes';

/**
 * Build the Express application. The container is injectable so integration tests
 * can supply their own wiring (e.g. a test database) — the app itself is I/O-free
 * to construct.
 */
export function createApp(container: Container = buildContainer()): Express {
  const app = express();

  // Hardening & platform
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestLogger);
  app.use(metricsMiddleware);

  // Observability & health (no auth)
  app.get('/health', liveness);
  app.get('/health/ready', readiness);
  app.get('/metrics', metricsHandler);

  // Interactive API documentation
  mountSwagger(app);

  // Business API (rate-limited)
  app.use('/api', globalRateLimiter, apiRouter(container));

  // Fallback 404 + centralised error handler (must be last)
  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandler);

  return app;
}
