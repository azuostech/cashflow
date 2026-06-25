import { cn } from '@/lib/utils/cn';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'border border-amber-200 bg-amber-50 text-amber-700' },
  paid: { label: 'Pago', className: 'border border-emerald-200 bg-emerald-50 text-emerald-700' },
  received: { label: 'Recebido', className: 'border border-emerald-200 bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Cancelado', className: 'border border-gray-200 bg-gray-100 text-gray-400' },
  overdue: { label: 'Vencido', className: 'border border-red-200 bg-red-50 text-red-700' }
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-500' };

  return (
    <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  );
}
