import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a hex color')
  .optional();

export const createServiceSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(1000).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(1440),
  priceCents: z.number().int().min(0).max(100_000_00).optional(),
  color: hexColor,
});

export const updateServiceSchema = z
  .object({
    name: z.string().min(1).max(150).optional(),
    description: z.string().max(1000).nullable().optional(),
    durationMinutes: z.number().int().min(5).max(1440).optional(),
    priceCents: z.number().int().min(0).max(100_000_00).optional(),
    color: hexColor,
    isActive: z.boolean().optional(),
  })
  .strict();
