import { Router } from 'express';
import { Container } from '../../../container';
import { appointmentController } from '../controllers/appointment.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { bookSchema, rescheduleSchema, statusSchema } from '../validators/appointment.validators';

export function appointmentRoutes(c: Container): Router {
  const router = Router();
  const ctrl = appointmentController(c.appointmentService);

  router.use(authenticate); // every appointment route requires authentication

  router.get('/slots', ctrl.slots);
  router.post('/availability', ctrl.checkAvailability);
  router.post('/', validateBody(bookSchema), ctrl.book);
  router.get('/me', ctrl.myAppointments);
  router.get('/professional/:professionalId', ctrl.professionalAppointments);
  router.get('/:id', ctrl.getById);
  router.patch('/:id/reschedule', validateBody(rescheduleSchema), ctrl.reschedule);
  router.patch('/:id/status', validateBody(statusSchema), ctrl.updateStatus);
  router.post('/:id/cancel', ctrl.cancel);

  return router;
}
