import { addDays, addMonths, addQuarters, addWeeks, endOfMonth, getDate, isAfter, setDate } from 'date-fns';

export interface InstallmentPreview {
  number: number;
  originalAmount: number;
  convertedAmount: number;
  dueDate: string;
}

export type RecurrenceFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual';

export interface RecurrenceDateConfig {
  frequency: RecurrenceFrequency;
  interval?: number;
  startDate: Date;
  endDate?: Date | null;
  occurrencesLimit?: number | null;
  dayOfMonth?: number | null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function distributeAmount(total: number, count: number): number[] {
  const base = Math.floor((total * 100) / count) / 100;
  const remainder = roundMoney(total - base * count);

  return Array.from({ length: count }, (_, index) => (index === 0 ? roundMoney(base + remainder) : base));
}

function toDateOnly(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function generateInstallmentPreviews(
  originalAmount: number,
  count: number,
  firstDueDate: Date,
  exchangeRate = 1
): InstallmentPreview[] {
  if (!Number.isFinite(originalAmount) || !Number.isFinite(count) || count < 2) return [];

  const normalizedCount = Math.trunc(count);
  const originalAmounts = distributeAmount(originalAmount, normalizedCount);
  const convertedAmounts = distributeAmount(originalAmount * exchangeRate, normalizedCount);

  return originalAmounts.map((amount, index) => ({
    number: index + 1,
    originalAmount: amount,
    convertedAmount: convertedAmounts[index],
    dueDate: toDateOnly(addMonths(firstDueDate, index))
  }));
}

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

function applyDayOfMonth(date: Date, dayOfMonth: number): Date {
  const lastDay = getDate(endOfMonth(date));
  return setDate(date, Math.min(dayOfMonth, lastDay));
}

export function generateRecurrenceDates(config: RecurrenceDateConfig): Date[] {
  const horizon = addMonths(new Date(), 12);
  const dates: Date[] = [];
  let current = config.startDate;
  let count = 0;
  const interval = config.interval ?? 1;

  while (!isAfter(current, horizon)) {
    if (config.endDate && isAfter(current, config.endDate)) break;
    if (config.occurrencesLimit && count >= config.occurrencesLimit) break;

    const targetDay = config.dayOfMonth ?? getDate(config.startDate);
    dates.push(applyDayOfMonth(current, targetDay));

    current = addInterval(current, config.frequency, interval);
    count += 1;
  }

  return dates;
}

export function isCategoryCompatible(categoryType: string, transactionType: string): boolean {
  if (transactionType === 'revenue') return categoryType === 'revenue';
  if (transactionType === 'transfer') return true;
  return categoryType !== 'revenue';
}

export function calcConvertedAmount(originalAmount: number, originalCurrency: string, baseCurrency: string, exchangeRate = 1) {
  if (originalCurrency === baseCurrency) return roundMoney(originalAmount);
  return roundMoney(originalAmount * exchangeRate);
}
