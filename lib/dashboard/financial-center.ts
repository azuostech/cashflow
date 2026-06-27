import { Prisma, ReconciliationStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { prisma } from '@/lib/prisma';

export interface FinancialCenterItem {
  type:
    | 'overdue_payable'
    | 'overdue_receivable'
    | 'due_today_payable'
    | 'due_today_receivable'
    | 'unreconciled'
    | 'expected_today';
  urgency: 'critical' | 'warning' | 'info' | 'positive';
  id: string;
  description: string;
  amount: number;
  currency: string;
  dueDate: string | null;
  daysOverdue: number | null;
  category: string | null;
  contact: string | null;
  accountName: string | null;
}

export interface FinancialCenterSummary {
  items: FinancialCenterItem[];
  counts: {
    overduePayables: number;
    overdueReceivables: number;
    dueTodayPayables: number;
    dueTodayReceivables: number;
    unreconciled: number;
  };
  currency: string;
  totalOverduePayable: number;
  totalOverdueReceivable: number;
  totalDueTodayPayable: number;
  totalDueTodayReceivable: number;
}

const URGENCY_ORDER: Record<FinancialCenterItem['urgency'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3
};

const transactionInclude = {
  category: { select: { name: true } },
  contact: { select: { name: true } },
  bankAccount: { select: { name: true, currency: true } }
} satisfies Prisma.TransactionInclude;

type FinancialTransaction = Prisma.TransactionGetPayload<{ include: typeof transactionInclude }>;

export function sortFinancialCenterItems<T extends { urgency: FinancialCenterItem['urgency']; daysOverdue: number | null }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const urgencyDiff = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    return (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0);
  });
}

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function toItem(
  tx: FinancialTransaction,
  type: FinancialCenterItem['type'],
  urgency: FinancialCenterItem['urgency'],
  today: Date
): FinancialCenterItem {
  const daysOverdue = tx.dueDate < today ? differenceInCalendarDays(today, tx.dueDate) : 0;

  return {
    type,
    urgency,
    id: tx.id,
    description: tx.description,
    amount: Number(tx.originalAmount),
    currency: tx.originalCurrency,
    dueDate: tx.dueDate ? toDateKey(tx.dueDate) : null,
    daysOverdue,
    category: tx.category?.name ?? null,
    contact: tx.contact?.name ?? null,
    accountName: tx.bankAccount?.name ?? null
  };
}

export async function getFinancialCenterSummary(companyId: string): Promise<FinancialCenterSummary> {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  const [overduePayables, overdueReceivables, dueTodayPayables, dueTodayReceivables, unreconciled, company] =
    await Promise.all([
      prisma.transaction.findMany({
        where: {
          companyId,
          type: TransactionType.expense,
          status: TransactionStatus.pending,
          dueDate: { lt: today },
          deletedAt: null
        },
        include: transactionInclude,
        orderBy: { dueDate: 'asc' },
        take: 20
      }),
      prisma.transaction.findMany({
        where: {
          companyId,
          type: TransactionType.revenue,
          status: TransactionStatus.pending,
          dueDate: { lt: today },
          deletedAt: null
        },
        include: transactionInclude,
        orderBy: { dueDate: 'asc' },
        take: 10
      }),
      prisma.transaction.findMany({
        where: {
          companyId,
          type: TransactionType.expense,
          status: TransactionStatus.pending,
          dueDate: { gte: today, lt: tomorrow },
          deletedAt: null
        },
        include: transactionInclude,
        orderBy: { originalAmount: 'desc' },
        take: 10
      }),
      prisma.transaction.findMany({
        where: {
          companyId,
          type: TransactionType.revenue,
          status: TransactionStatus.pending,
          dueDate: { gte: today, lt: tomorrow },
          deletedAt: null
        },
        include: transactionInclude,
        orderBy: { originalAmount: 'desc' },
        take: 10
      }),
      prisma.bankMove.count({
        where: { companyId, reconciliationStatus: ReconciliationStatus.unreconciled }
      }),
      prisma.company.findUnique({ where: { id: companyId }, select: { baseCurrency: true } })
    ]);

  const items = sortFinancialCenterItems([
    ...overduePayables.map((tx) => toItem(tx, 'overdue_payable', 'critical', today)),
    ...overdueReceivables.map((tx) => toItem(tx, 'overdue_receivable', 'warning', today)),
    ...dueTodayPayables.map((tx) => toItem(tx, 'due_today_payable', 'warning', today)),
    ...dueTodayReceivables.map((tx) => toItem(tx, 'due_today_receivable', 'positive', today))
  ]);

  return {
    items,
    counts: {
      overduePayables: overduePayables.length,
      overdueReceivables: overdueReceivables.length,
      dueTodayPayables: dueTodayPayables.length,
      dueTodayReceivables: dueTodayReceivables.length,
      unreconciled
    },
    currency: company?.baseCurrency ?? 'BRL',
    totalOverduePayable: overduePayables.reduce((sum, tx) => sum + Number(tx.convertedAmount), 0),
    totalOverdueReceivable: overdueReceivables.reduce((sum, tx) => sum + Number(tx.convertedAmount), 0),
    totalDueTodayPayable: dueTodayPayables.reduce((sum, tx) => sum + Number(tx.convertedAmount), 0),
    totalDueTodayReceivable: dueTodayReceivables.reduce((sum, tx) => sum + Number(tx.convertedAmount), 0)
  };
}
