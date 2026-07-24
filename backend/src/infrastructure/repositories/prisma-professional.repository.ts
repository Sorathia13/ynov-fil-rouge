import type { Professional, Service, TimeOff, WorkingHours } from '@prisma/client';
import { prisma } from '../prisma/client';
import { ServiceEntity, TimeOffEntity, WorkingHoursEntity } from '../../domain/entities';
import {
  AddTimeOffInput,
  CreateProfessionalInput,
  ProfessionalProfile,
  ProfessionalRepository,
  ProfessionalWithSchedule,
  UpdateProfessionalInput,
  WorkingHoursInput,
} from '../../domain/repositories/professional.repository';
import { PageParams, Paginated, paginate, toSkipTake } from '../../shared/pagination';

function toProfile(p: Professional): ProfessionalProfile {
  return {
    id: p.id,
    userId: p.userId,
    businessName: p.businessName,
    bio: p.bio,
    timezone: p.timezone,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function toWorkingHours(w: WorkingHours): WorkingHoursEntity {
  return {
    id: w.id,
    professionalId: w.professionalId,
    weekday: w.weekday,
    startMinute: w.startMinute,
    endMinute: w.endMinute,
  };
}

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

function toTimeOff(t: TimeOff): TimeOffEntity {
  return {
    id: t.id,
    professionalId: t.professionalId,
    startAt: t.startAt,
    endAt: t.endAt,
    reason: t.reason,
  };
}

type ProfessionalRelations = Professional & { workingHours: WorkingHours[]; services: Service[] };

function toWithSchedule(p: ProfessionalRelations): ProfessionalWithSchedule {
  return {
    ...toProfile(p),
    workingHours: p.workingHours.map(toWorkingHours),
    services: p.services.map(toService),
  };
}

const withSchedule = { workingHours: true, services: true } as const;

export class PrismaProfessionalRepository implements ProfessionalRepository {
  async create(input: CreateProfessionalInput): Promise<ProfessionalProfile> {
    const p = await prisma.professional.create({
      data: {
        userId: input.userId,
        businessName: input.businessName,
        bio: input.bio ?? null,
        timezone: input.timezone ?? 'Europe/Paris',
      },
    });
    return toProfile(p);
  }

  async findById(id: string): Promise<ProfessionalWithSchedule | null> {
    const p = await prisma.professional.findUnique({ where: { id }, include: withSchedule });
    return p ? toWithSchedule(p) : null;
  }

  async findByUserId(userId: string): Promise<ProfessionalWithSchedule | null> {
    const p = await prisma.professional.findUnique({ where: { userId }, include: withSchedule });
    return p ? toWithSchedule(p) : null;
  }

  async update(id: string, input: UpdateProfessionalInput): Promise<ProfessionalProfile> {
    const p = await prisma.professional.update({ where: { id }, data: { ...input } });
    return toProfile(p);
  }

  async list(params: PageParams & { search?: string }): Promise<Paginated<ProfessionalWithSchedule>> {
    const where = params.search
      ? { businessName: { contains: params.search, mode: 'insensitive' as const } }
      : {};
    const { skip, take } = toSkipTake(params);
    const [rows, total] = await Promise.all([
      prisma.professional.findMany({ where, include: withSchedule, skip, take, orderBy: { businessName: 'asc' } }),
      prisma.professional.count({ where }),
    ]);
    return paginate(rows.map(toWithSchedule), total, params);
  }

  async setWorkingHours(
    professionalId: string,
    hours: WorkingHoursInput[],
  ): Promise<WorkingHoursEntity[]> {
    const created = await prisma.$transaction(async (tx) => {
      await tx.workingHours.deleteMany({ where: { professionalId } });
      if (hours.length > 0) {
        await tx.workingHours.createMany({
          data: hours.map((h) => ({ professionalId, ...h })),
        });
      }
      return tx.workingHours.findMany({ where: { professionalId }, orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] });
    });
    return created.map(toWorkingHours);
  }

  async addTimeOff(professionalId: string, input: AddTimeOffInput): Promise<TimeOffEntity> {
    const t = await prisma.timeOff.create({
      data: { professionalId, startAt: input.startAt, endAt: input.endAt, reason: input.reason ?? null },
    });
    return toTimeOff(t);
  }

  async removeTimeOff(professionalId: string, timeOffId: string): Promise<void> {
    await prisma.timeOff.deleteMany({ where: { id: timeOffId, professionalId } });
  }

  async findTimeOff(professionalId: string, from: Date, to: Date): Promise<TimeOffEntity[]> {
    const rows = await prisma.timeOff.findMany({
      where: { professionalId, startAt: { lt: to }, endAt: { gt: from } },
      orderBy: { startAt: 'asc' },
    });
    return rows.map(toTimeOff);
  }
}
