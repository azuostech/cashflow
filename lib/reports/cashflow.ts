import { TransactionStatus, TransactionType } from '@prisma/client';
import { eachDayOfInterval, format } from 'date-fns';
import { prisma } from '@/lib/prisma';

export interface CashflowEntry {
  date: string;
  label: string;
  inflow: number;
  outflow: number;
  netRealized: number;
  inflowPending: number;
  outflowPending: number;
  netPending: number;
  cumulativeBalance: number;
  isRisk: boolean;
}

export interface CashflowResult {
  entries: CashflowEntry[];
  openingBalance: number;
  closingBalance: number;
  projectedClosing: number;
  totalInflow: number;
  totalOutflow: number;
  totalInflowPending: number;
  totalOutflowPending: number;
  minBalance: number;
  minBalanceDate: string | null;
  daysOfCash: number | null;
  currency: string;
}

export async function calculateOpeningBalance(companyId: string, startDate: Date, bankAccountId?: string): Promise<number> {
  const accounts = await prisma.bankAccount.findMany({
    where: {
      companyId,
      active: true,
      includeInConsolidatedCashflow: true,
      ...(bankAccountId ? { id: bankAccountId } : {})
    },
    select: { id: true, initialBalance: true }
  });

  const accountIds = accounts.map((account) => account.id);
  const accountFilter = bankAccountId ? { bankAccountId } : { bankAccountId: { in: accountIds } };
  const [revenueBefore, expenseBefore] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        companyId,
        type: TransactionType.revenue,
        ...accountFilter,
        paymentDate: { lt: startDate },
        status: TransactionStatus.received,
        deletedAt: null
      },
      _sum: { convertedAmount: true }
    }),
    prisma.transaction.aggregate({
      where: {
        companyId,
        type: TransactionType.expense,
        ...accountFilter,
        paymentDate: { lt: startDate },
        status: TransactionStatus.paid,
        deletedAt: null
      },
      _sum: { convertedAmount: true }
    })
  ]);

  const initialBalances = accounts.reduce((sum, account) => sum + Number(account.initialBalance), 0);

  return initialBalances + Number(revenueBefore._sum.convertedAmount ?? 0) - Number(expenseBefore._sum.convertedAmount ?? 0);
}

function dateKey(date: Date | null): string | null {
  return date ? format(date, 'yyyy-MM-dd') : null;
}

