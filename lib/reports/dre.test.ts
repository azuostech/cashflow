import { describe, expect, it } from 'vitest';
import { buildExecutiveSummary, type DREResult } from './dre';

function makeDRE(overrides: Partial<DREResult> = {}): DREResult {
  return {
    nodes: {
      n1: {
        id: 'n1',
        code: '1.0',
        name: 'Receita Bruta',
        type: 'revenue',
        sign: 1,
        isSubtotal: false,
        sortOrder: 10,
        parentId: null,
        value: 95000,
        rawValue: 95000,
        children: [],
        categories: [{ id: 'c1', name: 'Servicos', color: null, value: 95000 }]
      },
      n2: {
        id: 'n2',
        code: '2.0',
        name: 'Deducoes',
        type: 'deduction',
        sign: -1,
        isSubtotal: false,
        sortOrder: 20,
        parentId: null,
        value: -9500,
        rawValue: 9500,
        children: [],
        categories: []
      },
      s1: {
        id: 's1',
        code: 'S1',
        name: 'Receita Liquida',
        type: 'revenue',
        sign: 1,
        isSubtotal: true,
        sortOrder: 30,
        parentId: null,
        value: 85500,
        rawValue: 85500,
        children: []
      },
      n3: {
        id: 'n3',
        code: '3.0',
        name: 'Custos Variaveis',
        type: 'variable_cost',
        sign: -1,
        isSubtotal: false,
        sortOrder: 40,
        parentId: null,
        value: -18000,
        rawValue: 18000,
        children: [],
        categories: []
      },
      n4: {
        id: 'n4',
        code: '4.0',
        name: 'Despesas Operacionais',
        type: 'fixed_cost',
        sign: -1,
        isSubtotal: false,
        sortOrder: 60,
        parentId: null,
        value: -45000,
        rawValue: 45000,
        children: [],
        categories: [
          { id: 'c2', name: 'Pessoal', color: null, value: -32000 },
          { id: 'c3', name: 'Aluguel', color: null, value: -8500 },
          { id: 'c4', name: 'Marketing', color: null, value: -3200 },
          { id: 'c5', name: 'TI/Software', color: null, value: -1300 }
        ]
      },
      s5: {
        id: 's5',
        code: 'S5',
        name: 'Lucro Liquido',
        type: 'tax',
        sign: 1,
        isSubtotal: true,
        sortOrder: 110,
        parentId: null,
        value: 22500,
        rawValue: 22500,
        children: []
      }
    },
    subtotals: { S1: 85500, S2: 67500, S3: 22500, S4: 22500, S5: 22500 },
    tree: [],
    period: { start: new Date('2025-04-01'), end: new Date('2025-04-30') },
    currency: 'BRL',
    ...overrides
  };
}

describe('buildExecutiveSummary', () => {
  it('calcula received, spent, result e margin corretamente', () => {
    const summary = buildExecutiveSummary(makeDRE());
    expect(summary.received).toBeCloseTo(85500, 0);
    expect(summary.result).toBeCloseTo(22500, 0);
    expect(summary.spent).toBeGreaterThan(0);
    expect(summary.margin).toBeGreaterThan(0);
  });

  it('margem e result / received * 100', () => {
    const summary = buildExecutiveSummary(makeDRE());
    const expectedMargin = (22500 / 85500) * 100;
    expect(summary.margin).toBeCloseTo(expectedMargin, 1);
  });

  it('topExpenses retorna no maximo 5 categorias', () => {
    const summary = buildExecutiveSummary(makeDRE());
    expect(summary.topExpenses.length).toBeLessThanOrEqual(5);
  });

  it('topExpenses ordenado por valor decrescente', () => {
    const summary = buildExecutiveSummary(makeDRE());
    for (let index = 1; index < summary.topExpenses.length; index += 1) {
      expect(summary.topExpenses[index - 1].value).toBeGreaterThanOrEqual(summary.topExpenses[index].value);
    }
  });

  it('percentual soma aproximadamente 100% nas top despesas', () => {
    const summary = buildExecutiveSummary(makeDRE());
    const total = summary.topExpenses.reduce((sum, expense) => sum + expense.percent, 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it('resultado zero quando sem receita e despesa', () => {
    const summary = buildExecutiveSummary(
      makeDRE({
        nodes: {
          s5: {
            id: 's5',
            code: 'S5',
            name: 'Lucro',
            type: 'tax',
            sign: 1,
            isSubtotal: true,
            sortOrder: 110,
            parentId: null,
            value: 0,
            rawValue: 0,
            children: []
          }
        },
        subtotals: { S1: 0, S5: 0 }
      })
    );

    expect(summary.result).toBe(0);
    expect(summary.margin).toBe(0);
  });
});
