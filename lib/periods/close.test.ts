import { describe, expect, it } from 'vitest';
import { getPeriodDates } from './close';

describe('getPeriodDates', () => {
  it('retorna start e end corretos para abril/2025', () => {
    const { start, end, year, month } = getPeriodDates(2025, 4);

    expect(start.toISOString().slice(0, 10)).toBe('2025-04-01');
    expect(end.toISOString().slice(0, 10)).toBe('2025-04-30');
    expect(year).toBe(2025);
    expect(month).toBe(4);
  });

  it('retorna start e end corretos para fevereiro/2024 em ano bissexto', () => {
    const { start, end } = getPeriodDates(2024, 2);

    expect(start.toISOString().slice(0, 10)).toBe('2024-02-01');
    expect(end.toISOString().slice(0, 10)).toBe('2024-02-29');
  });

  it('retorna start e end corretos para dezembro/2025', () => {
    const { start, end } = getPeriodDates(2025, 12);

    expect(start.toISOString().slice(0, 10)).toBe('2025-12-01');
    expect(end.toISOString().slice(0, 10)).toBe('2025-12-31');
  });

  it('retorna start e end corretos para janeiro/2025', () => {
    const { start, end } = getPeriodDates(2025, 1);

    expect(start.toISOString().slice(0, 10)).toBe('2025-01-01');
    expect(end.toISOString().slice(0, 10)).toBe('2025-01-31');
  });
});

describe('logica de status de periodo', () => {
  type Status = 'open' | 'closed' | 'locked';

  function canClose(status: Status): boolean {
    return status === 'open';
  }

  function canReopen(status: Status, role: string): boolean {
    if (status === 'locked') return role === 'owner';
    if (status === 'closed') return ['admin', 'owner'].includes(role);
    return false;
  }

  function canLock(status: Status, role: string): boolean {
    return status === 'closed' && role === 'owner';
  }

  function canUnlock(status: Status, role: string): boolean {
    return status === 'locked' && role === 'owner';
  }

  it('apenas open pode ser fechado', () => {
    expect(canClose('open')).toBe(true);
    expect(canClose('closed')).toBe(false);
    expect(canClose('locked')).toBe(false);
  });

  it('closed pode ser reaberto por admin ou owner', () => {
    expect(canReopen('closed', 'admin')).toBe(true);
    expect(canReopen('closed', 'owner')).toBe(true);
    expect(canReopen('closed', 'financial')).toBe(false);
  });

  it('locked so pode ser reaberto pelo owner', () => {
    expect(canReopen('locked', 'owner')).toBe(true);
    expect(canReopen('locked', 'admin')).toBe(false);
    expect(canReopen('locked', 'financial')).toBe(false);
  });

  it('bloquear exige closed e owner', () => {
    expect(canLock('closed', 'owner')).toBe(true);
    expect(canLock('closed', 'admin')).toBe(false);
    expect(canLock('open', 'owner')).toBe(false);
  });

  it('desbloquear exige locked e owner', () => {
    expect(canUnlock('locked', 'owner')).toBe(true);
    expect(canUnlock('closed', 'owner')).toBe(false);
    expect(canUnlock('locked', 'admin')).toBe(false);
  });
});

describe('highlights de fechamento', () => {
  function calcGrowth(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  it('despesas subiram 25%, acima do threshold de highlight', () => {
    const growth = calcGrowth(50000, 40000);

    expect(growth).toBeCloseTo(25, 1);
    expect(Math.abs(growth ?? 0) > 20).toBe(true);
  });

  it('despesas estaveis nao passam do threshold de highlight', () => {
    const growth = calcGrowth(41000, 40000);

    expect(Math.abs(growth ?? 0) <= 20).toBe(true);
  });

  it('retorna null quando nao ha mes anterior', () => {
    expect(calcGrowth(50000, 0)).toBeNull();
  });
});
