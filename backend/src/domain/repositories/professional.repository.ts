import { ServiceEntity, TimeOffEntity, WorkingHoursEntity } from '../entities';
import { PageParams, Paginated } from '../../shared/pagination';

export interface ProfessionalProfile {
  id: string;
  userId: string;
  businessName: string;
  bio: string | null;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfessionalWithSchedule extends ProfessionalProfile {
  workingHours: WorkingHoursEntity[];
  services: ServiceEntity[];
}

export interface CreateProfessionalInput {
  userId: string;
  businessName: string;
  bio?: string | null;
  timezone?: string;
}

export interface UpdateProfessionalInput {
  businessName?: string;
  bio?: string | null;
  timezone?: string;
}

export interface WorkingHoursInput {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface AddTimeOffInput {
  startAt: Date;
  endAt: Date;
  reason?: string | null;
}

export interface ProfessionalRepository {
  create(input: CreateProfessionalInput): Promise<ProfessionalProfile>;
  findById(id: string): Promise<ProfessionalWithSchedule | null>;
  findByUserId(userId: string): Promise<ProfessionalWithSchedule | null>;
  update(id: string, input: UpdateProfessionalInput): Promise<ProfessionalProfile>;
  list(params: PageParams & { search?: string }): Promise<Paginated<ProfessionalWithSchedule>>;
  /** Replace the full weekly schedule atomically. */
  setWorkingHours(professionalId: string, hours: WorkingHoursInput[]): Promise<WorkingHoursEntity[]>;
  addTimeOff(professionalId: string, input: AddTimeOffInput): Promise<TimeOffEntity>;
  removeTimeOff(professionalId: string, timeOffId: string): Promise<void>;
  findTimeOff(professionalId: string, from: Date, to: Date): Promise<TimeOffEntity[]>;
}
