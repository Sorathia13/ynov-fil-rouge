import { Router } from 'express';
import { Container } from '../../../container';
import { appointmentRoutes } from './appointment.routes';
import { authRoutes } from './auth.routes';
import { professionalRoutes } from './professional.routes';
import { serviceRoutes } from './service.routes';
import { userRoutes } from './user.routes';

export function apiRouter(c: Container): Router {
  const router = Router();
  router.use('/auth', authRoutes(c));
  router.use('/users', userRoutes(c));
  router.use('/professionals', professionalRoutes(c));
  router.use('/services', serviceRoutes(c));
  router.use('/appointments', appointmentRoutes(c));
  return router;
}
