import { z } from 'zod';

export const createProfessionalSchema = z.object({
  businessName: z.string().min(1).max(150),
  bio: z.string().max(2000).nullable().optional(),
  timezone: z.string().min(1).max(64).optional(),
});

export const updateProfessionalSchema = z
  .object({
    businessName: z.string().min(1).max(150).optional(),
    bio: z.string().max(2000).nullable().optional(),
    timezone: z.string().min(1).max(64).optional(),
  })
  .strict();

export const workingHoursSchema = z.object({
  hours: z
    .array(
      z
        .object({
          weekday: z.number().int().min(0).max(6),
          startMinute: z.number().int().min(0).max(1440),
          endMinute: z.number().int().min(0).max(1440),
        })
        .refine((h) => h.endMinute > h.startMinute, {
          message: 'endMinute must be greater than startMinute',
        }),
    )
    .max(50),
});

export const timeOffSchema = z
  .object({
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    reason: z.string().max(255).nullable().optional(),
  })
  .refine((v) => v.endAt.getTime() > v.startAt.getTime(), {
    message: 'endAt must be after startAt',
  });
