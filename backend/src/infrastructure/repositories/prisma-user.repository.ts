import type { Prisma, User } from '@prisma/client';
import { prisma } from '../prisma/client';
import {
  CreateUserInput,
  ListUsersParams,
  UpdateUserInput,
  UserRecord,
  UserRepository,
} from '../../domain/repositories/user.repository';
import { Paginated, paginate, toSkipTake } from '../../shared/pagination';

function toRecord(u: User): UserRecord {
  return {
    id: u.id,
    email: u.email,
    passwordHash: u.passwordHash,
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

export class PrismaUserRepository implements UserRepository {
  async create(input: CreateUserInput): Promise<UserRecord> {
    const u = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        role: input.role,
      },
    });
    return toRecord(u);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const u = await prisma.user.findUnique({ where: { id } });
    return u ? toRecord(u) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return u ? toRecord(u) : null;
  }

  async update(id: string, input: UpdateUserInput): Promise<UserRecord> {
    const u = await prisma.user.update({ where: { id }, data: { ...input } });
    return toRecord(u);
  }

  async list(params: ListUsersParams): Promise<Paginated<UserRecord>> {
    const where: Prisma.UserWhereInput = {};
    if (params.role) where.role = params.role;
    if (params.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    const { skip, take } = toSkipTake(params);
    const [rows, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.user.count({ where }),
    ]);
    return paginate(rows.map(toRecord), total, params);
  }
}
