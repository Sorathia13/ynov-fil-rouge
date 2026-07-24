import { Router } from 'express';
import { Container } from '../../../container';
import { authController } from '../controllers/auth.controller';
import { authRateLimiter } from '../middlewares/rate-limit.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { loginSchema, refreshSchema, registerSchema } from '../validators/auth.validators';

export function authRoutes(c: Container): Router {
  const router = Router();
  const ctrl = authController(c.authService);

  router.post('/register', authRateLimiter, validateBody(registerSchema), ctrl.register);
  router.post('/login', authRateLimiter, validateBody(loginSchema), ctrl.login);
  router.post('/refresh', validateBody(refreshSchema), ctrl.refresh);
  router.post('/logout', ctrl.logout);

  return router;
}
