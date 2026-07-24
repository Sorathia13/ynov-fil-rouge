import { Router } from 'express';
import { Container } from '../../../container';
import { serviceController } from '../controllers/service.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { updateServiceSchema } from '../validators/service.validators';

export function serviceRoutes(c: Container): Router {
  const router = Router();
  const svc = serviceController(c.serviceCatalogService);

  router.patch('/:id', authenticate, validateBody(updateServiceSchema), svc.update);
  router.delete('/:id', authenticate, svc.deactivate);

  return router;
}
