import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatDate(date: Date | string, pattern = 'dd/MM/yyyy'): string {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return format(parsedDate, pattern, { locale: ptBR });
}

export function getPeriodDates(year: number, month: number): { start: Date; end: Date } {
  const referenceDate = new Date(year, month - 1, 1);
  return {
    start: startOfMonth(referenceDate),
    end: endOfMonth(referenceDate)
  };
}

export function getCurrentPeriod(): { year: number; month: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1
  };
}
