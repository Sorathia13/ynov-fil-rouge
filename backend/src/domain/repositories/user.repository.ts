import { Role, UserEntity } from '../entities';
import { PageParams, Paginated } from '../../shared/pagination';

/** A user as stored, including the (never-exposed) password hash. */
export interface UserRecord extends UserEntity {
  passwordHash: string;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role?: Role;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: Role;
  isActive?: boolean;
  passwordHash?: string;
}

export interface ListUsersParams extends PageParams {
  role?: Role;
  search?: string;
}

export interface UserRepository {
  create(input: CreateUserInput): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  update(id: string, input: UpdateUserInput): Promise<UserRecord>;
  list(params: ListUsersParams): Promise<Paginated<UserRecord>>;
}
