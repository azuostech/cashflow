import { describe, expect, it } from 'vitest';

describe('calculo de Dias de Caixa', () => {
  function calcDaysOfCash(balance: number, burnRateDaily: number): number | null {
    if (burnRateDaily <= 0) return null;
    return Math.floor(balance / burnRateDaily);
  }

  it('caixa para 35 dias com burn rate 2416/dia', () => {
    expect(calcDaysOfCash(85200, 2416)).toBe(35);
  });

  it('retorna null quando burn rate e zero', () => {
    expect(calcDaysOfCash(10000, 0)).toBeNull();
  });

  it('retorna zero quando saldo e zero', () => {
    expect(calcDaysOfCash(0, 1000)).toBe(0);
  });

  it('retorna negativo quando saldo e negativo', () => {
    expect(calcDaysOfCash(-5000, 1000)).toBeLessThan(0);
  });
});

describe('deteccao de semana de risco', () => {
  function isRisk(balance: number, threshold = 0): boolean {
    return balance <= threshold;
  }

  it('negativo e risco', () => expect(isRisk(-100)).toBe(true));
  it('zero e risco', () => expect(isRisk(0)).toBe(true));
  it('positivo nao e risco', () => expect(isRisk(1)).toBe(false));
  it('abaixo do threshold customizado e risco', () => expect(isRisk(500, 1000)).toBe(true));
});

describe('calculo de saldo acumulado', () => {
  function accumulate(opening: number, entries: { inflow: number; outflow: number }[]): number[] {
    let balance = opening;
    return entries.map((entry) => {
      balance += entry.inflow - entry.outflow;
      return balance;
    });
  }

  it('acumula corretamente ao longo de 3 dias', () => {
    const result = accumulate(1000, [
      { inflow: 500, outflow: 200 },
      { inflow: 0, outflow: 800 },
      { inflow: 200, outflow: 0 }
    ]);

    expect(result).toEqual([1300, 500, 700]);
  });

  it('detecta saldo minimo', () => {
    const result = accumulate(5000, [
      { inflow: 0, outflow: 3000 },
      { inflow: 0, outflow: 2500 },
      { inflow: 10000, outflow: 0 }
    ]);

    expect(Math.min(...result)).toBe(-500);
  });
});
