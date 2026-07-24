import type { Appointment, Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';
import { AppointmentEntity } from '../../domain/entities';
import {
  AppointmentRepository,
  CreateAppointmentInput,
  ListAppointmentsParams,
  UpdateAppointmentInput,
} from '../../domain/repositories/appointment.repository';
import { Paginated, paginate, toSkipTake } from '../../shared/pagination';

function toAppointment(a: Appointment): AppointmentEntity {
  return {
    id: a.id,
    professionalId: a.professionalId,
    clientId: a.clientId,
    serviceId: a.serviceId,
    startAt: a.startAt,
    endAt: a.endAt,
    status: a.status,
    notes: a.notes,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function buildWhere(base: Prisma.AppointmentWhereInput, params: ListAppointmentsParams): Prisma.AppointmentWhereInput {
  const where: Prisma.AppointmentWhereInput = { ...base };
  if (params.status) where.status = params.status;
  if (params.from || params.to) {
    where.startAt = {};
    if (params.from) where.startAt.gte = params.from;
    if (params.to) where.startAt.lte = params.to;
  }
  return where;
}

export class PrismaAppointmentRepository implements AppointmentRepository {
  async create(input: CreateAppointmentInput): Promise<AppointmentEntity> {
    const a = await prisma.appointment.create({
      data: {
        professionalId: input.professionalId,
        clientId: input.clientId,
        serviceId: input.serviceId,
        startAt: input.startAt,
        endAt: input.endAt,
        status: input.status,
        notes: input.notes ?? null,
      },
    });
    return toAppointment(a);
  }

  async createIfAvailable(input: CreateAppointmentInput): Promise<AppointmentEntity | null> {
    return prisma.$transaction(
      async (tx) => {
        const overlap = await tx.appointment.findFirst({
          where: {
            professionalId: input.professionalId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            startAt: { lt: input.endAt },
            endAt: { gt: input.startAt },
          },
        });
        if (overlap) return null;
        const a = await tx.appointment.create({
          data: {
            professionalId: input.professionalId,
            clientId: input.clientId,
            serviceId: input.serviceId,
            startAt: input.startAt,
            endAt: input.endAt,
            status: input.status,
            notes: input.notes ?? null,
          },
        });
        return toAppointment(a);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async rescheduleIfAvailable(
    id: string,
    startAt: Date,
    endAt: Date,
  ): Promise<AppointmentEntity | null> {
    return prisma.$transaction(
      async (tx) => {
        const current = await tx.appointment.findUnique({ where: { id } });
        if (!current) return null;
        const overlap = await tx.appointment.findFirst({
          where: {
            professionalId: current.professionalId,
            id: { not: id },
            status: { in: ['PENDING', 'CONFIRMED'] },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
        });
        if (overlap) return null;
        const a = await tx.appointment.update({ where: { id }, data: { startAt, endAt } });
        return toAppointment(a);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async findById(id: string): Promise<AppointmentEntity | null> {
    const a = await prisma.appointment.findUnique({ where: { id } });
    return a ? toAppointment(a) : null;
  }

  async findInWindow(professionalId: string, from: Date, to: Date): Promise<AppointmentEntity[]> {
    const rows = await prisma.appointment.findMany({
      where: { professionalId, startAt: { lt: to }, endAt: { gt: from } },
      orderBy: { startAt: 'asc' },
    });
    return rows.map(toAppointment);
  }

  async update(id: string, input: UpdateAppointmentInput): Promise<AppointmentEntity> {
    const a = await prisma.appointment.update({ where: { id }, data: { ...input } });
    return toAppointment(a);
  }

  async listForClient(
    clientId: string,
    params: ListAppointmentsParams,
  ): Promise<Paginated<AppointmentEntity>> {
    const where = buildWhere({ clientId }, params);
    const { skip, take } = toSkipTake(params);
    const [rows, total] = await Promise.all([
      prisma.appointment.findMany({ where, skip, take, orderBy: { startAt: 'desc' } }),
      prisma.appointment.count({ where }),
    ]);
    return paginate(rows.map(toAppointment), total, params);
  }

  async listForProfessional(
    professionalId: string,
    params: ListAppointmentsParams,
  ): Promise<Paginated<AppointmentEntity>> {
    const where = buildWhere({ professionalId }, params);
    const { skip, take } = toSkipTake(params);
    const [rows, total] = await Promise.all([
      prisma.appointment.findMany({ where, skip, take, orderBy: { startAt: 'desc' } }),
      prisma.appointment.count({ where }),
    ]);
    return paginate(rows.map(toAppointment), total, params);
  }
}
