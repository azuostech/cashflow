import { prisma } from '@/lib/prisma';

export interface DRECategoryResult {
  id: string;
  name: string;
  color: string | null;
  value: number;
}

export interface DRENodeResult {
  id: string;
  code: string;
  name: string;
  type: string;
  sign: number;
  isSubtotal: boolean;
  sortOrder: number;
  parentId: string | null;
  value: number;
  rawValue: number;
  children: DRENodeResult[];
  categories?: DRECategoryResult[];
}

export interface DREResult {
  nodes: Record<string, DRENodeResult>;
  subtotals: Record<string, number>;
  tree: DRENodeResult[];
  period: { start: Date; end: Date };
  currency: string;
}

export interface ExecutiveSummary {
  received: number;
  spent: number;
  result: number;
  margin: number;
  topExpenses: { categoryName: string; value: number; percent: number }[];
}

export async function calculateDRE(
  companyId: string,
  startDate: Date,
  endDate: Date,
  costCenterId?: string
): Promise<DREResult> {
  const nodes = await prisma.dRENode.findMany({
    where: {
      OR: [{ isGlobal: true }, { companyId }],
      active: true
    },
    include: {
      categories: {
        where: { companyId, active: true, deprecatedAt: null },
        select: { id: true, name: true, color: true }
      }
    },
    orderBy: { sortOrder: 'asc' }
  });

  const nodeValues: Record<string, number> = {};
  const nodeCategoryBreakdown: Record<string, DRECategoryResult[]> = {};

  for (const node of nodes.filter((item) => !item.isSubtotal)) {
    const categoryIds = node.categories.map((category) => category.id);

    if (categoryIds.length === 0) {
      nodeValues[node.code] = 0;
      nodeCategoryBreakdown[node.code] = [];
      continue;
    }

    const byCategory = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        companyId,
        categoryId: { in: categoryIds },
        competenceDate: { gte: startDate, lte: endDate },
        status: { not: 'cancelled' },
        deletedAt: null,
        ...(costCenterId ? { costCenterId } : {})
      },
      _sum: { convertedAmount: true }
    });

    const rawTotal = byCategory.reduce((sum, row) => sum + Number(row._sum.convertedAmount ?? 0), 0);
    nodeValues[node.code] = rawTotal * node.sign;
    nodeCategoryBreakdown[node.code] = byCategory
      .map((row) => {
        const category = node.categories.find((item) => item.id === row.categoryId);

        return {
          id: row.categoryId ?? '',
          name: category?.name ?? 'Categoria',
          color: category?.color ?? null,
          value: Number(row._sum.convertedAmount ?? 0) * node.sign
        };
      })
      .filter((category) => category.id);
  }

  const subtotals: Record<string, number> = {};
  for (const node of nodes.filter((item) => item.isSubtotal)) {
    const accumulated = nodes
      .filter((item) => !item.isSubtotal && item.sortOrder < node.sortOrder)
      .reduce((sum, item) => sum + (nodeValues[item.code] ?? 0), 0);

    subtotals[node.code] = accumulated;
    nodeValues[node.code] = accumulated;
  }

  const nodeById: Record<string, DRENodeResult> = {};
  const nodeByCode: Record<string, DRENodeResult> = {};

  for (const node of nodes) {
    const value = nodeValues[node.code] ?? 0;
    const result: DRENodeResult = {
      id: node.id,
      code: node.code,
      name: node.name,
      type: node.type,
      sign: node.sign,
      isSubtotal: node.isSubtotal,
      sortOrder: node.sortOrder,
      parentId: node.parentId,
      value,
      rawValue: Math.abs(value),
      children: [],
      categories: nodeCategoryBreakdown[node.code] ?? []
    };

    nodeById[node.id] = result;
    nodeByCode[node.code] = result;
  }

  const rootNodes: DRENodeResult[] = [];
  for (const node of nodes) {
    const current = nodeById[node.id];

    if (node.parentId && nodeById[node.parentId]) {
      nodeById[node.parentId].children.push(current);
    } else {
      rootNodes.push(current);
    }
  }

  function sortTree(items: DRENodeResult[]) {
    items.sort((a, b) => a.sortOrder - b.sortOrder);
    items.forEach((item) => sortTree(item.children));
  }
  sortTree(rootNodes);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { baseCurrency: true }
  });

  return {
    nodes: nodeByCode,
    subtotals,
    tree: rootNodes,
    period: { start: startDate, end: endDate },
    currency: company?.baseCurrency ?? 'BRL'
  };
}

export function buildExecutiveSummary(dre: DREResult): ExecutiveSummary {
  const received =
    Object.values(dre.nodes).find((node) => node.code === 'S1')?.value ??
    Object.values(dre.nodes).find((node) => node.code === '1.0')?.value ??
    0;
  const result = dre.subtotals.S5 ?? 0;
  const variableCosts = Math.abs(Object.values(dre.nodes).find((node) => node.code === '3.0')?.value ?? 0);
  const fixedCosts = Math.abs(Object.values(dre.nodes).find((node) => node.code === '4.0')?.value ?? 0);
  const spent = variableCosts + fixedCosts;
  const margin = received !== 0 ? (result / Math.abs(received)) * 100 : 0;

  const allExpenseCategories: { categoryName: string; value: number }[] = [];
  for (const node of Object.values(dre.nodes)) {
    if (node.value < 0 && node.categories) {
      for (const category of node.categories) {
        if (category.value < 0) {
          allExpenseCategories.push({
            categoryName: category.name,
            value: Math.abs(category.value)
          });
        }
      }
    }
  }

  const totalSpent = allExpenseCategories.reduce((sum, category) => sum + category.value, 0);
  const topExpenses = allExpenseCategories
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((category) => ({
      ...category,
      percent: totalSpent > 0 ? (category.value / totalSpent) * 100 : 0
    }));

  return { received, spent, result, margin, topExpenses };
}
