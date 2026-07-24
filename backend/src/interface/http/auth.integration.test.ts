import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { prisma } from '../../infrastructure/prisma/client';

const app = createApp();
const uniqueEmail = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Auth API (integration)', () => {
  it('registers a new user and returns a session', async () => {
    const email = uniqueEmail('reg');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', firstName: 'Jean', lastName: 'Test' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user).toMatchObject({ email, role: 'CLIENT' });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a weak password with 422', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail('weak'), password: 'short', firstName: 'A', lastName: 'B' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a duplicate email with 409', async () => {
    const email = uniqueEmail('dup');
    const payload = { email, password: 'Password123!', firstName: 'A', lastName: 'B' };
    await request(app).post('/api/auth/register').send(payload).expect(201);
    const res = await request(app).post('/api/auth/register').send(payload);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('logs in and accesses a protected route', async () => {
    const email = uniqueEmail('login');
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', firstName: 'Log', lastName: 'In' })
      .expect(201);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password123!' });
    expect(login.status).toBe(200);

    const me = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(email);
  });

  it('rejects invalid credentials with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.dev', password: 'whatever123' });
    expect(res.status).toBe(401);
  });

  it('rejects a protected route without a token with 401', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('rotates a refresh token', async () => {
    const email = uniqueEmail('refresh');
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', firstName: 'R', lastName: 'T' })
      .expect(201);

    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();

    // The old refresh token must no longer be usable (rotation).
    const reuse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken });
    expect(reuse.status).toBe(401);
  });
});
