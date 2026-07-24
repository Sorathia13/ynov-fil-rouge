import rateLimit from 'express-rate-limit';
import { config } from '../../../infrastructure/config/env';

/** Global limiter protecting the whole API from abuse / brute force. */
export const globalRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down' } },
});

/** Stricter limiter for authentication endpoints (credential stuffing defense). */
export const authRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' } },
});
