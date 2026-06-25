import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50)
});

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD');

export const currencyCodeSchema = z.enum(['BRL', 'USD', 'EUR']);
