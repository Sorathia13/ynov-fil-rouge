import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';

/**
 * Validate & coerce `req.body` against a Zod schema, replacing it with the parsed
 * (typed) value. Query/param validation is done in-controller where coercion of
 * string values is needed, keeping this middleware simple and side-effect free.
 */
export const validateBody =
  (schema: ZodSchema): RequestHandler =>
  (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
