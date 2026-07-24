import { RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../../domain/errors';
import { Role } from '../../../domain/entities';
import { verifyAccessToken } from '../../../infrastructure/auth/tokens';

/** Require a valid Bearer access token; attaches `req.actor`. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing Bearer token');
  }
  const payload = verifyAccessToken(header.slice('Bearer '.length));
  req.actor = { id: payload.sub, role: payload.role, email: payload.email };
  next();
};

/** Restrict a route to the given roles (must be used after `authenticate`). */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.actor) throw new UnauthorizedError();
    if (!roles.includes(req.actor.role)) {
      throw new ForbiddenError('Insufficient role');
    }
    next();
  };
