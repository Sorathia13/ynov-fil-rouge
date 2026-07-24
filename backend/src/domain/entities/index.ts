/**
 * Domain entity types.
 *
 * These are framework-agnostic shapes owned by the domain layer. Their string
 * literal unions are intentionally value-compatible with the Prisma-generated
 * enums, so mapping across the persistence boundary is an identity on the value.
 */

export type Role = 'CLIENT' | 'PRO' | 'ADMIN';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

/** Statuses that occupy a slot on the calendar (i.e. block scheduling). */
export const BLOCKING_STATUSES: readonly AppointmentStatus[] = ['PENDING', 'CONFIRMED'];

export interface UserEntity {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceEntity {
  id: string;
  professionalId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  color: string;
  isActive: boolean;
}

export interface WorkingHoursEntity {
  id: string;
  professionalId: string;
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
  /** minutes from midnight, local to the professional's timezone */
  startMinute: number;
  endMinute: number;
}

export interface TimeOffEntity {
  id: string;
  professionalId: string;
  startAt: Date;
  endAt: Date;
  reason: string | null;
}

export interface AppointmentEntity {
  id: string;
  professionalId: string;
  clientId: string;
  serviceId: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
