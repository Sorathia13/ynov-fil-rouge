export type Role = 'CLIENT' | 'PRO' | 'ADMIN';
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
}

export interface Service {
  id: string;
  professionalId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  color: string;
  isActive: boolean;
}

export interface WorkingHours {
  id: string;
  professionalId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface Professional {
  id: string;
  userId: string;
  businessName: string;
  bio: string | null;
  timezone: string;
  workingHours: WorkingHours[];
  services: Service[];
}

export interface Appointment {
  id: string;
  professionalId: string;
  clientId: string;
  serviceId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  notes: string | null;
}

export interface Slot {
  start: string;
  end: string;
}

export type UnavailabilityReason =
  | 'PAST'
  | 'LEAD_TIME'
  | 'OUTSIDE_WORKING_HOURS'
  | 'TIME_OFF'
  | 'CONFLICT';

export interface AvailabilityResponse {
  available: boolean;
  reason?: UnavailabilityReason;
  requested: Slot;
  alternatives: Slot[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
