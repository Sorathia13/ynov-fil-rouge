import { ServiceEntity } from '../entities';

export interface CreateServiceInput {
  professionalId: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceCents?: number;
  color?: string;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string | null;
  durationMinutes?: number;
  priceCents?: number;
  color?: string;
  isActive?: boolean;
}

export interface ServiceRepository {
  create(input: CreateServiceInput): Promise<ServiceEntity>;
  findById(id: string): Promise<ServiceEntity | null>;
  listByProfessional(professionalId: string, opts?: { activeOnly?: boolean }): Promise<ServiceEntity[]>;
  update(id: string, input: UpdateServiceInput): Promise<ServiceEntity>;
  /** Soft-delete: deactivate to preserve referential integrity with past appointments. */
  deactivate(id: string): Promise<void>;
}
