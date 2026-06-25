import { describe, expect, it } from 'vitest';
import { onboardingBankAccountSchema, onboardingCompanySchema } from './onboarding.schema';

describe('onboardingCompanySchema', () => {
  const valid = {
    name: 'Acme Corp',
    document: '11.222.333/0001-81',
    baseCurrency: 'BRL',
    timezone: 'America/Sao_Paulo',
    fiscalYearStart: 1
  };

  it('aceita empresa valida', () => {
    expect(onboardingCompanySchema.safeParse(valid).success).toBe(true);
  });

  it('rejeita nome curto', () => {
    expect(onboardingCompanySchema.safeParse({ ...valid, name: 'A' }).success).toBe(false);
  });

  it('rejeita CNPJ invalido', () => {
    expect(onboardingCompanySchema.safeParse({ ...valid, document: '00.000.000/0000-00' }).success).toBe(false);
  });

  it('rejeita moeda invalida', () => {
    expect(onboardingCompanySchema.safeParse({ ...valid, baseCurrency: 'EUR' }).success).toBe(false);
  });
});

describe('onboardingBankAccountSchema', () => {
  const valid = {
    name: 'Nubank Corrente',
    type: 'checking',
    currency: 'BRL',
    initialBalance: 1000,
    initialBalanceDate: '2025-01-01'
  };

  it('aceita conta valida', () => {
    expect(onboardingBankAccountSchema.safeParse(valid).success).toBe(true);
  });

  it('rejeita nome vazio', () => {
    expect(onboardingBankAccountSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('rejeita data com formato errado', () => {
    expect(onboardingBankAccountSchema.safeParse({ ...valid, initialBalanceDate: '01/01/2025' }).success).toBe(false);
  });
});
