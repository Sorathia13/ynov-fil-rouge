import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { prisma } from '../../infrastructure/prisma/client';

const app: Express = createApp();
const uniqueEmail = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
const bearer = (token: string): [string, string] => ['Authorization', `Bearer ${token}`];

let clientToken: string;
let proToken: string;
let professionalId: string;
let serviceId: string;

beforeAll(async () => {
  // Professional account + profile + schedule + service
  const proReg = await request(app)
    .post('/api/auth/register')
    .send({ email: uniqueEmail('pro'), password: 'Password123!', firstName: 'Pro', lastName: 'Vider', role: 'PRO' });
  proToken = proReg.body.accessToken;

  const profile = await request(app)
    .post('/api/professionals')
    .set(...bearer(proToken))
    .send({ businessName: 'Salon Test', timezone: 'UTC' });
  professionalId = profile.body.id;

  await request(app)
    .put(`/api/professionals/${professionalId}/working-hours`)
    .set(...bearer(proToken))
    .send({ hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 540, endMinute: 1080 })) })
    .expect(200);

  const service = await request(app)
    .post(`/api/professionals/${professionalId}/services`)
    .set(...bearer(proToken))
    .send({ name: 'Consultation', durationMinutes: 30 });
  serviceId = service.body.id;

  const clientReg = await request(app)
    .post('/api/auth/register')
    .send({ email: uniqueEmail('cli'), password: 'Password123!', firstName: 'Cli', lastName: 'Ent' });
  clientToken = clientReg.body.accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Appointments API (integration)', () => {
  let bookedSlot: string;
  let appointmentId: string;

  it('lists available slots for a service', async () => {
    const from = new Date();
    const to = new Date(Date.now() + 3 * 86_400_000);
    const res = await request(app)
      .get('/api/appointments/slots')
      .query({ professionalId, serviceId, from: from.toISOString(), to: to.toISOString() })
      .set(...bearer(clientToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    bookedSlot = res.body[5]?.start ?? res.body[0].start;
  });

  it('books an available slot', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set(...bearer(clientToken))
      .send({ professionalId, serviceId, startAt: bookedSlot });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    appointmentId = res.body.id;
  });

  it('reports a conflict with nearest alternatives for a taken slot', async () => {
    const res = await request(app)
      .post('/api/appointments/availability')
      .set(...bearer(clientToken))
      .send({ professionalId, serviceId, startAt: bookedSlot });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe('CONFLICT');
    expect(res.body.alternatives.length).toBeGreaterThan(0);
  });

  it('refuses to double-book the same slot (409 + alternatives)', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set(...bearer(clientToken))
      .send({ professionalId, serviceId, startAt: bookedSlot });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
    expect(res.body.error.details.alternatives.length).toBeGreaterThan(0);
  });

  it('validates the booking payload (422)', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set(...bearer(clientToken))
      .send({ professionalId, serviceId, startAt: 'not-a-date' });
    expect(res.status).toBe(422);
  });

  it('lets the professional confirm the appointment', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set(...bearer(proToken))
      .send({ status: 'CONFIRMED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');
  });

  it('forbids a client from confirming an appointment (403)', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set(...bearer(clientToken))
      .send({ status: 'COMPLETED' });
    expect(res.status).toBe(403);
  });

  it('cancels the appointment', async () => {
    const res = await request(app)
      .post(`/api/appointments/${appointmentId}/cancel`)
      .set(...bearer(clientToken));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/appointments/me');
    expect(res.status).toBe(401);
  });
});