export async function calculateCashflow(
  companyId: string,
  startDate: Date,
  endDate: Date,
  bankAccountId?: string,
  riskThreshold = 0
): Promise<CashflowResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { baseCurrency: true }
  });

  const accounts = await prisma.bankAccount.findMany({
    where: {
      companyId,
      active: true,
      includeInConsolidatedCashflow: true,
      ...(bankAccountId ? { id: bankAccountId } : {})
    },
    select: { id: true }
  });
  const accountIds = accounts.map((account) => account.id);

  const realizedAccountFilter = bankAccountId ? { bankAccountId } : { bankAccountId: { in: accountIds } };
  const pendingAccountFilter = bankAccountId ? { bankAccountId } : {};

  const [realizedRevenue, realizedExpense, pendingRevenue, pendingExpense, pendingInstallments] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        companyId,
        type: TransactionType.revenue,
        status: TransactionStatus.received,
        ...realizedAccountFilter,
        paymentDate: { gte: startDate, lte: endDate },
        deletedAt: null
      },
      select: { paymentDate: true, convertedAmount: true }
    }),
    prisma.transaction.findMany({
      where: {
        companyId,
        type: TransactionType.expense,
        status: TransactionStatus.paid,
        ...realizedAccountFilter,
        paymentDate: { gte: startDate, lte: endDate },
        deletedAt: null
      },
      select: { paymentDate: true, convertedAmount: true }
    }),
    prisma.transaction.findMany({
      where: {
        companyId,
        type: TransactionType.revenue,
        status: TransactionStatus.pending,
        ...pendingAccountFilter,
        dueDate: { gte: startDate, lte: endDate },
        deletedAt: null
      },
      select: { dueDate: true, convertedAmount: true }
    }),
    prisma.transaction.findMany({
      where: {
        companyId,
        type: TransactionType.expense,
        status: TransactionStatus.pending,
        ...pendingAccountFilter,
        dueDate: { gte: startDate, lte: endDate },
        deletedAt: null
      },
      select: { dueDate: true, convertedAmount: true }
    }),
    prisma.installment.findMany({
      where: {
        companyId,
        status: TransactionStatus.pending,
        ...pendingAccountFilter,
        dueDate: { gte: startDate, lte: endDate },
        transaction: { deletedAt: null }
      },
      select: {
        dueDate: true,
        convertedAmount: true,
        transaction: { select: { type: true } }
      }
    })
  ]);

  const byDay: Record<string, { inR: number; outR: number; inP: number; outP: number }> = {};
  function ensureDay(key: string) {
    byDay[key] ??= { inR: 0, outR: 0, inP: 0, outP: 0 };
  }

  for (const transaction of realizedRevenue) {
    const key = dateKey(transaction.paymentDate);
    if (!key) continue;
    ensureDay(key);
    byDay[key].inR += Number(transaction.convertedAmount);
  }
  for (const transaction of realizedExpense) {
    const key = dateKey(transaction.paymentDate);
    if (!key) continue;
    ensureDay(key);
    byDay[key].outR += Number(transaction.convertedAmount);
  }
  for (const transaction of pendingRevenue) {
    const key = dateKey(transaction.dueDate);
    if (!key) continue;
    ensureDay(key);
    byDay[key].inP += Number(transaction.convertedAmount);
  }
  for (const transaction of pendingExpense) {
    const key = dateKey(transaction.dueDate);
    if (!key) continue;
    ensureDay(key);
    byDay[key].outP += Number(transaction.convertedAmount);
  }
  for (const installment of pendingInstallments) {
    const key = dateKey(installment.dueDate);
    if (!key) continue;
    ensureDay(key);
    if (installment.transaction.type === TransactionType.revenue) {
      byDay[key].inP += Number(installment.convertedAmount);
    } else {
      byDay[key].outP += Number(installment.convertedAmount);
    }
  }

  const openingBalance = await calculateOpeningBalance(companyId, startDate, bankAccountId);
  const entries: CashflowEntry[] = [];
  let cumulative = openingBalance;
  let minBalance = cumulative;
  let minBalanceDate: string | null = null;
  let totalInflow = 0;
  let totalOutflow = 0;
  let totalInflowPending = 0;
  let totalOutflowPending = 0;

  for (const day of eachDayOfInterval({ start: startDate, end: endDate })) {
    const key = format(day, 'yyyy-MM-dd');
    const values = byDay[key] ?? { inR: 0, outR: 0, inP: 0, outP: 0 };
    const netRealized = values.inR - values.outR;
    const netPending = values.inP - values.outP;

    cumulative += netRealized + netPending;
    totalInflow += values.inR;
    totalOutflow += values.outR;
    totalInflowPending += values.inP;
    totalOutflowPending += values.outP;

    if (cumulative < minBalance) {
      minBalance = cumulative;
      minBalanceDate = key;
    }

    entries.push({
      date: key,
      label: format(day, 'dd/MM'),
      inflow: values.inR,
      outflow: values.outR,
      netRealized,
      inflowPending: values.inP,
      outflowPending: values.outP,
      netPending,
      cumulativeBalance: cumulative,
      isRisk: cumulative <= riskThreshold
    });
  }

  const thirtyDaysAgo = new Date(startDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const burnResult = await prisma.transaction.aggregate({
    where: {
      companyId,
      type: TransactionType.expense,
      status: TransactionStatus.paid,
      ...realizedAccountFilter,
      paymentDate: { gte: thirtyDaysAgo, lt: startDate },
      deletedAt: null
    },
    _sum: { convertedAmount: true }
  });

  const burnRateDaily = Number(burnResult._sum.convertedAmount ?? 0) / 30;
  const closingBalance = openingBalance + totalInflow - totalOutflow;
  const daysOfCash = burnRateDaily > 0 ? Math.floor(closingBalance / burnRateDaily) : null;

  return {
    entries,
    openingBalance,
    closingBalance,
    projectedClosing: cumulative,
    totalInflow,
    totalOutflow,
    totalInflowPending,
    totalOutflowPending,
    minBalance,
    minBalanceDate,
    daysOfCash,
    currency: company?.baseCurrency ?? 'BRL'
  };
}
