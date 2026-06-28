'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Pencil,
  Plus,
  RotateCcw
} from 'lucide-react';
import { AmountCell } from '@/components/transactions/amount-cell';
import { PayModal } from '@/components/transactions/pay-modal';
import { StatusBadge } from '@/components/transactions/status-badge';
import { TransactionForm } from '@/components/transactions/transaction-form';
import { TransactionTypeBadge } from '@/components/transactions/transaction-type-badge';
import { Drawer } from '@/components/shared/drawer';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DEFAULT_FILTERS, type TransactionFilters, type TransactionListItem, useTransactions } from '@/hooks/use-transactions';
import { useFetch } from '@/hooks/use-fetch';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';

interface Category {
  id: string;
  name: string;
}

interface CostCenter {
  id: string;
  name: string;
}

interface BankAccount {
  id: string;
  name: string;
  currency: string;
}

interface Company {
  id: string;
  baseCurrency: string;
}

function dateOnly(value: string | null | undefined) {
  if (!value) return '';
  return value.split('T')[0];
}

function formatApiError(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return 'Erro ao salvar lancamento.';

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const formErrors = (error as { formErrors?: string[] }).formErrors;
    if (formErrors?.[0]) return formErrors[0];
    const fieldErrors = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat()[0] : null;
    if (firstFieldError) return firstFieldError;
  }

  return 'Erro ao salvar lancamento.';
}

