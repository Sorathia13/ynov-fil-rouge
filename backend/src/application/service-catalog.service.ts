import { ServiceEntity } from '../domain/entities';
import { ForbiddenError, NotFoundError } from '../domain/errors';
import { ProfessionalRepository } from '../domain/repositories/professional.repository';
import {
  CreateServiceInput,
  ServiceRepository,
  UpdateServiceInput,
} from '../domain/repositories/service.repository';
import { AuthenticatedActor } from './dto';

export class ServiceCatalogService {
  constructor(
    private readonly services: ServiceRepository,
    private readonly professionals: ProfessionalRepository,
  ) {}

  async create(
    actor: AuthenticatedActor,
    professionalId: string,
    input: Omit<CreateServiceInput, 'professionalId'>,
  ): Promise<ServiceEntity> {
    await this.ensureProOwnership(actor, professionalId);
    return this.services.create({ professionalId, ...input });
  }

  listByProfessional(professionalId: string, opts?: { activeOnly?: boolean }): Promise<ServiceEntity[]> {
    return this.services.listByProfessional(professionalId, opts);
  }

  async update(
    actor: AuthenticatedActor,
    serviceId: string,
    input: UpdateServiceInput,
  ): Promise<ServiceEntity> {
    const service = await this.requireService(serviceId);
    await this.ensureProOwnership(actor, service.professionalId);
    return this.services.update(serviceId, input);
  }

  async deactivate(actor: AuthenticatedActor, serviceId: string): Promise<void> {
    const service = await this.requireService(serviceId);
    await this.ensureProOwnership(actor, service.professionalId);
    await this.services.deactivate(serviceId);
  }

  private async requireService(id: string): Promise<ServiceEntity> {
    const service = await this.services.findById(id);
    if (!service) throw new NotFoundError('Prestation');
    return service;
  }

  private async ensureProOwnership(actor: AuthenticatedActor, professionalId: string): Promise<void> {
    if (actor.role === 'ADMIN') return;
    const pro = await this.professionals.findById(professionalId);
    if (!pro) throw new NotFoundError('Professionnel');
    if (pro.userId !== actor.id) {
      throw new ForbiddenError('Ce profil professionnel ne vous appartient pas');
    }
  }
}
