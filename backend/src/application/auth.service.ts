import { Role } from '../domain/entities';
import { ConflictError, UnauthorizedError } from '../domain/errors';
import { RefreshTokenRepository } from '../domain/repositories/refresh-token.repository';
import { UserRecord, UserRepository } from '../domain/repositories/user.repository';
import { config } from '../infrastructure/config/env';
import { hashPassword, verifyPassword } from '../infrastructure/auth/password';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from '../infrastructure/auth/tokens';
import { AuthResult, toPublicUser } from './dto';

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  /** Self-registration is limited to CLIENT or PRO; ADMIN is provisioned internally. */
  role?: Extract<Role, 'CLIENT' | 'PRO'>;
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }
    const passwordHash = await hashPassword(input.password);
    const user = await this.users.create({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      role: input.role === 'PRO' ? 'PRO' : 'CLIENT',
    });
    return this.issueSession(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(email);
    // Verify a hash even when the user is missing, to keep timing uniform.
    const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const passwordOk = await verifyPassword(password, hash);
    if (!user || !user.isActive || !passwordOk) {
      throw new UnauthorizedError('Invalid email or password');
    }
    return this.issueSession(user);
  }

  /** Rotate a refresh token: validate, revoke the old one, issue a fresh session. */
  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const record = await this.refreshTokens.findValidByHash(hashRefreshToken(rawRefreshToken));
    if (!record) {
      throw new UnauthorizedError('Invalid or expired session');
    }
    const user = await this.users.findById(record.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid session');
    }
    await this.refreshTokens.revoke(record.id);
    return this.issueSession(user);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const record = await this.refreshTokens.findValidByHash(hashRefreshToken(rawRefreshToken));
    if (record) {
      await this.refreshTokens.revoke(record.id);
    }
  }

  private async issueSession(user: UserRecord): Promise<AuthResult> {
    const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
    const refreshToken = generateRefreshToken();
    await this.refreshTokens.create({
      tokenHash: hashRefreshToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + config.JWT_REFRESH_TTL * 1000),
    });
    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
      accessTokenExpiresIn: config.JWT_ACCESS_TTL,
    };
  }
}
