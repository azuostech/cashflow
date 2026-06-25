import { z } from 'zod';

export const TRANSACTION_TYPES = [
  'revenue',
  'expense',
  'transfer',
  'loan',
  'investment',
  'contribution',
  'profit_distribution'
] as const;

export const TRANSACTION_STATUSES = ['pending', 'paid', 'received', 'cancelled', 'overdue'] as const;

export const CURRENCIES = ['BRL', 'USD'] as const;

export const RECURRENCE_FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual'
] as const;

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD');

export const createTransactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  description: z.string().min(3, 'Minimo 3 caracteres').max(500),
  originalAmount: z.coerce.number().positive('Valor deve ser positivo'),
  originalCurrency: z.enum(CURRENCIES).default('BRL'),
  competenceDate: dateOnlySchema,
  dueDate: dateOnlySchema,
  status: z.enum(TRANSACTION_STATUSES).default('pending'),

  categoryId: z.string().uuid().optional().nullable(),
  costCenterId: z.string().uuid().optional().nullable(),
  bankAccountId: z.string().uuid().optional().nullable(),
  destBankAccountId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),

  paymentDate: dateOnlySchema.optional().nullable(),

  exchangeRate: z.coerce.number().positive().optional().nullable(),
  exchangeRateDate: dateOnlySchema.optional().nullable(),

  isInstallment: z.boolean().default(false),
  installmentCount: z.coerce.number().int().min(2).max(360).optional().nullable(),

  recurrence: z
    .object({
      frequency: z.enum(RECURRENCE_FREQUENCIES),
      interval: z.coerce.number().int().min(1).max(12).default(1),
      startDate: dateOnlySchema,
      endDate: dateOnlySchema.optional().nullable(),
      occurrencesLimit: z.coerce.number().int().min(1).max(360).optional().nullable(),
      dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable()
    })
    .optional()
    .nullable(),

  notes: z.string().max(2000).optional().nullable(),
  sourceDocumentNumber: z.string().max(100).optional().nullable(),
  externalReference: z.string().max(255).optional().nullable(),
  justification: z.string().min(20).optional().nullable()
});

export const updateTransactionSchema = createTransactionSchema.partial().omit({
  type: true,
  isInstallment: true,
  recurrence: true
});

export const payTransactionSchema = z.object({
  paymentDate: dateOnlySchema,
  bankAccountId: z.string().uuid('Conta bancaria obrigatoria'),
  amount: z.coerce.number().positive().optional(),
  notes: z.string().max(500).optional().nullable()
});

export const cancelTransactionSchema = z.object({
  justification: z.string().min(5, 'Justificativa obrigatoria (minimo 5 caracteres)'),
  cancelFuture: z.boolean().default(false)
});

export const payInstallmentSchema = z.object({
  paymentDate: dateOnlySchema,
  bankAccountId: z.string().uuid(),
  amount: z.coerce.number().positive().optional(),
  notes: z.string().max(500).optional().nullable()
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type PayTransactionInput = z.infer<typeof payTransactionSchema>;
export type CancelTransactionInput = z.infer<typeof cancelTransactionSchema>;
export type PayInstallmentInput = z.infer<typeof payInstallmentSchema>;
