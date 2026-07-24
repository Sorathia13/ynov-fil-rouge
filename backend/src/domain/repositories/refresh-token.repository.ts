export interface RefreshTokenRecord {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface RefreshTokenRepository {
  create(input: { tokenHash: string; userId: string; expiresAt: Date }): Promise<RefreshTokenRecord>;
  /** Return a token record only if it exists, is not revoked and not expired. */
  findValidByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  deleteExpired(): Promise<number>;
}
