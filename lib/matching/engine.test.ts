import { describe, expect, it } from 'vitest';
import { confidenceLabel } from './engine';

describe('scoreAmount - comportamento esperado', () => {
  const cases = [
    { move: 1000, tx: 1000, expected: 1, desc: 'valores identicos' },
    { move: 1000, tx: 1001, expected: 0.9, desc: 'diferenca 0.1%' },
    { move: 1000, tx: 990, expected: 0.7, desc: 'diferenca 1%' },
    { move: 1000, tx: 960, expected: 0.4, desc: 'diferenca 4%' },
    { move: 1000, tx: 900, expected: 0, desc: 'diferenca 10%' }
  ];

  for (const item of cases) {
    it(item.desc, () => {
      const diff = Math.abs(item.move - item.tx) / Math.max(item.move, 0.01);
      const score = diff === 0 ? 1 : diff <= 0.001 ? 0.9 : diff <= 0.01 ? 0.7 : diff <= 0.05 ? 0.4 : 0;

      expect(score).toBe(item.expected);
    });
  }
});

describe('scoreDate - comportamento esperado', () => {
  const cases = [
    { days: 0, expected: 1 },
    { days: 1, expected: 0.8 },
    { days: 3, expected: 0.6 },
    { days: 7, expected: 0.3 },
    { days: 15, expected: 0.1 },
    { days: 30, expected: 0 }
  ];

  for (const item of cases) {
    it(`${item.days} dias -> ${item.expected}`, () => {
      const score =
        item.days === 0
          ? 1
          : item.days === 1
            ? 0.8
            : item.days <= 3
              ? 0.6
              : item.days <= 7
                ? 0.3
                : item.days <= 15
                  ? 0.1
                  : 0;

      expect(score).toBe(item.expected);
    });
  }
});

describe('confidenceLabel', () => {
  const cases = [
    { score: 0.95, expected: 'high' },
    { score: 0.9, expected: 'high' },
    { score: 0.89, expected: 'medium' },
    { score: 0.6, expected: 'medium' },
    { score: 0.59, expected: 'low' },
    { score: 0, expected: 'low' }
  ] as const;

  for (const item of cases) {
    it(`score ${item.score} -> ${item.expected}`, () => {
      expect(confidenceLabel(item.score)).toBe(item.expected);
    });
  }
});

describe('score composto ponderado', () => {
  it('valor exato + mesma data = score medio', () => {
    const amountScore = 1;
    const dateScore = 1;
    const contactScore = 0;
    const descriptionScore = 0;
    const score = 0.4 * amountScore + 0.25 * dateScore + 0.2 * contactScore + 0.15 * descriptionScore;

    expect(score).toBeCloseTo(0.65, 2);
  });

  it('valor diferente + mesma data + CNPJ = score medio-alto', () => {
    const amountScore = 0.4;
    const dateScore = 1;
    const contactScore = 1;
    const descriptionScore = 0.4;
    const score = 0.4 * amountScore + 0.25 * dateScore + 0.2 * contactScore + 0.15 * descriptionScore;

    expect(score).toBeGreaterThanOrEqual(0.6);
  });

  it('valor diferente + data distante = score abaixo do threshold', () => {
    const amountScore = 0;
    const dateScore = 0;
    const contactScore = 0;
    const descriptionScore = 0;
    const score = 0.4 * amountScore + 0.25 * dateScore + 0.2 * contactScore + 0.15 * descriptionScore;

    expect(score).toBe(0);
  });
});
