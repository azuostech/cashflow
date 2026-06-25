import { formatCurrency } from '@/lib/utils/currency';

interface AmountCellProps {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  companyCurrency: string;
  type: string;
}

export function AmountCell({
  originalAmount,
  originalCurrency,
  convertedAmount,
  companyCurrency,
  type
}: AmountCellProps) {
  const isOutflow = type === 'expense' || type === 'transfer';
  const colorClass = isOutflow ? 'text-red-600' : type === 'revenue' ? 'text-emerald-600' : 'text-gray-700';
  const sign = isOutflow ? '-' : '+';
  const showConverted = originalCurrency !== companyCurrency;

  return (
    <div className="text-right">
      <div className={`text-sm font-medium ${colorClass}`}>
        {sign}
        {formatCurrency(originalAmount, originalCurrency)}
      </div>
      {showConverted ? <div className="text-xs text-gray-400">{formatCurrency(convertedAmount, companyCurrency)}</div> : null}
    </div>
  );
}
