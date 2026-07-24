import { prisma } from '../prisma/client';
import {
  RefreshTokenRecord,
  RefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository';

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  async create(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    return prisma.refreshToken.create({ data: input });
  }

  async findValidByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async revoke(id: string): Promise<void> {
    await prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
