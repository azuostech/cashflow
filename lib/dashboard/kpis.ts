import { ReconciliationStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { endOfMonth, startOfDay, startOfMonth, subDays, subMonths } from 'date-fns';
import { prisma } from '@/lib/prisma';

export interface BankBalance {
  accountId: string;
  accountName: string;
  currency: string;
  balance: number;
}

export interface DashboardKPIs {
  period: { start: Date; end: Date };
  currency: string;
  revenue: number;
  expenses: number;
  result: number;
  margin: number;
  bankBalances: BankBalance[];
  totalBalance: number;
  burnRateDaily: number;
  daysOfCash: number | null;
  pendingPayables: number;
  pendingReceivables: number;
  overduePayables: number;
  overdueReceivables: number;
  unreconciledCount: number;
  prevRevenue: number;
  prevExpenses: number;
  prevResult: number;
  revenueGrowth: number | null;
  expensesGrowth: number | null;
  topExpenses: { categoryName: string; value: number; percent: number }[];
}

function inPeriod(start: Date, end: Date) {
  return { gte: start, lte: end };
}

export function calculateMargin(result: number, revenue: number): number {
  return revenue !== 0 ? (result / revenue) * 100 : 0;
}

export function calculateGrowth(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function calculateDaysOfCash(totalBalance: number, burnRateDaily: number): number | null {
  if (burnRateDaily <= 0) return null;
  return Math.floor(totalBalance / burnRateDaily);
}

async function calculateBurnRate(companyId: string): Promise<number> {
  const thirtyDaysAgo = subDays(new Date(), 30);
  const result = await prisma.transaction.aggregate({
    where: {
      companyId,
      type: TransactionType.expense,
      status: TransactionStatus.paid,
      paymentDate: { gte: thirtyDaysAgo },
      deletedAt: null
    },
    _sum: { convertedAmount: true }
  });

  return Number(result._sum.convertedAmount ?? 0) / 30;
}

async function calculateBankBalances(companyId: string): Promise<BankBalance[]> {
  const accounts = await prisma.bankAccount.findMany({
    where: { companyId, active: true, includeInConsolidatedCashflow: true },
    select: { id: true, name: true, currency: true, initialBalance: true }
  });

  return Promise.all(
    accounts.map(async (account) => {
      const [received, paid] = await Promise.all([
        prisma.transaction.aggregate({
          where: {
            companyId,
            bankAccountId: account.id,
            type: TransactionType.revenue,
            status: TransactionStatus.received,
            deletedAt: null
          },
          _sum: { convertedAmount: true }
        }),
        prisma.transaction.aggregate({
          where: {
            companyId,
            bankAccountId: account.id,
            type: TransactionType.expense,
            status: TransactionStatus.paid,
            deletedAt: null
          },
          _sum: { convertedAmount: true }
        })
      ]);

      return {
        accountId: account.id,
        accountName: account.name,
        currency: account.currency,
        balance:
          Number(account.initialBalance) +
          Number(received._sum.convertedAmount ?? 0) -
          Number(paid._sum.convertedAmount ?? 0)
      };
    })
  );
}

export async function getDashboardKPIs(companyId: string, start: Date, end: Date): Promise<DashboardKPIs> {
  const today = startOfDay(new Date());
  const prevStart = startOfMonth(subMonths(start, 1));
  const prevEnd = endOfMonth(subMonths(end, 1));

  const [
    revenueAgg,
    expensesAgg,
    prevRevenueAgg,
    prevExpensesAgg,
    pendingPayables,
    pendingReceivables,
    overduePayables,
    overdueReceivables,
    unreconciledCount,
    bankBalances,
    burnRateDaily,
    topExpensesRaw,
    company
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        companyId,
        type: TransactionType.revenue,
        competenceDate: inPeriod(start, end),
        status: { not: TransactionStatus.cancelled },
        deletedAt: null
      },
      _sum: { convertedAmount: true }
    }),
    prisma.transaction.aggregate({
      where: {
        companyId,
        type: TransactionType.expense,
        competenceDate: inPeriod(start, end),
        status: { not: TransactionStatus.cancelled },
        deletedAt: null
      },
      _sum: { convertedAmount: true }
    }),
    prisma.transaction.aggregate({
      where: {
        companyId,
        type: TransactionType.revenue,
        competenceDate: inPeriod(prevStart, prevEnd),
        status: { not: TransactionStatus.cancelled },
        deletedAt: null
      },
      _sum: { convertedAmount: true }
    }),
    prisma.transaction.aggregate({
      where: {
        companyId,
        type: TransactionType.expense,
        competenceDate: inPeriod(prevStart, prevEnd),
        status: { not: TransactionStatus.cancelled },
        deletedAt: null
      },
      _sum: { convertedAmount: true }
    }),
    prisma.transaction.count({
      where: { companyId, type: TransactionType.expense, status: TransactionStatus.pending, deletedAt: null }
    }),
    prisma.transaction.count({
      where: { companyId, type: TransactionType.revenue, status: TransactionStatus.pending, deletedAt: null }
    }),
    prisma.transaction.count({
      where: {
        companyId,
        type: TransactionType.expense,
        status: TransactionStatus.pending,
        dueDate: { lt: today },
        deletedAt: null
      }
    }),
    prisma.transaction.count({
      where: {
        companyId,
        type: TransactionType.revenue,
        status: TransactionStatus.pending,
        dueDate: { lt: today },
        deletedAt: null
      }
    }),
    prisma.bankMove.count({ where: { companyId, reconciliationStatus: ReconciliationStatus.unreconciled } }),
    calculateBankBalances(companyId),
    calculateBurnRate(companyId),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        companyId,
        type: TransactionType.expense,
        competenceDate: inPeriod(start, end),
        status: { not: TransactionStatus.cancelled },
        categoryId: { not: null },
        deletedAt: null
      },
      _sum: { convertedAmount: true },
      orderBy: { _sum: { convertedAmount: 'desc' } },
      take: 5
    }),
    prisma.company.findUnique({ where: { id: companyId }, select: { baseCurrency: true } })
  ]);

  const categoryIds = topExpensesRaw
    .map((row) => row.categoryId)
    .filter((categoryId): categoryId is string => Boolean(categoryId));
  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true }
      })
    : [];
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
  const topExpensesTotal = topExpensesRaw.reduce((sum, row) => sum + Number(row._sum.convertedAmount ?? 0), 0);
  const topExpenses = topExpensesRaw.map((row) => {
    const value = Number(row._sum.convertedAmount ?? 0);

    return {
      categoryName: row.categoryId ? categoryMap.get(row.categoryId) ?? 'Categoria' : 'Categoria',
      value,
      percent: topExpensesTotal > 0 ? (value / topExpensesTotal) * 100 : 0
    };
  });

  const revenue = Number(revenueAgg._sum.convertedAmount ?? 0);
  const expenses = Number(expensesAgg._sum.convertedAmount ?? 0);
  const result = revenue - expenses;
  const prevRevenue = Number(prevRevenueAgg._sum.convertedAmount ?? 0);
  const prevExpenses = Number(prevExpensesAgg._sum.convertedAmount ?? 0);
  const prevResult = prevRevenue - prevExpenses;
  const totalBalance = bankBalances.reduce((sum, balance) => sum + balance.balance, 0);

  return {
    period: { start, end },
    currency: company?.baseCurrency ?? 'BRL',
    revenue,
    expenses,
    result,
    margin: calculateMargin(result, revenue),
    bankBalances,
    totalBalance,
    burnRateDaily,
    daysOfCash: calculateDaysOfCash(totalBalance, burnRateDaily),
    pendingPayables,
    pendingReceivables,
    overduePayables,
    overdueReceivables,
    unreconciledCount,
    prevRevenue,
    prevExpenses,
    prevResult,
    revenueGrowth: calculateGrowth(revenue, prevRevenue),
    expensesGrowth: calculateGrowth(expenses, prevExpenses),
    topExpenses
  };
}
