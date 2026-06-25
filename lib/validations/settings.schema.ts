import { z } from 'zod';

export const updateCompanySchema = z.object({
  name: z.string().min(2).max(200).optional(),
  legalName: z.string().max(200).optional().nullable(),
  sector: z.string().max(100).optional().nullable(),
  size: z.enum(['micro', 'small', 'medium', 'large']).optional().nullable(),
  fiscalYearStart: z.coerce.number().min(1).max(12).optional(),
  timezone: z.string().optional()
});

export const updateBankAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['checking', 'savings', 'cash', 'digital', 'investment']).optional(),
  currency: z.enum(['BRL', 'USD']).optional(),
  bankProviderId: z.string().uuid().optional().nullable(),
  bankName: z.string().max(100).optional().nullable(),
  agency: z.string().max(20).optional().nullable(),
  accountNumber: z.string().max(30).optional().nullable(),
  initialBalance: z.coerce.number().optional(),
  initialBalanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  includeInConsolidatedCashflow: z.boolean().optional(),
  active: z.boolean().optional()
});

export const createCostCenterSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional().nullable(),
  parentId: z.string().uuid().optional().nullable()
});

export const updateCostCenterSchema = createCostCenterSchema.partial().extend({
  active: z.boolean().optional()
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['revenue', 'expense', 'transfer']),
  dreNodeId: z.string().uuid(),
  cashflowGroup: z.enum([
    'operating_inflow',
    'operating_outflow',
    'investing_inflow',
    'investing_outflow',
    'financing_inflow',
    'financing_outflow',
    'transfer'
  ]),
  parentId: z.string().uuid().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  icon: z.string().max(50).optional().nullable()
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  icon: z.string().max(50).optional().nullable()
});

export const createContactSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['customer', 'supplier', 'both', 'employee', 'other']),
  document: z
    .string()
    .optional()
    .nullable()
    .refine((value) => {
      if (!value) return true;
      const cleaned = value.replace(/\D/g, '');
      return cleaned.length === 0 || cleaned.length === 11 || cleaned.length === 14;
    }, 'Documento deve ser CPF (11 digitos) ou CNPJ (14 digitos)'),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().max(20).optional().nullable(),
  active: z.boolean().optional()
});

export const updateContactSchema = createContactSchema.partial();

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
export type CreateCostCenterInput = z.infer<typeof createCostCenterSchema>;
export type UpdateCostCenterInput = z.infer<typeof updateCostCenterSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
