import { AccountingPeriodStatus, Prisma, ReconciliationStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { subMonths } from 'date-fns';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildExecutiveSummary, calculateDRE, type DREResult, type ExecutiveSummary } from '@/lib/reports/dre';
import { calculateCashflow } from '@/lib/reports/cashflow';
import { createAuditLog } from '@/lib/utils/audit';

export interface PeriodDates {
  start: Date;
  end: Date;
  year: number;
  month: number;
}

export interface MonthHighlight {
  type: 'top_expense' | 'revenue_growth' | 'expense_growth' | 'outlier' | 'cash_low';
  label: string;
  value: number | null;
  percent: number | null;
}

export interface PreCloseSummary {
  period: PeriodDates;
  dre: object;
  dreExecutive: ExecutiveSummary;
  prevDre: object | null;
  prevDreExecutive: ExecutiveSummary | null;
  unreconciledMoves: number;
  incompleteTransactions: number;
  pendingTransactions: number;
  highlights: MonthHighlight[];
  canClose: boolean;
  warnings: string[];
}

export type PeriodStatus = 'open' | 'closed' | 'locked';

export function getPeriodDates(year: number, month: number): PeriodDates {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  return { start, end, year, month };
}

export function isValidPeriod(year: number, month: number): boolean {
  return Number.isInteger(year) && Number.isInteger(month) && year >= 1900 && year <= 2200 && month >= 1 && month <= 12;
}

export function formatPeriodEntity(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

async function getOrCreatePeriod(companyId: string, year: number, month: number) {
  const { start, end } = getPeriodDates(year, month);

  return prisma.accountingPeriod.upsert({
    where: { companyId_year_month: { companyId, year, month } },
    create: {
      companyId,
      year,
      month,
      periodStart: start,
      periodEnd: end,
      status: AccountingPeriodStatus.open
    },
    update: {}
  });
}

function createDreSnapshot(dre: DREResult): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify({
    tree: dre.tree,
    subtotals: dre.subtotals,
    executive: buildExecutiveSummary(dre),
    currency: dre.currency,
    period: {
      start: dre.period.start.toISOString(),
      end: dre.period.end.toISOString()
    }
  })) as Prisma.InputJsonValue;
}

async function createCashflowSnapshot(companyId: string, start: Date, end: Date): Promise<Prisma.InputJsonValue> {
  const cashflow = await calculateCashflow(companyId, start, end);

  return JSON.parse(JSON.stringify({
    openingBalance: cashflow.openingBalance,
    closingBalance: cashflow.closingBalance,
    projectedClosing: cashflow.projectedClosing,
    totalInflow: cashflow.totalInflow,
    totalOutflow: cashflow.totalOutflow,
    totalInflowPending: cashflow.totalInflowPending,
    totalOutflowPending: cashflow.totalOutflowPending,
    minBalance: cashflow.minBalance,
    minBalanceDate: cashflow.minBalanceDate,
    daysOfCash: cashflow.daysOfCash,
    currency: cashflow.currency
  })) as Prisma.InputJsonValue;
}

export async function getPreCloseSummary(companyId: string, year: number, month: number): Promise<PreCloseSummary> {
  const { start, end } = getPeriodDates(year, month);
  const prevDate = subMonths(start, 1);
  const prevDates = getPeriodDates(prevDate.getUTCFullYear(), prevDate.getUTCMonth() + 1);

  const [period, dre, prevDre, unreconciledMoves, incompleteTransactions, pendingTransactions] = await Promise.all([
    getOrCreatePeriod(companyId, year, month),
    calculateDRE(companyId, start, end),
    calculateDRE(companyId, prevDates.start, prevDates.end),
    prisma.bankMove.count({
      where: {
        companyId,
        reconciliationStatus: ReconciliationStatus.unreconciled,
        date: { gte: start, lte: end }
      }
    }),
    prisma.transaction.count({
      where: {
        companyId,
        categoryId: null,
        competenceDate: { gte: start, lte: end },
        type: { in: [TransactionType.revenue, TransactionType.expense] },
        status: { not: TransactionStatus.cancelled },
        deletedAt: null
      }
    }),
    prisma.transaction.count({
      where: {
        companyId,
        status: TransactionStatus.pending,
        dueDate: { lte: end },
        deletedAt: null
      }
    })
  ]);

  const dreExecutive = buildExecutiveSummary(dre);
  const prevDreExecutive = buildExecutiveSummary(prevDre);
  const highlights: MonthHighlight[] = [];

  const topExpense = dreExecutive.topExpenses[0];
  if (topExpense) {
    highlights.push({
      type: 'top_expense',
      label: `Maior despesa: ${topExpense.categoryName}`,
      value: topExpense.value,
      percent: topExpense.percent
    });
  }

  if (prevDreExecutive.received !== 0) {
    const growth = ((dreExecutive.received - prevDreExecutive.received) / Math.abs(prevDreExecutive.received)) * 100;
    highlights.push({
      type: 'revenue_growth',
      label: growth >= 0 ? 'Receita cresceu vs mes anterior' : 'Receita recuou vs mes anterior',
      value: dreExecutive.received,
      percent: growth
    });
  }

  if (prevDreExecutive.spent !== 0) {
    const growth = ((dreExecutive.spent - prevDreExecutive.spent) / Math.abs(prevDreExecutive.spent)) * 100;
    if (Math.abs(growth) > 20) {
      highlights.push({
        type: 'expense_growth',
        label:
          growth > 0
            ? `Despesas subiram ${growth.toFixed(0)}% vs mes anterior`
            : `Despesas cairam ${Math.abs(growth).toFixed(0)}% vs mes anterior`,
        value: dreExecutive.spent,
        percent: growth
      });
    }
  }

  const warnings: string[] = [];
  if (unreconciledMoves > 0) warnings.push(`${unreconciledMoves} movimentos bancarios nao conciliados no periodo`);
  if (incompleteTransactions > 0) warnings.push(`${incompleteTransactions} lancamentos sem categoria`);
  if (pendingTransactions > 0) warnings.push(`${pendingTransactions} lancamentos pendentes ate o fim do periodo`);

  return {
    period: { start, end, year, month },
    dre: dre.tree,
    dreExecutive,
    prevDre: prevDre.tree,
    prevDreExecutive,
    unreconciledMoves,
    incompleteTransactions,
    pendingTransactions,
    highlights,
    canClose: period.status === AccountingPeriodStatus.open,
    warnings
  };
}

