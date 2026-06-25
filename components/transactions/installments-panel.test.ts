import { describe, expect, it } from 'vitest';
import { generateInstallmentPreviews } from '@/lib/transactions';

describe('generateInstallmentPreviews', () => {
  it('distribui arredondamento na primeira parcela', () => {
    const previews = generateInstallmentPreviews(1000, 3, new Date('2026-01-10T00:00:00Z'));

    expect(previews.map((preview) => preview.originalAmount)).toEqual([333.34, 333.33, 333.33]);
    expect(previews.reduce((sum, preview) => sum + preview.originalAmount, 0)).toBeCloseTo(1000, 2);
  });

  it('gera vencimentos mensais a partir da primeira data', () => {
    const previews = generateInstallmentPreviews(300, 3, new Date('2026-01-15T00:00:00Z'));

    expect(previews.map((preview) => preview.dueDate)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  it('aplica cambio nos valores convertidos', () => {
    const previews = generateInstallmentPreviews(100, 2, new Date('2026-01-01T00:00:00Z'), 5.2);

    expect(previews.map((preview) => preview.convertedAmount)).toEqual([260, 260]);
  });

  it('ignora configuracoes invalidas', () => {
    expect(generateInstallmentPreviews(100, 1, new Date('2026-01-01T00:00:00Z'))).toEqual([]);
    expect(generateInstallmentPreviews(Number.NaN, 3, new Date('2026-01-01T00:00:00Z'))).toEqual([]);
  });
});
