import { CookieOptions } from 'express';
import { AuthService } from '../../../application/auth.service';
import { UnauthorizedError } from '../../../domain/errors';
import { config, isProduction } from '../../../infrastructure/config/env';
import { asyncHandler } from '../async-handler';
import { LoginBody, RegisterBody } from '../validators/auth.validators';

const REFRESH_COOKIE = 'refreshToken';

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction,
  path: '/api/auth',
  maxAge: config.JWT_REFRESH_TTL * 1000,
};

export function authController(auth: AuthService) {
  return {
    register: asyncHandler(async (req, res) => {
      const result = await auth.register(req.body as RegisterBody);
      res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
      res.status(201).json(result);
    }),

    login: asyncHandler(async (req, res) => {
      const { email, password } = req.body as LoginBody;
      const result = await auth.login(email, password);
      res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
      res.json(result);
    }),

    refresh: asyncHandler(async (req, res) => {
      const token = (req.body?.refreshToken as string | undefined) ?? req.cookies?.[REFRESH_COOKIE];
      if (!token) throw new UnauthorizedError('Missing refresh token');
      const result = await auth.refresh(token);
      res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
      res.json(result);
    }),

    logout: asyncHandler(async (req, res) => {
      const token = (req.body?.refreshToken as string | undefined) ?? req.cookies?.[REFRESH_COOKIE];
      if (token) await auth.logout(token);
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      res.status(204).end();
    }),
  };
}
