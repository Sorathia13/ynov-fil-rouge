/** Public-facing data shapes and mappers (never expose password hashes, etc.). */
import { Role } from '../domain/entities';
import { UserRecord } from '../domain/repositories/user.repository';
import { Slot } from '../domain/services/scheduling-engine';

export interface PublicUser {
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

export function toPublicUser(u: UserRecord): PublicUser {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export interface SlotDTO {
  start: string;
  end: string;
}

export function toSlotDTO(slot: Slot): SlotDTO {
  return { start: slot.start.toISOString(), end: slot.end.toISOString() };
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
}

/** The authenticated caller, derived from the verified access token. */
export interface AuthenticatedActor {
  id: string;
  role: Role;
  email: string;
}
