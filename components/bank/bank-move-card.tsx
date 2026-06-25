'use client';

import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';

interface BankMoveCardProps {
  move: {
    id: string;
    date: string;
    description: string;
    originalAmount: number | string;
    originalCurrency: string;
    type: 'credit' | 'debit';
    reconciliationStatus: string;
    isPossibleDuplicate: boolean;
    merchantName: string | null;
    bankAccount?: { name: string; currency: string } | null;
  };
  isSelected: boolean;
  onClick: () => void;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  unreconciled: { label: 'Pendente', className: 'bg-amber-50 text-amber-700' },
  partial: { label: 'Parcial', className: 'bg-blue-50 text-blue-700' },
  reconciled: { label: 'Conciliado', className: 'bg-emerald-50 text-emerald-700' },
  ignored: { label: 'Ignorado', className: 'bg-gray-100 text-gray-500' }
};

export function BankMoveCard({ move, isSelected, onClick }: BankMoveCardProps) {
  const badge = statusBadge[move.reconciliationStatus] ?? statusBadge.unreconciled;
  const isCredit = move.type === 'credit';
  const title = move.merchantName ?? move.description;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block w-full border-b border-gray-100 px-4 py-3 text-left transition',
        isSelected ? 'border-l-2 border-l-emerald-500 bg-emerald-50' : 'hover:bg-gray-50'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', badge.className)}>{badge.label}</span>
            {move.isPossibleDuplicate ? (
              <span className="rounded bg-orange-50 px-1.5 py-0.5 text-xs font-medium text-orange-700">Possivel duplicata</span>
            ) : null}
          </div>
          <p className="mb-0.5 text-xs text-gray-400">{formatDate(move.date)}</p>
          <p
            className={cn(
              'truncate text-sm font-medium',
              move.reconciliationStatus === 'ignored' ? 'text-gray-400 line-through' : 'text-gray-800'
            )}
            title={title}
          >
            {title}
          </p>
          {move.bankAccount?.name ? <p className="mt-0.5 truncate text-xs text-gray-400">{move.bankAccount.name}</p> : null}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className={cn('text-sm font-semibold', isCredit ? 'text-emerald-600' : 'text-red-600')}>
            {isCredit ? '+' : '-'}
            {formatCurrency(Number(move.originalAmount), move.originalCurrency)}
          </p>
        </div>
      </div>
    </button>
  );
}
