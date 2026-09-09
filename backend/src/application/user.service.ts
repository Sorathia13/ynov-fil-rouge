import { Role } from '../domain/entities';
import { NotFoundError, UnauthorizedError } from '../domain/errors';
import { ListUsersParams, UserRepository } from '../domain/repositories/user.repository';
import { hashPassword, verifyPassword } from '../infrastructure/auth/password';
import { Paginated } from '../shared/pagination';
import { PublicUser, toPublicUser } from './dto';

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

export class UserService {
  constructor(private readonly users: UserRepository) {}

  async getById(id: string): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('Utilisateur');
    return toPublicUser(user);
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<PublicUser> {
    const updated = await this.users.update(id, input);
    return toPublicUser(updated);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('Utilisateur');
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedError('Le mot de passe actuel est incorrect');
    await this.users.update(id, { passwordHash: await hashPassword(newPassword) });
  }

  // --- Admin operations ---

  async list(params: ListUsersParams): Promise<Paginated<PublicUser>> {
    const page = await this.users.list(params);
    return { ...page, items: page.items.map(toPublicUser) };
  }

  async setActive(id: string, isActive: boolean): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('Utilisateur');
    const updated = await this.users.update(id, { isActive });
    return toPublicUser(updated);
  }

  async setRole(id: string, role: Role): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('Utilisateur');
    const updated = await this.users.update(id, { role });
    return toPublicUser(updated);
  }

  async adminUpdate(id: string, input: { isActive?: boolean; role?: Role }): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('Utilisateur');
    const updated = await this.users.update(id, input);
    return toPublicUser(updated);
  }
}