function buildCsv(transactions: TransactionListItem[]) {
  const header = ['competencia', 'vencimento', 'tipo', 'status', 'descricao', 'categoria', 'centro_custo', 'valor', 'moeda'];
  const rows = transactions.map((transaction) => [
    dateOnly(transaction.competenceDate),
    dateOnly(transaction.dueDate),
    transaction.type,
    transaction.status,
    transaction.description,
    transaction.category?.name ?? '',
    transaction.costCenter?.name ?? '',
    String(transaction.originalAmount),
    transaction.originalCurrency
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionListItem | null>(null);
  const [payingTx, setPayingTx] = useState<TransactionListItem | null>(null);
  const [apiNotice, setApiNotice] = useState('');

  const { transactions, total, totals, loading, error, refetch } = useTransactions(filters);
  const { data: categories } = useFetch<Category[]>('/api/categories');
  const { data: costCenters } = useFetch<CostCenter[]>('/api/cost-centers');
  const { data: accounts } = useFetch<BankAccount[]>('/api/bank-accounts');
  const { data: companies } = useFetch<Company[]>('/api/companies');

  const baseCurrency = companies?.[0]?.baseCurrency ?? accounts?.[0]?.currency ?? 'BRL';
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));

  const setFilter = useCallback((key: keyof TransactionFilters, value: string | number) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === 'page' ? Number(value) : 1
    }));
  }, []);

  async function handleSave(data: Record<string, unknown>) {
    const response = await fetch(editingTx ? `/api/transactions/${editingTx.id}` : '/api/transactions', {
      method: editingTx ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(formatApiError(result));
    }

    await refetch();
    setDrawerOpen(false);
    setEditingTx(null);
  }

  async function handleCancel(id: string) {
    const justification = window.prompt('Justificativa para cancelamento');
    if (!justification || justification.trim().length < 5) return;

    const response = await fetch(`/api/transactions/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ justification: justification.trim() })
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setApiNotice(formatApiError(result));
      return;
    }

    setApiNotice('');
    await refetch();
  }

  async function handleReverse(id: string) {
    if (!window.confirm('Criar estorno deste lancamento?')) return;

    const response = await fetch(`/api/transactions/${id}/reverse`, { method: 'POST' });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setApiNotice(formatApiError(result));
      return;
    }

    setApiNotice('');
    await refetch();
  }

  function openNew() {
    setEditingTx(null);
    setDrawerOpen(true);
  }

  function openEdit(transaction: TransactionListItem) {
    setEditingTx(transaction);
    setDrawerOpen(true);
  }

  function exportCsv() {
    const blob = new Blob([buildCsv(transactions)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lancamentos.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const hasFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === 'page' || key === 'limit' || key === 'sortBy' || key === 'sortDir') return false;
      return value && value !== 'all';
    });
  }, [filters]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Lancamentos</h1>
          <p className="mt-1 text-sm text-gray-500">Receitas, despesas e transferencias da empresa.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={exportCsv} disabled={transactions.length === 0} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button type="button" onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo lancamento
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={filters.type} onChange={(event) => setFilter('type', event.target.value)} className="w-44">
          <option value="all">Todos os tipos</option>
          <option value="revenue">Receita</option>
          <option value="expense">Despesa</option>
          <option value="transfer">Transferencia</option>
        </Select>
        <Select value={filters.status} onChange={(event) => setFilter('status', event.target.value)} className="w-44">
          <option value="all">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="paid">Pago</option>
          <option value="received">Recebido</option>
          <option value="cancelled">Cancelado</option>
          <option value="overdue">Vencido</option>
        </Select>
        <Select value={filters.categoryId} onChange={(event) => setFilter('categoryId', event.target.value)} className="w-48">
          <option value="">Todas categorias</option>
          {(categories ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Select value={filters.costCenterId} onChange={(event) => setFilter('costCenterId', event.target.value)} className="w-48">
          <option value="">Todos centros</option>
          {(costCenters ?? []).map((costCenter) => (
            <option key={costCenter.id} value={costCenter.id}>
              {costCenter.name}
            </option>
          ))}
        </Select>
        <Select value={filters.bankAccountId} onChange={(event) => setFilter('bankAccountId', event.target.value)} className="w-48">
          <option value="">Todas contas</option>
          {(accounts ?? []).map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
        <Input type="date" value={filters.startDate} onChange={(event) => setFilter('startDate', event.target.value)} className="w-40" />
        <Input type="date" value={filters.endDate} onChange={(event) => setFilter('endDate', event.target.value)} className="w-40" />
        <Input
          placeholder="Buscar"
          value={filters.search}
          onChange={(event) => setFilter('search', event.target.value)}
          className="w-52"
        />
        {hasFilters ? (
          <Button type="button" variant="ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Limpar
          </Button>
        ) : null}
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Receitas</p>
          <p className="mt-1 text-lg font-semibold text-emerald-600">{formatCurrency(totals.revenue, baseCurrency)}</p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Despesas</p>
          <p className="mt-1 text-lg font-semibold text-red-600">{formatCurrency(totals.expense, baseCurrency)}</p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Resultado</p>
          <p className={`mt-1 text-lg font-semibold ${totals.result >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(totals.result, baseCurrency)}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Registros</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{total}</p>
        </div>
      </div>

      {apiNotice ? <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{apiNotice}</div> : null}
      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Datas</TableHead>
                <TableHead>Descricao</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Centro</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Conc.</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-sm text-gray-400">
                    Carregando lancamentos...
                  </TableCell>
                </TableRow>
              ) : null}
              {!loading && transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <EmptyState
                      icon={<FileText className="h-9 w-9" />}
                      title="Nenhum lancamento encontrado"
                      description={hasFilters ? 'Ajuste os filtros ou limpe a busca para ver outros lancamentos.' : 'Crie o primeiro lancamento da empresa.'}
                      action={hasFilters ? { label: 'Limpar filtros', onClick: () => setFilters(DEFAULT_FILTERS) } : { label: 'Novo lancamento', onClick: openNew }}
                    />
                  </TableCell>
                </TableRow>
              ) : null}
              {!loading
                ? transactions.map((transaction) => (
                    <TableRow key={transaction.id} className={transaction.status === 'cancelled' ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="text-xs text-gray-600">{formatDate(transaction.competenceDate)}</div>
                        {dateOnly(transaction.dueDate) !== dateOnly(transaction.competenceDate) ? (
                          <div className="text-xs text-gray-400">Venc. {formatDate(transaction.dueDate)}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <Link
                            href={`/transactions/${transaction.id}`}
                            className="block max-w-xs truncate font-medium text-gray-900 hover:text-emerald-700"
                          >
                            {transaction.description}
                          </Link>
                          {transaction.recurrenceRuleId ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">Rec.</span> : null}
                          {transaction.isInstallment ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">Parc.</span> : null}
                          {transaction.isReversal ? <span className="rounded bg-orange-50 px-1.5 py-0.5 text-xs text-orange-700">Estorno</span> : null}
                        </div>
                        {transaction.contact?.name ? <div className="mt-0.5 text-xs text-gray-400">{transaction.contact.name}</div> : null}
                      </TableCell>
                      <TableCell>
                        <TransactionTypeBadge type={transaction.type} />
                      </TableCell>
                      <TableCell>
                        {transaction.category ? (
                          <div className="flex items-center gap-2">
                            {transaction.category.color ? (
                              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: transaction.category.color }} />
                            ) : null}
                            <span className="max-w-[140px] truncate text-xs text-gray-600">{transaction.category.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">--</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs text-gray-500">{transaction.costCenter?.name ?? '--'}</TableCell>
                      <TableCell>
                        <AmountCell
                          originalAmount={Number(transaction.originalAmount)}
                          originalCurrency={transaction.originalCurrency}
                          convertedAmount={Number(transaction.convertedAmount)}
                          companyCurrency={transaction.companyCurrency}
                          type={transaction.type}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={transaction.status} />
                      </TableCell>
                      <TableCell>
                        <span
                          className={[
                            'text-xs',
                            transaction.reconciliationStatus === 'reconciled'
                              ? 'text-emerald-600'
                              : transaction.reconciliationStatus === 'partial'
                                ? 'text-amber-600'
                                : 'text-gray-300'
                          ].join(' ')}
                        >
                          {transaction.reconciliationStatus === 'reconciled'
                            ? 'Conc.'
                            : transaction.reconciliationStatus === 'partial'
                              ? 'Parcial'
                              : '--'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {transaction.status === 'pending' ? (
                            <button
                              type="button"
                              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                              onClick={() => setPayingTx(transaction)}
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              {transaction.type === 'revenue' ? 'Receber' : 'Pagar'}
                            </button>
                          ) : null}
                          {transaction.status !== 'cancelled' ? (
                            <button
                              type="button"
                              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-gray-500 hover:bg-gray-100"
                              onClick={() => openEdit(transaction)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>
                          ) : null}
                          {transaction.status !== 'cancelled' && !transaction.isReversal ? (
                            <button
                              type="button"
                              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-orange-600 hover:bg-orange-50"
                              onClick={() => handleReverse(transaction.id)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Estornar
                            </button>
                          ) : null}
                          {transaction.status !== 'cancelled' ? (
                            <button
                              type="button"
                              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-red-600 hover:bg-red-50"
                              onClick={() => handleCancel(transaction.id)}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Cancelar
                            </button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                : null}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex justify-center gap-2">
          <Button type="button" variant="outline" disabled={filters.page === 1} onClick={() => setFilter('page', filters.page - 1)} className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="self-center text-sm text-gray-500">
            Pagina {filters.page} de {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={filters.page >= totalPages}
            onClick={() => setFilter('page', filters.page + 1)}
            className="gap-2"
          >
            Proxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingTx(null);
        }}
        title={editingTx ? 'Editar lancamento' : 'Novo lancamento'}
        width="lg"
      >
        <TransactionForm
          initialData={editingTx}
          companyBaseCurrency={baseCurrency}
          onSave={handleSave}
          onCancel={() => {
            setDrawerOpen(false);
            setEditingTx(null);
          }}
        />
      </Drawer>

      <PayModal transaction={payingTx} open={!!payingTx} onClose={() => setPayingTx(null)} onPaid={refetch} />
    </div>
  );
}
