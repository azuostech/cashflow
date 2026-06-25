import { addMonths } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { buildRecurrenceDates, distributeAmount } from './domain';

describe('distributeAmount', () => {
  it('distribui valor exato sem resto', () => {
    const result = distributeAmount(300, 3);

    expect(result).toEqual([100, 100, 100]);
    expect(result.reduce((total, amount) => total + amount, 0)).toBe(300);
  });

  it('coloca o resto na primeira parcela', () => {
    const result = distributeAmount(1000, 3);

    expect(result[0]).toBeCloseTo(333.34, 2);
    expect(result[1]).toBeCloseTo(333.33, 2);
    expect(result[2]).toBeCloseTo(333.33, 2);

    const sum = result.reduce((total, amount) => total + amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(1000);
  });

  it('funciona com valor decimal', () => {
    const result = distributeAmount(99.99, 2);
    const sum = result.reduce((total, amount) => total + amount, 0);

    expect(Math.round(sum * 100) / 100).toBe(99.99);
  });

  it('retorna array com tamanho correto', () => {
    expect(distributeAmount(500, 5).length).toBe(5);
    expect(distributeAmount(100, 12).length).toBe(12);
  });
});

describe('buildRecurrenceDates', () => {
  it('gera datas mensais ate 12 meses', () => {
    const dates = buildRecurrenceDates({
      frequency: 'monthly',
      interval: 1,
      startDate: new Date()
    });

    expect(dates.length).toBeGreaterThan(0);
    expect(dates.length).toBeLessThanOrEqual(13);
  });

  it('respeita endDate', () => {
    const start = new Date();
    const end = addMonths(start, 3);
    const dates = buildRecurrenceDates({
      frequency: 'monthly',
      interval: 1,
      startDate: start,
      endDate: end
    });

    dates.forEach((date) => expect(date <= end).toBe(true));
  });

  it('respeita occurrencesLimit', () => {
    const dates = buildRecurrenceDates({
      frequency: 'monthly',
      interval: 1,
      startDate: new Date(),
      occurrencesLimit: 3
    });

    expect(dates.length).toBe(3);
  });

  it('gera datas semanais', () => {
    const dates = buildRecurrenceDates({
      frequency: 'weekly',
      interval: 1,
      startDate: new Date(),
      occurrencesLimit: 4
    });

    expect(dates.length).toBe(4);
  });

  it('retorna array vazio para data inicial alem de 12 meses', () => {
    const dates = buildRecurrenceDates({
      frequency: 'monthly',
      interval: 1,
      startDate: addMonths(new Date(), 13)
    });

    expect(dates.length).toBe(0);
  });
});
