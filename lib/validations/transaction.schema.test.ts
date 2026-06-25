import { describe, expect, it } from 'vitest';
import { cancelTransactionSchema, createTransactionSchema, payTransactionSchema } from './transaction.schema';

const validBase = {
  type: 'expense',
  description: 'Aluguel marco',
  originalAmount: 8500,
  originalCurrency: 'BRL',
  competenceDate: '2025-03-01',
  dueDate: '2025-03-05',
  status: 'pending',
  categoryId: '11111111-1111-1111-1111-111111111111',
  costCenterId: '22222222-2222-2222-2222-222222222222'
};

describe('createTransactionSchema', () => {
  it('aceita lancamento basico valido', () => {
    expect(createTransactionSchema.safeParse(validBase).success).toBe(true);
  });

  it('rejeita description com menos de 3 chars', () => {
    expect(createTransactionSchema.safeParse({ ...validBase, description: 'Al' }).success).toBe(false);
  });

  it('rejeita amount negativo', () => {
    expect(createTransactionSchema.safeParse({ ...validBase, originalAmount: -100 }).success).toBe(false);
  });

  it('rejeita amount zero', () => {
    expect(createTransactionSchema.safeParse({ ...validBase, originalAmount: 0 }).success).toBe(false);
  });

  it('rejeita data no formato errado', () => {
    expect(createTransactionSchema.safeParse({ ...validBase, competenceDate: '01/03/2025' }).success).toBe(false);
  });

  it('aceita moeda USD', () => {
    expect(
      createTransactionSchema.safeParse({ ...validBase, originalCurrency: 'USD', exchangeRate: 5.25 }).success
    ).toBe(true);
  });

  it('rejeita status invalido', () => {
    expect(createTransactionSchema.safeParse({ ...validBase, status: 'vencido' }).success).toBe(false);
  });

  it('aceita parcelamento com count valido', () => {
    expect(createTransactionSchema.safeParse({ ...validBase, isInstallment: true, installmentCount: 12 }).success).toBe(
      true
    );
  });

  it('rejeita parcelamento com count maior que 360', () => {
    expect(createTransactionSchema.safeParse({ ...validBase, isInstallment: true, installmentCount: 361 }).success).toBe(
      false
    );
  });
});

describe('payTransactionSchema', () => {
  it('aceita pagamento valido', () => {
    expect(
      payTransactionSchema.safeParse({
        paymentDate: '2025-03-05',
        bankAccountId: '11111111-1111-1111-1111-111111111111'
      }).success
    ).toBe(true);
  });

  it('rejeita bankAccountId invalido', () => {
    expect(
      payTransactionSchema.safeParse({
        paymentDate: '2025-03-05',
        bankAccountId: 'nao-uuid'
      }).success
    ).toBe(false);
  });
});

describe('cancelTransactionSchema', () => {
  it('aceita cancelamento com justificativa', () => {
    expect(cancelTransactionSchema.safeParse({ justification: 'Errou o valor' }).success).toBe(true);
  });

  it('rejeita justificativa muito curta', () => {
    expect(cancelTransactionSchema.safeParse({ justification: 'Ok' }).success).toBe(false);
  });
});
