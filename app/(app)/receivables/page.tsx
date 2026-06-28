'use client';

import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { PayModal } from '@/components/transactions/pay-modal';
import { StatusBadge } from '@/components/transactions/status-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { type TransactionFilters, type TransactionListItem, useTransactions } from '@/hooks/use-transactions';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';

const DEFAULT_RECEIVABLES_FILTERS: TransactionFilters = {
  page: 1,
  limit: 100,
  type: 'revenue',
  status: 'pending',
  startDate: '',
  endDate: '',
  categoryId: '',
  costCenterId: '',
  bankAccountId: '',
  contactId: '',
  search: '',
  sortBy: 'dueDate',
  sortDir: 'asc'
};

function dateOnly(value: string) {
  return value.split('T')[0];
}

function ReceivableSection({
  title,
  items,
  tone,
  onReceive
}: {
  title: string;
  items: TransactionListItem[];
  tone: 'danger' | 'warning' | 'default';
  onReceive: (transaction: TransactionListItem) => void;
}) {
  if (items.length === 0) return null;

  const titleClass = tone === 'danger' ? 'text-red-600' : tone === 'warning' ? 'text-amber-600' : 'text-gray-700';

  return (
    <section className="mb-6">
      <h2 className={`mb-2 text-sm font-semibold ${titleClass}`}>
        {title} ({items.length})
      </h2>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableBody>
              {items.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="w-28 text-xs text-gray-500">{formatDate(transaction.dueDate)}</TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-900">{transaction.description}</div>
                    {transaction.contact?.name ? <div className="text-xs text-gray-400">{transaction.contact.name}</div> : null}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">{transaction.category?.name ?? '--'}</TableCell>
                  <TableCell>
                    <StatusBadge status={transaction.status} />
                  </TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600">
                    {formatCurrency(Number(transaction.originalAmount), transaction.originalCurrency)}
                  </TableCell>
                  <TableCell className="w-32 text-right">
                    <Button type="button" className="h-8 gap-2 px-3" onClick={() => onReceive(transaction)}>
                      <CreditCard className="h-4 w-4" />
                      Receber
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}

export default function ReceivablesPage() {
  const [receivingTx, setReceivingTx] = useState<TransactionListItem | null>(null);
  const { transactions, total, totals, loading, error, refetch } = useTransactions(DEFAULT_RECEIVABLES_FILTERS);

  const today = new Date().toISOString().split('T')[0];
  const overdue = transactions.filter((transaction) => dateOnly(transaction.dueDate) < today);
  const dueToday = transactions.filter((transaction) => dateOnly(transaction.dueDate) === today);
  const upcoming = transactions.filter((transaction) => dateOnly(transaction.dueDate) > today);
  const currency = transactions[0]?.companyCurrency ?? 'BRL';

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Contas a receber</h1>
          <p className="mt-1 text-sm text-gray-500">{total} receitas pendentes</p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white px-4 py-3 text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total a receber</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">{formatCurrency(totals.revenue, currency)}</p>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? <div className="py-12 text-center text-sm text-gray-400">Carregando contas...</div> : null}

      {!loading ? (
        <>
          <ReceivableSection title="Vencidas" items={overdue} tone="danger" onReceive={setReceivingTx} />
          <ReceivableSection title="Vence hoje" items={dueToday} tone="warning" onReceive={setReceivingTx} />
          <ReceivableSection title="Proximas" items={upcoming} tone="default" onReceive={setReceivingTx} />
          {transactions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-white">
              <EmptyState
                icon={<CreditCard className="h-9 w-9" />}
                title="Nenhuma receita pendente"
                description="As receitas abertas e vencidas aparecem aqui para recebimento rapido."
              />
            </div>
          ) : null}
        </>
      ) : null}

      <PayModal transaction={receivingTx} open={!!receivingTx} onClose={() => setReceivingTx(null)} onPaid={refetch} />
    </div>
  );
}
