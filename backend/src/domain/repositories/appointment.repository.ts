import { AppointmentEntity, AppointmentStatus } from '../entities';
import { PageParams, Paginated } from '../../shared/pagination';

export interface CreateAppointmentInput {
  professionalId: string;
  clientId: string;
  serviceId: string;
  startAt: Date;
  endAt: Date;
  status?: AppointmentStatus;
  notes?: string | null;
}

export interface UpdateAppointmentInput {
  startAt?: Date;
  endAt?: Date;
  status?: AppointmentStatus;
  notes?: string | null;
}

export interface ListAppointmentsParams extends PageParams {
  from?: Date;
  to?: Date;
  status?: AppointmentStatus;
}

export interface AppointmentRepository {
  create(input: CreateAppointmentInput): Promise<AppointmentEntity>;
  /**
   * Create atomically only if no blocking appointment overlaps the slot.
   * Returns null on conflict. Runs at SERIALIZABLE isolation to defeat the
   * check-then-act race (concurrent double-booking).
   */
  createIfAvailable(input: CreateAppointmentInput): Promise<AppointmentEntity | null>;
  /** Reschedule atomically, ignoring the appointment's own current slot; null on conflict. */
  rescheduleIfAvailable(id: string, startAt: Date, endAt: Date): Promise<AppointmentEntity | null>;
  findById(id: string): Promise<AppointmentEntity | null>;
  /** All appointments overlapping [from, to] — the scheduling engine's busy set. */
  findInWindow(professionalId: string, from: Date, to: Date): Promise<AppointmentEntity[]>;
  update(id: string, input: UpdateAppointmentInput): Promise<AppointmentEntity>;
  listForClient(clientId: string, params: ListAppointmentsParams): Promise<Paginated<AppointmentEntity>>;
  listForProfessional(
    professionalId: string,
    params: ListAppointmentsParams,
  ): Promise<Paginated<AppointmentEntity>>;
}
