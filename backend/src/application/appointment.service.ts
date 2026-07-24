import { AppointmentEntity, AppointmentStatus, ServiceEntity } from '../domain/entities';
import {
  ForbiddenError,
  NotFoundError,
  SlotUnavailableError,
  ValidationError,
} from '../domain/errors';
import {
  AppointmentRepository,
  ListAppointmentsParams,
} from '../domain/repositories/appointment.repository';
import { ProfessionalRepository } from '../domain/repositories/professional.repository';
import { ServiceRepository } from '../domain/repositories/service.repository';
import {
  EngineContext,
  SchedulingEngine,
  UnavailabilityReason,
} from '../domain/services/scheduling-engine';
import { config } from '../infrastructure/config/env';
import { Paginated } from '../shared/pagination';
import { MS_PER_MINUTE } from '../shared/time';
import { AuthenticatedActor, SlotDTO, toSlotDTO } from './dto';

const DAY_MS = 86_400_000;
/** How far ahead to search for alternative slots when a booking is refused. */
const BOOKING_SEARCH_DAYS = 15;

export interface BookInput {
  professionalId: string;
  serviceId: string;
  startAt: Date;
  notes?: string | null;
}

export interface AvailabilityResponse {
  available: boolean;
  reason?: UnavailabilityReason;
  requested: SlotDTO;
  alternatives: SlotDTO[];
}

