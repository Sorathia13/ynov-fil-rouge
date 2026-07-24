import type { Service } from '@prisma/client';
import { prisma } from '../prisma/client';
import { ServiceEntity } from '../../domain/entities';
import {
  CreateServiceInput,
  ServiceRepository,
  UpdateServiceInput,
} from '../../domain/repositories/service.repository';

function toService(s: Service): ServiceEntity {
  return {
    id: s.id,
    professionalId: s.professionalId,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    priceCents: s.priceCents,
    color: s.color,
    isActive: s.isActive,
  };
}

export class PrismaServiceRepository implements ServiceRepository {
  async create(input: CreateServiceInput): Promise<ServiceEntity> {
    const s = await prisma.service.create({
      data: {
        professionalId: input.professionalId,
        name: input.name,
        description: input.description ?? null,
        durationMinutes: input.durationMinutes,
        priceCents: input.priceCents ?? 0,
        color: input.color ?? '#2563eb',
      },
    });
    return toService(s);
  }

  async findById(id: string): Promise<ServiceEntity | null> {
    const s = await prisma.service.findUnique({ where: { id } });
    return s ? toService(s) : null;
  }

  async listByProfessional(
    professionalId: string,
    opts?: { activeOnly?: boolean },
  ): Promise<ServiceEntity[]> {
    const rows = await prisma.service.findMany({
      where: { professionalId, ...(opts?.activeOnly ? { isActive: true } : {}) },
      orderBy: { name: 'asc' },
    });
    return rows.map(toService);
  }

  async update(id: string, input: UpdateServiceInput): Promise<ServiceEntity> {
    const s = await prisma.service.update({ where: { id }, data: { ...input } });
    return toService(s);
  }

  async deactivate(id: string): Promise<void> {
    await prisma.service.update({ where: { id }, data: { isActive: false } });
  }
}
