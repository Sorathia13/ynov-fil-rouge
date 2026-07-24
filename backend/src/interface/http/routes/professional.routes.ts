import { Router } from 'express';
import { Container } from '../../../container';
import { professionalController } from '../controllers/professional.controller';
import { serviceController } from '../controllers/service.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import {
  createProfessionalSchema,
  timeOffSchema,
  updateProfessionalSchema,
  workingHoursSchema,
} from '../validators/professional.validators';
import { createServiceSchema } from '../validators/service.validators';

export function professionalRoutes(c: Container): Router {
  const router = Router();
  const ctrl = professionalController(c.professionalService);
  const svc = serviceController(c.serviceCatalogService);

  // Public discovery
  router.get('/', ctrl.list);
  router.get('/me', authenticate, ctrl.me); // must precede '/:id'
  router.get('/:id', ctrl.getById);
  router.get('/:professionalId/services', svc.listByProfessional);

  // Owner / authenticated actions
  router.post('/', authenticate, validateBody(createProfessionalSchema), ctrl.create);
  router.patch('/:id', authenticate, validateBody(updateProfessionalSchema), ctrl.update);
  router.put('/:id/working-hours', authenticate, validateBody(workingHoursSchema), ctrl.setWorkingHours);
  router.post('/:id/time-off', authenticate, validateBody(timeOffSchema), ctrl.addTimeOff);
  router.delete('/:id/time-off/:timeOffId', authenticate, ctrl.removeTimeOff);
  router.post('/:professionalId/services', authenticate, validateBody(createServiceSchema), svc.create);

  return router;
}
