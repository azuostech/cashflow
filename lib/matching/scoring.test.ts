import { describe, expect, it } from 'vitest';

describe('score composto - cenarios realistas', () => {
  function scoreAmount(move: number, tx: number): number {
    const diff = Math.abs(Math.abs(move) - Math.abs(tx)) / Math.max(Math.abs(move), 0.01);
    return diff === 0 ? 1 : diff <= 0.001 ? 0.9 : diff <= 0.01 ? 0.7 : diff <= 0.05 ? 0.4 : 0;
  }

  function scoreDate(days: number): number {
    return days === 0 ? 1 : days === 1 ? 0.8 : days <= 3 ? 0.6 : days <= 7 ? 0.3 : days <= 15 ? 0.1 : 0;
  }

  function totalScore(amountScore: number, dateScore: number, contactScore: number, descriptionScore: number) {
    return 0.4 * amountScore + 0.25 * dateScore + 0.2 * contactScore + 0.15 * descriptionScore;
  }

  it('valor exato + mesma data >= 0.60 (medium)', () => {
    const score = totalScore(scoreAmount(1000, 1000), scoreDate(0), 0, 0);
    expect(score).toBeGreaterThanOrEqual(0.6);
  });

  it('valor exato + 1 dia de diferenca ainda >= 0.60', () => {
    const score = totalScore(scoreAmount(500, 500), scoreDate(1), 0, 0);
    expect(score).toBeGreaterThanOrEqual(0.6);
  });

  it('valor exato + mesma data + CNPJ + descricao similar = alta confianca', () => {
    const score = totalScore(scoreAmount(1000, 1000), scoreDate(0), 1, 0.4);
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it('valor 10% diferente nao contribui', () => {
    const score = totalScore(scoreAmount(1000, 900), scoreDate(0), 0, 0);
    expect(score).toBe(0.25);
  });

  it('abaixo do threshold 0.60 -> filtrado', () => {
    const score = totalScore(scoreAmount(1000, 900), scoreDate(30), 0, 0);
    expect(score).toBeLessThan(0.6);
  });
});
