import { z } from 'zod';
import { validateCNPJ } from '@/lib/utils/cnpj';

export const createCompanySchema = z.object({
  name: z.string().min(2).max(200),
  legalName: z.string().max(200).optional(),
  document: z.string().refine(validateCNPJ, { message: 'CNPJ invalido' }),
  baseCurrency: z.enum(['BRL', 'USD']).default('BRL'),
  country: z.string().length(2).default('BR'),
  timezone: z.string().default('America/Sao_Paulo'),
  fiscalYearStart: z.number().min(1).max(12).default(1),
  sector: z.string().max(100).optional()
});

export const updateCompanySchema = createCompanySchema.partial().omit({ document: true });

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
