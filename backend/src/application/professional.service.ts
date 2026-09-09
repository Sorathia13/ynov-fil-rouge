import { TimeOffEntity, WorkingHoursEntity } from '../domain/entities';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../domain/errors';
import {
  AddTimeOffInput,
  CreateProfessionalInput,
  ProfessionalProfile,
  ProfessionalRepository,
  ProfessionalWithSchedule,
  UpdateProfessionalInput,
  WorkingHoursInput,
} from '../domain/repositories/professional.repository';
import { UserRepository } from '../domain/repositories/user.repository';
import { PageParams, Paginated } from '../shared/pagination';
import { AuthenticatedActor } from './dto';

export class ProfessionalService {
  constructor(
    private readonly professionals: ProfessionalRepository,
    private readonly users: UserRepository,
  ) {}

  async createForUser(
    actor: AuthenticatedActor,
    input: Omit<CreateProfessionalInput, 'userId'>,
  ): Promise<ProfessionalProfile> {
    const existing = await this.professionals.findByUserId(actor.id);
    if (existing) throw new ConflictError('Vous avez déjà un profil professionnel');
    // Promote the account to PRO the first time a profile is created.
    await this.users.update(actor.id, { role: 'PRO' });
    return this.professionals.create({ userId: actor.id, ...input });
  }

  async getById(id: string): Promise<ProfessionalWithSchedule> {
    const pro = await this.professionals.findById(id);
    if (!pro) throw new NotFoundError('Professionnel');
    return pro;
  }

  async getMine(actor: AuthenticatedActor): Promise<ProfessionalWithSchedule> {
    const pro = await this.professionals.findByUserId(actor.id);
    if (!pro) throw new NotFoundError('Profil professionnel');
    return pro;
  }

  list(params: PageParams & { search?: string }): Promise<Paginated<ProfessionalWithSchedule>> {
    return this.professionals.list(params);
  }

  async update(
    actor: AuthenticatedActor,
    id: string,
    input: UpdateProfessionalInput,
  ): Promise<ProfessionalProfile> {
    await this.ensureOwnership(actor, id);
    return this.professionals.update(id, input);
  }

  async setWorkingHours(
    actor: AuthenticatedActor,
    id: string,
    hours: WorkingHoursInput[],
  ): Promise<WorkingHoursEntity[]> {
    await this.ensureOwnership(actor, id);
    for (const h of hours) {
      if (h.weekday < 0 || h.weekday > 6) throw new ValidationError('Le jour de la semaine doit être compris entre 0 et 6');
      if (h.startMinute < 0 || h.endMinute > 1440 || h.endMinute <= h.startMinute) {
        throw new ValidationError("Plage horaire d'ouverture invalide");
      }
    }
    return this.professionals.setWorkingHours(id, hours);
  }

  async addTimeOff(
    actor: AuthenticatedActor,
    id: string,
    input: AddTimeOffInput,
  ): Promise<TimeOffEntity> {
    await this.ensureOwnership(actor, id);
    if (input.endAt.getTime() <= input.startAt.getTime()) {
      throw new ValidationError("La fin de l'indisponibilité doit être postérieure à son début");
    }
    return this.professionals.addTimeOff(id, input);
  }

  async removeTimeOff(actor: AuthenticatedActor, id: string, timeOffId: string): Promise<void> {
    await this.ensureOwnership(actor, id);
    await this.professionals.removeTimeOff(id, timeOffId);
  }

  private async ensureOwnership(
    actor: AuthenticatedActor,
    professionalId: string,
  ): Promise<ProfessionalWithSchedule> {
    const pro = await this.professionals.findById(professionalId);
    if (!pro) throw new NotFoundError('Professionnel');
    if (actor.role !== 'ADMIN' && pro.userId !== actor.id) {
      throw new ForbiddenError('Ce profil professionnel ne vous appartient pas');
    }
    return pro;
  }
}
