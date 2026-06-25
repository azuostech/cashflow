import { cn } from '@/lib/utils/cn';

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  revenue: { label: 'Receita', className: 'bg-emerald-50 text-emerald-700' },
  expense: { label: 'Despesa', className: 'bg-red-50 text-red-700' },
  transfer: { label: 'Transferencia', className: 'bg-blue-50 text-blue-700' },
  loan: { label: 'Emprestimo', className: 'bg-violet-50 text-violet-700' },
  investment: { label: 'Investimento', className: 'bg-teal-50 text-teal-700' },
  contribution: { label: 'Aporte', className: 'bg-indigo-50 text-indigo-700' },
  profit_distribution: { label: 'Distrib. lucros', className: 'bg-orange-50 text-orange-700' }
};

export function TransactionTypeBadge({ type, className }: { type: string; className?: string }) {
  const config = TYPE_CONFIG[type] ?? { label: type, className: 'bg-gray-100 text-gray-500' };

  return (
    <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  );
}
