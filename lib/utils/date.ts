import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';

export function toISODate(value: Date | string): string {
  if (typeof value === 'string') {
    return format(parseISO(value), 'yyyy-MM-dd');
  }

  return format(value, 'yyyy-MM-dd');
}

export function monthRange(month: string): { start: string; end: string } {
  const [year, monthPart] = month.split('-').map(Number);
  const start = startOfMonth(new Date(year, monthPart - 1, 1));
  const end = endOfMonth(start);

  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd')
  };
}

export function currentMonth(): string {
  return format(new Date(), 'yyyy-MM');
}