export async function closePeriod(
  companyId: string,
  year: number,
  month: number,
  userId: string,
  notes?: string,
  request?: NextRequest
): Promise<void> {
  const { start, end } = getPeriodDates(year, month);
  const existing = await prisma.accountingPeriod.findUnique({
    where: { companyId_year_month: { companyId, year, month } }
  });

  if (existing?.status === AccountingPeriodStatus.closed || existing?.status === AccountingPeriodStatus.locked) {
    throw new Error('Periodo ja esta fechado ou bloqueado');
  }

  const [dre, cashflowSnapshot] = await Promise.all([calculateDRE(companyId, start, end), createCashflowSnapshot(companyId, start, end)]);
  const dreSnapshot = createDreSnapshot(dre);

  const period = await prisma.accountingPeriod.upsert({
    where: { companyId_year_month: { companyId, year, month } },
    create: {
      companyId,
      year,
      month,
      periodStart: start,
      periodEnd: end,
      status: AccountingPeriodStatus.closed,
      closedById: userId,
      closedAt: new Date(),
      dreSnapshot,
      cashflowSnapshot,
      notes: notes ?? null
    },
    update: {
      status: AccountingPeriodStatus.closed,
      closedById: userId,
      closedAt: new Date(),
      dreSnapshot,
      cashflowSnapshot,
      notes: notes ?? null
    }
  });

  await createAuditLog({
    companyId,
    userId,
    action: 'period_close',
    entityType: 'accounting_period',
    entityId: period.id,
    beforeData: existing ? { status: existing.status, period: formatPeriodEntity(year, month) } : null,
    afterData: { year, month, status: AccountingPeriodStatus.closed },
    request
  });
}

export async function reopenPeriod(
  companyId: string,
  year: number,
  month: number,
  userId: string,
  justification: string,
  request?: NextRequest
): Promise<void> {
  const period = await prisma.accountingPeriod.findUnique({
    where: { companyId_year_month: { companyId, year, month } }
  });

  if (!period) throw new Error('Periodo nao encontrado');
  if (period.status === AccountingPeriodStatus.locked) throw new Error('Periodo bloqueado. Apenas o owner pode desbloquear.');
  if (period.status === AccountingPeriodStatus.open) throw new Error('Periodo ja esta aberto');

  const updated = await prisma.accountingPeriod.update({
    where: { companyId_year_month: { companyId, year, month } },
    data: {
      status: AccountingPeriodStatus.open,
      reopenedById: userId,
      reopenedAt: new Date(),
      reopenReason: justification
    }
  });

  await createAuditLog({
    companyId,
    userId,
    action: 'period_reopen',
    entityType: 'accounting_period',
    entityId: updated.id,
    beforeData: { status: period.status, period: formatPeriodEntity(year, month) },
    afterData: { year, month, status: AccountingPeriodStatus.open },
    justification,
    request
  });
}

export async function lockPeriod(
  companyId: string,
  year: number,
  month: number,
  userId: string,
  request?: NextRequest
): Promise<void> {
  const period = await prisma.accountingPeriod.findUnique({
    where: { companyId_year_month: { companyId, year, month } }
  });

  if (!period || period.status === AccountingPeriodStatus.open) {
    throw new Error('Periodo deve estar fechado antes de ser bloqueado');
  }
  if (period.status === AccountingPeriodStatus.locked) throw new Error('Periodo ja esta bloqueado');

  const updated = await prisma.accountingPeriod.update({
    where: { companyId_year_month: { companyId, year, month } },
    data: { status: AccountingPeriodStatus.locked }
  });

  await createAuditLog({
    companyId,
    userId,
    action: 'period_lock',
    entityType: 'accounting_period',
    entityId: updated.id,
    beforeData: { status: period.status, period: formatPeriodEntity(year, month) },
    afterData: { year, month, status: AccountingPeriodStatus.locked },
    request
  });
}

export async function unlockPeriod(
  companyId: string,
  year: number,
  month: number,
  userId: string,
  justification: string,
  request?: NextRequest
): Promise<void> {
  const period = await prisma.accountingPeriod.findUnique({
    where: { companyId_year_month: { companyId, year, month } }
  });

  if (!period || period.status !== AccountingPeriodStatus.locked) {
    throw new Error('Periodo nao esta bloqueado');
  }

  const updated = await prisma.accountingPeriod.update({
    where: { companyId_year_month: { companyId, year, month } },
    data: {
      status: AccountingPeriodStatus.closed,
      reopenedById: userId,
      reopenedAt: new Date(),
      reopenReason: justification
    }
  });

  await createAuditLog({
    companyId,
    userId,
    action: 'period_unlock',
    entityType: 'accounting_period',
    entityId: updated.id,
    beforeData: { status: period.status, period: formatPeriodEntity(year, month) },
    afterData: { year, month, status: AccountingPeriodStatus.closed },
    justification,
    request
  });
}
