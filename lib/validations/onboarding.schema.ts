import { z } from 'zod';
import { validateCNPJ } from '@/lib/utils/cnpj';

export const onboardingCompanySchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(200),
  legalName: z.string().max(200).optional(),
  document: z
    .string()
    .min(14, 'CNPJ invalido')
    .refine((value) => validateCNPJ(value), 'CNPJ invalido'),
  baseCurrency: z.enum(['BRL', 'USD'], { required_error: 'Selecione a moeda' }),
  timezone: z.string().default('America/Sao_Paulo'),
  fiscalYearStart: z.coerce.number().min(1).max(12).default(1)
});

export const onboardingBankAccountSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio').max(100),
  type: z.enum(['checking', 'savings', 'cash', 'digital', 'investment'], {
    required_error: 'Selecione o tipo'
  }),
  currency: z.enum(['BRL', 'USD']).default('BRL'),
  bankProviderId: z.string().uuid().optional(),
  initialBalance: z.coerce.number().default(0),
  initialBalanceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida - formato YYYY-MM-DD'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});

export const onboardingCostCenterSchema = z.object({
  costCenters: z
    .array(z.object({ name: z.string().min(1) }))
    .min(1, 'Adicione ao menos 1 centro de custo')
});

export const onboardingCategorySchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(['revenue', 'expense']),
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
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
      })
    )
    .min(1, 'Adicione ao menos 1 categoria')
});

export type OnboardingCompanyInput = z.infer<typeof onboardingCompanySchema>;
export type OnboardingCompanyFormInput = z.input<typeof onboardingCompanySchema>;
export type OnboardingBankAccountInput = z.infer<typeof onboardingBankAccountSchema>;
export type OnboardingBankAccountFormInput = z.input<typeof onboardingBankAccountSchema>;
export type OnboardingCostCenterInput = z.infer<typeof onboardingCostCenterSchema>;
export type OnboardingCategoryInput = z.infer<typeof onboardingCategorySchema>;
