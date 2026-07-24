/**
 * Composition root. Wires concrete infrastructure adapters into the application
 * services (dependency inversion). The rest of the app depends only on this
 * container, never on Prisma directly — which is what makes the use-cases testable.
 */
import { AppointmentService } from './application/appointment.service';
import { AuthService } from './application/auth.service';
import { ProfessionalService } from './application/professional.service';
import { ServiceCatalogService } from './application/service-catalog.service';
import { UserService } from './application/user.service';
import { SchedulingEngine } from './domain/services/scheduling-engine';
import { PrismaAppointmentRepository } from './infrastructure/repositories/prisma-appointment.repository';
import { PrismaProfessionalRepository } from './infrastructure/repositories/prisma-professional.repository';
import { PrismaRefreshTokenRepository } from './infrastructure/repositories/prisma-refresh-token.repository';
import { PrismaServiceRepository } from './infrastructure/repositories/prisma-service.repository';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';

export interface Container {
  authService: AuthService;
  userService: UserService;
  professionalService: ProfessionalService;
  serviceCatalogService: ServiceCatalogService;
  appointmentService: AppointmentService;
}

export function buildContainer(): Container {
  const userRepository = new PrismaUserRepository();
  const refreshTokenRepository = new PrismaRefreshTokenRepository();
  const professionalRepository = new PrismaProfessionalRepository();
  const serviceRepository = new PrismaServiceRepository();
  const appointmentRepository = new PrismaAppointmentRepository();
  const schedulingEngine = new SchedulingEngine({ stepMinutes: 15 });

  return {
    authService: new AuthService(userRepository, refreshTokenRepository),
    userService: new UserService(userRepository),
    professionalService: new ProfessionalService(professionalRepository, userRepository),
    serviceCatalogService: new ServiceCatalogService(serviceRepository, professionalRepository),
    appointmentService: new AppointmentService(
      appointmentRepository,
      professionalRepository,
      serviceRepository,
      schedulingEngine,
    ),
  };
}
