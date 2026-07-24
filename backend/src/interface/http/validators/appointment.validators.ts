import { z } from 'zod';

export const bookSchema = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startAt: z.coerce.date(),
  notes: z.string().max(1000).nullable().optional(),
});

export const availabilitySchema = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startAt: z.coerce.date(),
});

export const slotsQuery = z
  .object({
    professionalId: z.string().uuid(),
    serviceId: z.string().uuid(),
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((v) => v.to.getTime() > v.from.getTime(), { message: 'to must be after from' })
  .refine((v) => v.to.getTime() - v.from.getTime() <= 62 * 86_400_000, {
    message: 'window must not exceed 62 days',
  });

export const rescheduleSchema = z.object({ startAt: z.coerce.date() });

export const statusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']),
});

export const listAppointmentsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
});
