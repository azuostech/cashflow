'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Inbox,
  Link2,
  ReceiptText,
  WalletCards
} from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { useFetch } from '@/hooks/use-fetch';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';

type Urgency = 'critical' | 'warning' | 'info' | 'positive';

interface FinancialCenterItem {
  type:
    | 'overdue_payable'
    | 'overdue_receivable'
    | 'due_today_payable'
    | 'due_today_receivable'
    | 'unreconciled'
    | 'expected_today';
  urgency: Urgency;
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

interface FinancialCenterSummary {
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

const urgencyConfig: Record<Urgency, { border: string; bg: string; text: string; dot: string; label: string }> = {
  critical: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-800', dot: 'bg-red-500', label: 'Critico' },
  warning: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Atencao' },
  info: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Info' },
  positive: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
    label: 'Positivo'
  }
};

const typeConfig = {
  overdue_payable: { Icon: WalletCards, label: 'A pagar vencida', action: 'Pagar', href: '/payables' },
  overdue_receivable: { Icon: ReceiptText, label: 'A receber vencida', action: 'Registrar', href: '/receivables' },
  due_today_payable: { Icon: Clock3, label: 'A pagar hoje', action: 'Pagar', href: '/payables' },
  due_today_receivable: { Icon: Inbox, label: 'A receber hoje', action: 'Registrar', href: '/receivables' },
  unreconciled: { Icon: Link2, label: 'Nao conciliado', action: 'Conciliar', href: '/bank/reconciliation' },
  expected_today: { Icon: ReceiptText, label: 'Previsto hoje', action: 'Ver', href: '/receivables' }
};

const sectionDots: Record<string, string> = {
  'text-red-700': 'bg-red-700',
  'text-amber-700': 'bg-amber-700',
  'text-emerald-700': 'bg-emerald-700',
  'text-blue-700': 'bg-blue-700'
};

function SectionHeader({
  title,
  count,
  totalAmount,
  currency,
  tone
}: {
  title: string;
  count: number;
  totalAmount?: number;
  currency?: string;
  tone: string;
}) {
  if (!count) return null;

  return (
    <div className="mb-2 mt-5 flex items-center justify-between gap-3">
      <h2 className={cn('flex items-center gap-2 text-sm font-semibold', tone)}>
        <span className={cn('h-2 w-2 rounded-full', sectionDots[tone] ?? 'bg-gray-500')} />
        {title} ({count})
      </h2>
      {totalAmount !== undefined && currency ? <span className={cn('text-sm font-semibold', tone)}>{formatCurrency(totalAmount, currency)}</span> : null}
    </div>
  );
}

function ItemRow({ item }: { item: FinancialCenterItem }) {
  const urgency = urgencyConfig[item.urgency];
  const type = typeConfig[item.type];
  const Icon = type.Icon;

  return (
    <div className={cn('mb-2 flex items-start justify-between gap-4 rounded-lg border p-3', urgency.bg, urgency.border)}>
      <div className="flex min-w-0 items-start gap-3">
        <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/70', urgency.text)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className={cn('truncate text-sm font-semibold', urgency.text)}>{item.description}</p>
            <span className={cn('rounded-md bg-white/60 px-1.5 py-0.5 text-xs font-medium', urgency.text)}>{type.label}</span>
          </div>
          <div className={cn('flex flex-wrap gap-x-2 gap-y-1 text-xs', urgency.text)}>
            {item.dueDate ? <span>Venc: {formatDate(item.dueDate)}</span> : null}
            {item.daysOverdue !== null && item.daysOverdue > 0 ? <span className="font-semibold">{item.daysOverdue}d atrasado</span> : null}
            {item.category ? <span>{item.category}</span> : null}
            {item.contact ? <span>{item.contact}</span> : null}
            {item.accountName ? <span>{item.accountName}</span> : null}
          </div>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn('text-sm font-semibold', urgency.text)}>{formatCurrency(item.amount, item.currency)}</p>
        <Link href={`/transactions/${item.id}`} className={cn('inline-flex items-center gap-1 text-xs font-medium hover:underline', urgency.text)}>
          {type.action}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

export default function FinancialCenterPage() {
  const { data, loading, error } = useFetch<FinancialCenterSummary>('/api/financial-center/summary');
  const items = data?.items ?? [];
  const counts = data?.counts;
  const currency = data?.currency ?? 'BRL';
  const overduePayables = items.filter((item) => item.type === 'overdue_payable');
  const overdueReceivables = items.filter((item) => item.type === 'overdue_receivable');
  const dueTodayPayables = items.filter((item) => item.type === 'due_today_payable');
  const dueTodayReceivables = items.filter((item) => item.type === 'due_today_receivable');
  const hasNothing = !loading && !error && items.length === 0 && (counts?.unreconciled ?? 0) === 0;

  return (
    <div className="max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Central Financeira</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700">
          Ver dashboard
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <LoadingSpinner />
        </div>
      ) : null}

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

      {hasNothing ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-12 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <p className="mt-3 text-base font-semibold text-emerald-900">Tudo em dia</p>
          <p className="mt-1 text-sm text-emerald-700">Nenhuma pendencia financeira no momento.</p>
        </div>
      ) : null}

      {data && !hasNothing ? (
        <>
          <SectionHeader
            title="Vencidas a pagar"
            count={overduePayables.length}
            totalAmount={data.totalOverduePayable}
            currency={currency}
            tone="text-red-700"
          />
          {overduePayables.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}

          <SectionHeader
            title="Vencidas a receber"
            count={overdueReceivables.length}
            totalAmount={data.totalOverdueReceivable}
            currency={currency}
            tone="text-amber-700"
          />
          {overdueReceivables.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}

          <SectionHeader
            title="Vence hoje a pagar"
            count={dueTodayPayables.length}
            totalAmount={data.totalDueTodayPayable}
            currency={currency}
            tone="text-amber-700"
          />
          {dueTodayPayables.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}

          <SectionHeader
            title="Esperado hoje a receber"
            count={dueTodayReceivables.length}
            totalAmount={data.totalDueTodayReceivable}
            currency={currency}
            tone="text-emerald-700"
          />
          {dueTodayReceivables.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}

          {data.counts.unreconciled > 0 ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <Link2 className="h-4 w-4" />
                <span>{data.counts.unreconciled} movimentos bancarios nao conciliados</span>
              </div>
              <Link href="/bank/reconciliation" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
                Conciliar
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : null}

          {items.length > 0 && data.counts.overduePayables > 0 ? (
            <div className="mt-5 flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />
              Priorize as contas vencidas antes das tarefas do dia.
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
