import { z } from 'zod';

export const createBankAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['checking', 'savings', 'cash', 'digital', 'investment']),
  currency: z.enum(['BRL', 'USD']).default('BRL'),
  bankProviderId: z.string().uuid().optional(),
  bankName: z.string().max(100).optional(),
  agency: z.string().max(20).optional(),
  accountNumber: z.string().max(30).optional(),
  initialBalance: z.coerce.number().default(0),
  initialBalanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  includeInConsolidatedCashflow: z.boolean().default(true)
});

export const updateBankAccountSchema = createBankAccountSchema.partial();

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
