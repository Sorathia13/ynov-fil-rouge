import { Router } from 'express';
import { Container } from '../../../container';
import { userController } from '../controllers/user.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { changePasswordSchema, updateProfileSchema } from '../validators/user.validators';

export function userRoutes(c: Container): Router {
  const router = Router();
  const ctrl = userController(c.userService);

  router.get('/me', authenticate, ctrl.me);
  router.patch('/me', authenticate, validateBody(updateProfileSchema), ctrl.updateMe);
  router.post('/me/password', authenticate, validateBody(changePasswordSchema), ctrl.changePassword);

  // Admin-only
  router.get('/', authenticate, requireRole('ADMIN'), ctrl.list);
  router.patch('/:id', authenticate, requireRole('ADMIN'), ctrl.adminUpdate);

  return router;
}
