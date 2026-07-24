/**
 * Environment configuration — parsed and validated once at process start with Zod.
 * A misconfigured environment fails fast with an explicit error rather than
 * surfacing as an obscure runtime bug later.
 */
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://smartbooking:smartbooking@localhost:5432/smartbooking?schema=public'),
  JWT_ACCESS_SECRET: z.string().min(1).default('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(1).default('dev-refresh-secret-change-me'),
  /** Access token lifetime, seconds. */
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  /** Refresh token lifetime, seconds. */
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(604800),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  /** Minimum booking notice (minutes) enforced by the scheduling engine. */
  MIN_LEAD_MINUTES: z.coerce.number().int().min(0).default(60),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const config = parsed.data;
export type AppConfig = typeof config;

// Production hardening: refuse to boot with development secrets.
if (config.NODE_ENV === 'production') {
  const insecure = [config.JWT_ACCESS_SECRET, config.JWT_REFRESH_SECRET].some((s) =>
    s.includes('change-me'),
  );
  if (insecure) {
    throw new Error('Refusing to start in production with default JWT secrets. Set strong secrets.');
  }
}

export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