export class AppointmentService {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly professionals: ProfessionalRepository,
    private readonly services: ServiceRepository,
    private readonly engine: SchedulingEngine,
  ) {}

  /** All bookable slots for a service within a window (drives the booking calendar). */
  async listAvailableSlots(
    professionalId: string,
    serviceId: string,
    from: Date,
    to: Date,
  ): Promise<SlotDTO[]> {
    const service = await this.requireBookableService(professionalId, serviceId);
    const ctx = await this.buildContext(professionalId, from, to);
    return this.engine.listAvailableSlots(from, to, service.durationMinutes, ctx).map(toSlotDTO);
  }

  /** One-shot availability check + nearest alternatives for a precise time. */
  async checkAvailability(
    professionalId: string,
    serviceId: string,
    startAt: Date,
  ): Promise<AvailabilityResponse> {
    const service = await this.requireBookableService(professionalId, serviceId);
    const ctx = await this.buildBookingContext(professionalId, startAt);
    const resolution = this.engine.resolve(startAt, service.durationMinutes, ctx, 3);
    return {
      available: resolution.available,
      reason: resolution.reason,
      requested: toSlotDTO(resolution.requested),
      alternatives: resolution.alternatives.map(toSlotDTO),
    };
  }

  async book(clientId: string, input: BookInput): Promise<AppointmentEntity> {
    const service = await this.requireBookableService(input.professionalId, input.serviceId);
    const ctx = await this.buildBookingContext(input.professionalId, input.startAt);
    const resolution = this.engine.resolve(input.startAt, service.durationMinutes, ctx, 3);

    if (!resolution.available) {
      throw new SlotUnavailableError('The requested time slot is not available', {
        reason: resolution.reason,
        alternatives: resolution.alternatives.map(toSlotDTO),
      });
    }

    const created = await this.appointments.createIfAvailable({
      professionalId: input.professionalId,
      clientId,
      serviceId: input.serviceId,
      startAt: input.startAt,
      endAt: resolution.requested.end,
      status: 'PENDING',
      notes: input.notes ?? null,
    });

    if (!created) {
      // Lost a concurrent race for the same slot: recompute and surface alternatives.
      const freshCtx = await this.buildBookingContext(input.professionalId, input.startAt);
      const alternatives = this.engine.suggestAlternatives(
        input.startAt,
        service.durationMinutes,
        freshCtx,
        3,
      );
      throw new SlotUnavailableError('The requested time slot was just taken', {
        reason: 'CONFLICT' as UnavailabilityReason,
        alternatives: alternatives.map(toSlotDTO),
      });
    }
    return created;
  }

  async reschedule(
    actor: AuthenticatedActor,
    appointmentId: string,
    newStart: Date,
  ): Promise<AppointmentEntity> {
    const appointment = await this.requireAppointment(appointmentId);
    await this.ensureCanManage(actor, appointment);
    const service = await this.services.findById(appointment.serviceId);
    if (!service) throw new NotFoundError('Service');

    const ctx = await this.buildBookingContext(appointment.professionalId, newStart, appointmentId);
    const check = this.engine.checkAvailability(newStart, service.durationMinutes, ctx);
    if (!check.available) {
      const alternatives = this.engine.suggestAlternatives(newStart, service.durationMinutes, ctx, 3);
      throw new SlotUnavailableError('Cannot reschedule to that time', {
        reason: check.reason,
        alternatives: alternatives.map(toSlotDTO),
      });
    }

    const newEnd = new Date(newStart.getTime() + service.durationMinutes * MS_PER_MINUTE);
    const updated = await this.appointments.rescheduleIfAvailable(appointmentId, newStart, newEnd);
    if (!updated) {
      throw new SlotUnavailableError('That time was just taken', {
        reason: 'CONFLICT' as UnavailabilityReason,
      });
    }
    return updated;
  }

  async cancel(actor: AuthenticatedActor, appointmentId: string): Promise<AppointmentEntity> {
    const appointment = await this.requireAppointment(appointmentId);
    await this.ensureCanManage(actor, appointment);
    if (appointment.status === 'CANCELLED') return appointment;
    if (appointment.status === 'COMPLETED') {
      throw new ValidationError('A completed appointment cannot be cancelled');
    }
    return this.appointments.update(appointmentId, { status: 'CANCELLED' });
  }

  /** Professional-only transition (confirm / complete). */
  async updateStatus(
    actor: AuthenticatedActor,
    appointmentId: string,
    status: AppointmentStatus,
  ): Promise<AppointmentEntity> {
    const appointment = await this.requireAppointment(appointmentId);
    await this.ensureProfessionalOrAdmin(actor, appointment);
    return this.appointments.update(appointmentId, { status });
  }

  async getById(actor: AuthenticatedActor, appointmentId: string): Promise<AppointmentEntity> {
    const appointment = await this.requireAppointment(appointmentId);
    await this.ensureCanManage(actor, appointment);
    return appointment;
  }

  listForClient(clientId: string, params: ListAppointmentsParams): Promise<Paginated<AppointmentEntity>> {
    return this.appointments.listForClient(clientId, params);
  }

  async listForProfessional(
    actor: AuthenticatedActor,
    professionalId: string,
    params: ListAppointmentsParams,
  ): Promise<Paginated<AppointmentEntity>> {
    if (actor.role !== 'ADMIN') {
      const pro = await this.professionals.findById(professionalId);
      if (!pro) throw new NotFoundError('Professional');
      if (pro.userId !== actor.id) throw new ForbiddenError();
    }
    return this.appointments.listForProfessional(professionalId, params);
  }

  // --- internals ---

  private async requireBookableService(
    professionalId: string,
    serviceId: string,
  ): Promise<ServiceEntity> {
    const service = await this.services.findById(serviceId);
    if (!service || service.professionalId !== professionalId) throw new NotFoundError('Service');
    if (!service.isActive) throw new ValidationError('This service is no longer bookable');
    return service;
  }

  private async requireAppointment(id: string): Promise<AppointmentEntity> {
    const appointment = await this.appointments.findById(id);
    if (!appointment) throw new NotFoundError('Appointment');
    return appointment;
  }

  private async buildContext(
    professionalId: string,
    from: Date,
    to: Date,
    ignoreAppointmentId?: string,
  ): Promise<EngineContext> {
    const pro = await this.professionals.findById(professionalId);
    if (!pro) throw new NotFoundError('Professional');
    const [timeOff, appointments] = await Promise.all([
      this.professionals.findTimeOff(professionalId, from, to),
      this.appointments.findInWindow(professionalId, from, to),
    ]);
    return {
      workingHours: pro.workingHours,
      timeOff,
      appointments,
      timeZone: pro.timezone,
      now: new Date(),
      minLeadMinutes: config.MIN_LEAD_MINUTES,
      ignoreAppointmentId,
    };
  }

  /** Context window sized so alternatives can roll forward up to BOOKING_SEARCH_DAYS. */
  private buildBookingContext(
    professionalId: string,
    around: Date,
    ignoreAppointmentId?: string,
  ): Promise<EngineContext> {
    const from = new Date(around.getTime() - DAY_MS);
    const to = new Date(around.getTime() + BOOKING_SEARCH_DAYS * DAY_MS);
    return this.buildContext(professionalId, from, to, ignoreAppointmentId);
  }

  private async ensureCanManage(
    actor: AuthenticatedActor,
    appointment: AppointmentEntity,
  ): Promise<void> {
    if (actor.role === 'ADMIN') return;
    if (appointment.clientId === actor.id) return;
    const pro = await this.professionals.findById(appointment.professionalId);
    if (pro && pro.userId === actor.id) return;
    throw new ForbiddenError();
  }

  private async ensureProfessionalOrAdmin(
    actor: AuthenticatedActor,
    appointment: AppointmentEntity,
  ): Promise<void> {
    if (actor.role === 'ADMIN') return;
    const pro = await this.professionals.findById(appointment.professionalId);
    if (pro && pro.userId === actor.id) return;
    throw new ForbiddenError();
  }
}
