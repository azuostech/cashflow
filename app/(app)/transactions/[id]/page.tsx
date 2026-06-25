'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Ban, CreditCard, Pencil, RotateCcw } from 'lucide-react';
import { AttachmentPanel } from '@/components/shared/attachment-panel';
import { Drawer } from '@/components/shared/drawer';
import { AmountCell } from '@/components/transactions/amount-cell';
import { InstallmentsPanel } from '@/components/transactions/installments-panel';
import { PayModal } from '@/components/transactions/pay-modal';
import { StatusBadge } from '@/components/transactions/status-badge';
import { TransactionForm } from '@/components/transactions/transaction-form';
import { TransactionTypeBadge } from '@/components/transactions/transaction-type-badge';
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/use-fetch';
import { type TransactionListItem } from '@/hooks/use-transactions';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';

function formatApiError(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return 'Erro ao executar acao.';

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const formErrors = (error as { formErrors?: string[] }).formErrors;
    if (formErrors?.[0]) return formErrors[0];
    const fieldErrors = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat()[0] : null;
    if (firstFieldError) return firstFieldError;
  }

  return 'Erro ao executar acao.';
}

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: transaction, loading, error, refetch } = useFetch<TransactionListItem & { installments?: unknown[]; recurrenceRule?: unknown }>(
    id ? `/api/transactions/${id}` : null
  );
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [notice, setNotice] = useState('');

  if (error) {
    return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  if (loading || !transaction) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500" />
      </div>
    );
  }

  const isPending = transaction.status === 'pending' || transaction.status === 'overdue';
  const isCancelled = transaction.status === 'cancelled';
  const hasInstallments = transaction.isInstallment && (transaction._count?.installments ?? 0) > 0;
  const baseCurrency = transaction.companyCurrency ?? 'BRL';

  async function handleCancel() {
    const justification = window.prompt('Justificativa para cancelamento');
    if (!justification || justification.trim().length < 5) return;

    setActionLoading('cancel');
    setNotice('');

    const response = await fetch(`/api/transactions/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ justification: justification.trim() })
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setNotice(formatApiError(result));
    } else {
      await refetch();
    }

    setActionLoading('');
  }

  async function handleReverse() {
    if (!window.confirm('Criar um estorno deste lancamento?')) return;

    setActionLoading('reverse');
    setNotice('');

    const response = await fetch(`/api/transactions/${id}/reverse`, { method: 'POST' });
    if (response.ok) {
      const reversal: { id: string } = await response.json();
      router.push(`/transactions/${reversal.id}`);
      return;
    }

    const result = await response.json().catch(() => ({}));
    setNotice(formatApiError(result));
    setActionLoading('');
  }

  async function handleSaveEdit(data: Record<string, unknown>) {
    const response = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(formatApiError(result));
    }

    await refetch();
    setEditOpen(false);
  }

  return (
    <div className="max-w-5xl">
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-gray-700"
        onClick={() => router.back()}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <TransactionTypeBadge type={transaction.type} />
            {transaction.isReversal ? <span className="rounded bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">Estorno</span> : null}
            {transaction.recurrenceRuleId ? <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Recorrente</span> : null}
            {transaction.isInstallment ? <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Parcelado</span> : null}
          </div>
          <h1 className="truncate text-2xl font-semibold text-gray-900">{transaction.description}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusBadge status={transaction.status} />
            <span className="text-xs text-gray-400">ID: {transaction.id.slice(0, 8)}</span>
          </div>
        </div>
        <AmountCell
          originalAmount={Number(transaction.originalAmount)}
          originalCurrency={transaction.originalCurrency}
          convertedAmount={Number(transaction.convertedAmount)}
          companyCurrency={baseCurrency}
          type={transaction.type}
        />
      </div>

      {notice ? <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{notice}</div> : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Datas</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="mb-0.5 text-xs text-gray-400">Competencia</p>
              <p className="text-sm font-medium text-gray-800">{formatDate(transaction.competenceDate)}</p>
              <p className="text-xs text-gray-300">DRE</p>
            </div>
            <div>
              <p className="mb-0.5 text-xs text-gray-400">Vencimento</p>
              <p className="text-sm font-medium text-gray-800">{formatDate(transaction.dueDate)}</p>
              <p className="text-xs text-gray-300">A pagar/receber</p>
            </div>
            <div>
              <p className="mb-0.5 text-xs text-gray-400">Pagamento</p>
              <p className="text-sm font-medium text-gray-800">{transaction.paymentDate ? formatDate(transaction.paymentDate) : '--'}</p>
              <p className="text-xs text-gray-300">Fluxo de caixa</p>
            </div>
          </div>

          {transaction.originalCurrency !== baseCurrency ? (
            <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
              <p className="text-xs text-blue-700">
                {transaction.originalCurrency} para {baseCurrency}: taxa {Number(transaction.exchangeRate).toFixed(4)}
              </p>
              <p className="mt-0.5 text-xs text-blue-600">
                {formatCurrency(Number(transaction.originalAmount), transaction.originalCurrency)} ={' '}
                {formatCurrency(Number(transaction.convertedAmount), baseCurrency)}
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Classificacao</h2>
          <div className="space-y-3">
            <div>
              <p className="mb-0.5 text-xs text-gray-400">Categoria</p>
              <div className="flex items-center gap-2">
                {transaction.category?.color ? (
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: transaction.category.color }} />
                ) : null}
                <p className="text-sm text-gray-800">{transaction.category?.name ?? '--'}</p>
              </div>
            </div>
            <InfoLine label="Centro de custo" value={transaction.costCenter?.name} />
            <InfoLine label="Contato" value={transaction.contact?.name} />
            <InfoLine label="Conta bancaria" value={transaction.bankAccount?.name} />
            {transaction.destBankAccount?.name ? <InfoLine label="Conta destino" value={transaction.destBankAccount.name} /> : null}
            <InfoLine
              label="Conciliacao"
              value={
                transaction.reconciliationStatus === 'reconciled'
                  ? 'Conciliado'
                  : transaction.reconciliationStatus === 'partial'
                    ? 'Parcial'
                    : 'Nao conciliado'
              }
            />
          </div>
        </section>
      </div>

      {transaction.notes || transaction.sourceDocumentNumber || transaction.externalReference ? (
        <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Detalhes adicionais</h2>
          <div className="space-y-3">
            {transaction.notes ? (
              <div>
                <p className="mb-0.5 text-xs text-gray-400">Observacoes</p>
                <p className="whitespace-pre-wrap text-sm text-gray-700">{transaction.notes}</p>
              </div>
            ) : null}
            <InfoLine label="Documento" value={transaction.sourceDocumentNumber ?? undefined} />
            <InfoLine label="Referencia externa" value={transaction.externalReference ?? undefined} />
          </div>
        </section>
      ) : null}

      {hasInstallments ? (
        <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <InstallmentsPanel transactionId={transaction.id} currency={transaction.originalCurrency} onPaid={() => void refetch()} />
        </section>
      ) : null}

      {transaction.isReversal && transaction.reversalOfId ? (
        <section className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="mb-1 text-xs font-medium text-orange-700">Este lancamento e um estorno</p>
          <button
            type="button"
            className="text-xs font-medium text-orange-700 underline"
            onClick={() => router.push(`/transactions/${transaction.reversalOfId}`)}
          >
            Ver lancamento original #{transaction.reversalOfId.slice(0, 8)}
          </button>
        </section>
      ) : null}

      <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <AttachmentPanel entityType="transaction" entityId={transaction.id} readOnly={isCancelled} />
      </section>

      {!isCancelled ? (
        <div className="flex flex-wrap gap-2">
          {isPending ? (
            <Button type="button" onClick={() => setPayOpen(true)} className="gap-2">
              <CreditCard className="h-4 w-4" />
              {transaction.type === 'revenue' ? 'Registrar recebimento' : 'Registrar pagamento'}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => setEditOpen(true)} className="gap-2">
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          {!transaction.isReversal ? (
            <Button type="button" variant="outline" onClick={() => void handleReverse()} disabled={actionLoading === 'reverse'} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              {actionLoading === 'reverse' ? 'Criando...' : 'Estornar'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCancel()}
            disabled={actionLoading === 'cancel'}
            className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
          >
            <Ban className="h-4 w-4" />
            {actionLoading === 'cancel' ? 'Cancelando...' : 'Cancelar'}
          </Button>
        </div>
      ) : null}

      <PayModal
        transaction={transaction}
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onPaid={() => {
          void refetch();
          setPayOpen(false);
        }}
      />

      <Drawer open={editOpen} onClose={() => setEditOpen(false)} title="Editar lancamento" width="lg">
        <TransactionForm
          initialData={transaction}
          companyBaseCurrency={baseCurrency}
          onSave={handleSaveEdit}
          onCancel={() => setEditOpen(false)}
        />
      </Drawer>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="mb-0.5 text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-800">{value || '--'}</p>
    </div>
  );
}
