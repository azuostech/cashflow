import { cn } from '@/lib/utils/cn';

const COLORS: Record<string, string> = {
  customer: 'bg-blue-50 text-blue-700',
  supplier: 'bg-orange-50 text-orange-700',
  both: 'bg-purple-50 text-purple-700',
  employee: 'bg-teal-50 text-teal-700',
  other: 'bg-gray-100 text-gray-600',
  active: 'bg-emerald-50 text-emerald-700',
  inactive: 'bg-gray-100 text-gray-500',
  deprecated: 'bg-red-50 text-red-600',
  checking: 'bg-blue-50 text-blue-700',
  savings: 'bg-teal-50 text-teal-700',
  cash: 'bg-yellow-50 text-yellow-700',
  digital: 'bg-purple-50 text-purple-700',
  investment: 'bg-emerald-50 text-emerald-700',
  revenue: 'bg-emerald-50 text-emerald-700',
  expense: 'bg-red-50 text-red-700',
  transfer: 'bg-gray-100 text-gray-600'
};

const LABELS: Record<string, string> = {
  customer: 'Cliente',
  supplier: 'Fornecedor',
  both: 'Cliente/Fornec.',
  employee: 'Funcionario',
  other: 'Outro',
  active: 'Ativo',
  inactive: 'Inativo',
  deprecated: 'Depreciada',
  checking: 'Corrente',
  savings: 'Poupanca',
  cash: 'Caixa',
  digital: 'Digital',
  investment: 'Investimento',
  revenue: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferencia'
};

export function TypeBadge({ type, className }: { type: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', COLORS[type] ?? COLORS.other, className)}>
      {LABELS[type] ?? type}
    </span>
  );
}
