import client from 'prom-client';
import { RequestHandler } from 'express';

/** Dedicated Prometheus registry with default process/runtime metrics enabled. */
export const registry = new client.Registry();
registry.setDefaultLabels({ app: 'smartbooking-api' });
client.collectDefaultMetrics({ register: registry });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

/** Measure latency and count of each request (business KPI for supervision). */
export const metricsMiddleware: RequestHandler = (req, res, next) => {
  const stop = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
    const labels = { method: req.method, route, status: String(res.statusCode) };
    stop(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
};

/** Expose metrics in Prometheus text format at /metrics. */
export const metricsHandler: RequestHandler = async (_req, res) => {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
};
