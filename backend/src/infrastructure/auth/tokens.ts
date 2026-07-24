/**
 * Token utilities.
 *
 * Access tokens are stateless JWTs (short-lived). Refresh tokens are high-entropy
 * opaque strings whose SHA-256 hash is persisted, enabling server-side revocation
 * and rotation — the client never lets us store a reversible secret.
 */
import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config/env';
import { Role } from '../../domain/entities';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: config.JWT_ACCESS_TTL };
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);
  if (typeof decoded === 'string') {
    throw new jwt.JsonWebTokenError('Malformed token payload');
  }
  return { sub: String(decoded.sub), role: decoded.role as Role, email: String(decoded.email) };
}

/** Generate a new opaque refresh token (returned to the client, never stored raw). */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

/** Deterministic hash of a refresh token, stored in the database. */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
