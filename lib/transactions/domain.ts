import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  endOfMonth,
  getDate,
  isAfter,
  setDate
} from 'date-fns';
import {
  ApprovalStatus,
  Prisma,
  ReconciliationStatus,
  TransactionStatus,
  TransactionType
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type InstallmentData = Prisma.InstallmentCreateManyInput;

export function distributeAmount(total: number, count: number): number[] {
  const base = Math.floor((total * 100) / count) / 100;
  const remainder = Math.round((total - base * count) * 100) / 100;

  return Array.from({ length: count }, (_, index) =>
    index === 0 ? Math.round((base + remainder) * 100) / 100 : base
  );
}

export async function createInstallments(
  transactionId: string,
  companyId: string,
  originalAmount: number,
  originalCurrency: string,
  convertedAmount: number,
  companyCurrency: string,
  exchangeRate: number,
  competenceDate: Date,
  firstDueDate: Date,
  installmentCount: number,
  categoryId: string | null,
  costCenterId: string | null
): Promise<InstallmentData[]> {
  const originalAmounts = distributeAmount(originalAmount, installmentCount);
  const convertedAmounts = distributeAmount(convertedAmount, installmentCount);

  const installments: InstallmentData[] = originalAmounts.map((amount, index) => ({
    transactionId,
    companyId,
    number: index + 1,
    originalAmount: amount,
    originalCurrency,
    convertedAmount: convertedAmounts[index],
    companyCurrency,
    exchangeRate,
    competenceDate,
    dueDate: addMonths(firstDueDate, index),
    status: TransactionStatus.pending,
    reconciliationStatus: ReconciliationStatus.unreconciled,
    categoryId,
    costCenterId
  }));

  await prisma.installment.createMany({ data: installments });
  return installments;
}

export type RecurrenceFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual';

function addInterval(date: Date, frequency: RecurrenceFrequency, interval: number): Date {
  switch (frequency) {
    case 'daily':
      return addDays(date, interval);
    case 'weekly':
      return addWeeks(date, interval);
    case 'biweekly':
      return addWeeks(date, 2 * interval);
    case 'monthly':
      return addMonths(date, interval);
    case 'quarterly':
      return addQuarters(date, interval);
    case 'semiannual':
      return addMonths(date, 6 * interval);
    case 'annual':
      return addMonths(date, 12 * interval);
  }
}

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: Date;
  endDate?: Date | null;
  occurrencesLimit?: number | null;
  dayOfMonth?: number | null;
}

function applyDayOfMonth(date: Date, dayOfMonth: number): Date {
  const lastDay = getDate(endOfMonth(date));
  return setDate(date, Math.min(dayOfMonth, lastDay));
}

export function buildRecurrenceDates(config: RecurrenceConfig): Date[] {
  const horizon = addMonths(new Date(), 12);
  const dates: Date[] = [];
  let current = config.startDate;
  let count = 0;

  while (!isAfter(current, horizon)) {
    if (config.endDate && isAfter(current, config.endDate)) break;
    if (config.occurrencesLimit && count >= config.occurrencesLimit) break;

    const targetDay = config.dayOfMonth ?? getDate(config.startDate);
    dates.push(applyDayOfMonth(current, targetDay));

    current = addInterval(current, config.frequency, config.interval);
    count += 1;
  }

  return dates;
}

export async function generateRecurrenceOccurrences(
  ruleId: string,
  parentTransactionId: string,
  baseTransaction: Record<string, unknown>,
  config: RecurrenceConfig,
  createdById: string
): Promise<Prisma.TransactionCreateManyInput[]> {
  const dates = buildRecurrenceDates(config);
  const futureDates = dates.slice(1);
  if (futureDates.length === 0) return [];

  const occurrences: Prisma.TransactionCreateManyInput[] = futureDates.map((date) => ({
    companyId: baseTransaction.companyId as string,
    type: baseTransaction.type as TransactionType,
    description: baseTransaction.description as string,
    notes: (baseTransaction.notes as string | null | undefined) ?? null,
    originalAmount: baseTransaction.originalAmount as Prisma.Decimal | number,
    originalCurrency: baseTransaction.originalCurrency as string,
    convertedAmount: baseTransaction.convertedAmount as Prisma.Decimal | number,
    companyCurrency: baseTransaction.companyCurrency as string,
    exchangeRate: baseTransaction.exchangeRate as Prisma.Decimal | number,
    exchangeRateDate: (baseTransaction.exchangeRateDate as Date | null | undefined) ?? null,
    categoryId: (baseTransaction.categoryId as string | null | undefined) ?? null,
    costCenterId: (baseTransaction.costCenterId as string | null | undefined) ?? null,
    bankAccountId: (baseTransaction.bankAccountId as string | null | undefined) ?? null,
    destBankAccountId: (baseTransaction.destBankAccountId as string | null | undefined) ?? null,
    contactId: (baseTransaction.contactId as string | null | undefined) ?? null,
    competenceDate: date,
    dueDate: date,
    paymentDate: null,
    status: TransactionStatus.pending,
    reconciliationStatus: ReconciliationStatus.unreconciled,
    isReversal: false,
    hasCostCenterSplit: false,
    requiresApproval: false,
    approvalStatus: ApprovalStatus.not_required,
    origin: 'recurrence',
    recurrenceRuleId: ruleId,
    recurrenceParentId: parentTransactionId,
    isInstallment: false,
    aiSuggested: false,
    createdById
  }));

  await prisma.transaction.createMany({ data: occurrences });
  return occurrences;
}

