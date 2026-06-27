import { describe, expect, it } from 'vitest';
import { calculateDaysOfCash, calculateGrowth, calculateMargin } from './kpis';
import { sortFinancialCenterItems } from './financial-center';

describe('calculo de Dias de Caixa', () => {
  it('retorna 30 dias com saldo 90k e burn rate 3k/dia', () => {
    expect(calculateDaysOfCash(90000, 3000)).toBe(30);
  });

  it('retorna null quando burn rate e zero', () => {
    expect(calculateDaysOfCash(100000, 0)).toBeNull();
  });

  it('retorna valor negativo quando saldo e negativo', () => {
    expect(calculateDaysOfCash(-10000, 1000)).toBeLessThan(0);
  });
});

describe('calculo de margem', () => {
  it('calcula margem positiva', () => {
    expect(calculateMargin(25000, 100000)).toBeCloseTo(25, 1);
  });

  it('calcula margem negativa', () => {
    expect(calculateMargin(-10000, 80000)).toBeLessThan(0);
  });

  it('retorna zero quando receita e zero', () => {
    expect(calculateMargin(0, 0)).toBe(0);
  });
});

describe('calculo de crescimento percentual', () => {
  it('calcula crescimento positivo', () => {
    expect(calculateGrowth(120000, 100000)).toBeCloseTo(20, 1);
  });

  it('calcula queda', () => {
    expect(calculateGrowth(90000, 100000)).toBeCloseTo(-10, 1);
  });

  it('retorna null quando periodo anterior e zero', () => {
    expect(calculateGrowth(50000, 0)).toBeNull();
  });
});

describe('priorizacao de itens da Central Financeira', () => {
  it('coloca itens criticos antes de warning', () => {
    const sorted = sortFinancialCenterItems([
      { urgency: 'warning' as const, daysOverdue: 5 },
      { urgency: 'critical' as const, daysOverdue: 2 }
    ]);

    expect(sorted[0].urgency).toBe('critical');
  });

  it('coloca maior atraso primeiro dentro da mesma urgencia', () => {
    const sorted = sortFinancialCenterItems([
      { urgency: 'critical' as const, daysOverdue: 1 },
      { urgency: 'critical' as const, daysOverdue: 5 }
    ]);

    expect(sorted[0].daysOverdue).toBe(5);
  });
});
