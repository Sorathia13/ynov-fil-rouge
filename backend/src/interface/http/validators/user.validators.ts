import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().max(30).nullable().optional(),
    avatarUrl: z.string().url().max(500).nullable().optional(),
  })
  .strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const adminUpdateUserSchema = z
  .object({
    isActive: z.boolean().optional(),
    role: z.enum(['CLIENT', 'PRO', 'ADMIN']).optional(),
  })
  .strict();

export const listUsersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['CLIENT', 'PRO', 'ADMIN']).optional(),
  search: z.string().max(100).optional(),
});