export async function reverseTransaction(originalId: string, companyId: string, userId: string) {
  const original = await prisma.transaction.findFirst({
    where: { id: originalId, companyId, deletedAt: null }
  });

  if (!original) throw Object.assign(new Error('Lancamento nao encontrado'), { status: 404 });
  if (original.isReversal) throw Object.assign(new Error('Nao e possivel estornar um estorno'), { status: 409 });
  if (original.status === TransactionStatus.cancelled) {
    throw Object.assign(new Error('Lancamento cancelado nao pode ser estornado'), { status: 409 });
  }

  const reversalType =
    original.type === TransactionType.revenue
      ? TransactionType.expense
      : original.type === TransactionType.expense
        ? TransactionType.revenue
        : original.type;

  const today = new Date();

  return prisma.transaction.create({
    data: {
      companyId,
      type: reversalType,
      description: `Estorno: ${original.description}`,
      notes: original.notes ?? null,
      originalAmount: original.originalAmount,
      originalCurrency: original.originalCurrency,
      convertedAmount: original.convertedAmount,
      companyCurrency: original.companyCurrency,
      exchangeRate: original.exchangeRate,
      exchangeRateDate: original.exchangeRateDate ?? null,
      categoryId: original.categoryId ?? null,
      costCenterId: original.costCenterId ?? null,
      bankAccountId: original.bankAccountId ?? null,
      destBankAccountId: original.destBankAccountId ?? null,
      contactId: original.contactId ?? null,
      competenceDate: today,
      dueDate: today,
      paymentDate: null,
      status: TransactionStatus.pending,
      reconciliationStatus: ReconciliationStatus.unreconciled,
      isReversal: true,
      reversalOfId: originalId,
      hasCostCenterSplit: false,
      requiresApproval: false,
      approvalStatus: ApprovalStatus.not_required,
      origin: 'manual',
      isInstallment: false,
      aiSuggested: false,
      createdById: userId
    }
  });
}

export type UserRole = 'owner' | 'admin' | 'financial' | 'accountant' | 'viewer';

const ROLE_RANK: Record<UserRole, number> = {
  viewer: 0,
  accountant: 1,
  financial: 2,
  admin: 3,
  owner: 4
};

export async function guardPeriod(
  companyId: string,
  date: Date,
  userRole: UserRole,
  justification?: string | null
): Promise<{ retroactive: boolean }> {
  const period = await prisma.accountingPeriod.findFirst({
    where: {
      companyId,
      periodStart: { lte: date },
      periodEnd: { gte: date }
    }
  });

  if (!period || period.status === 'open') return { retroactive: false };

  if (period.status === 'locked') {
    throw Object.assign(new Error('Periodo bloqueado. Apenas o owner pode desbloquear.'), { status: 403 });
  }

  if (ROLE_RANK[userRole] < ROLE_RANK.admin) {
    throw Object.assign(new Error('Periodo fechado. Solicite reabertura ao administrador.'), { status: 403 });
  }

  if (!justification || justification.length < 20) {
    throw Object.assign(
      new Error('Justificativa obrigatoria para alterar periodo fechado (minimo 20 caracteres).'),
      { status: 422 }
    );
  }

  return { retroactive: true };
}

export function calcConvertedAmount(
  originalAmount: number,
  originalCurrency: string,
  baseCurrency: string,
  exchangeRate: number | null
): number {
  if (originalCurrency === baseCurrency) return Math.round(originalAmount * 100) / 100;

  if (!exchangeRate || exchangeRate <= 0) {
    throw Object.assign(new Error(`Taxa de cambio obrigatoria para converter ${originalCurrency} para ${baseCurrency}`), {
      status: 422
    });
  }

  return Math.round(originalAmount * exchangeRate * 100) / 100;
}
