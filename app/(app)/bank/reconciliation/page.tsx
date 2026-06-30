'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, ListChecks, PlusCircle } from 'lucide-react';
import { BankMoveCard } from '@/components/bank/bank-move-card';
import { SuggestionCard } from '@/components/bank/suggestion-card';
import { EmptyState } from '@/components/shared/empty-state';
import { FormField } from '@/components/shared/form-field';
import { Modal } from '@/components/shared/modal';
import { QuickCategoryForm, type DRENodeOption } from '@/components/shared/quick-category-form';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFetch } from '@/hooks/use-fetch';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';

interface BankAccountOption {
  id: string;
  name: string;
  currency: string;
  active: boolean;
}

interface BankMove {
  id: string;
  date: string;
  description: string;
  originalAmount: string | number;
  originalCurrency: string;
  type: 'credit' | 'debit';
  reconciliationStatus: string;
  isPossibleDuplicate: boolean;
  merchantName: string | null;
  bankAccount?: { id: string; name: string; currency: string } | null;
}

interface MovesResponse {
  data: BankMove[];
  total: number;
  page: number;
  limit: number;
  summary: Array<{
    reconciliationStatus: string;
    _count: number | { _all?: number };
  }>;
}

interface Suggestion {
  transactionId: string | null;
  installmentId: string | null;
  description: string;
  amount: string | number;
  currency: string;
  dueDate: string;
  status: string;
  categoryName: string | null;
  contactName: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}

interface CategoryOption {
  id: string;
  name: string;
  type: string;
  deprecatedAt?: string | null;
  dreNode?: { name: string } | null;
}

interface CostCenterOption {
  id: string;
  name: string;
  active: boolean;
}

interface ContactOption {
  id: string;
  name: string;
  active: boolean;
}

const ALL_ACCOUNTS = '__all__';

function readApiError(payload: unknown, fallback: string): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return fallback;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const formErrors = (error as { formErrors?: string[] }).formErrors;
    if (Array.isArray(formErrors) && formErrors[0]) return formErrors[0];
    const fieldErrors = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    const first = fieldErrors ? Object.values(fieldErrors).flat()[0] : null;
    if (first) return first;
  }
  return fallback;
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getCreatedId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const id = (payload as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

function summaryCount(summary: MovesResponse['summary'], status: string): number {
  const value = summary.find((item) => item.reconciliationStatus === status)?._count;
  if (typeof value === 'number') return value;
  return value?._all ?? 0;
}

export default function ReconciliationPage() {
  const [selectedMoveId, setSelectedMoveId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const { data: accounts } = useFetch<BankAccountOption[]>('/api/bank-accounts');

  const movesUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('reconciliationStatus', 'unreconciled');
    params.set('limit', '100');
    if (bankAccountId) params.set('bankAccountId', bankAccountId);
    if (dateFilter) params.set('startDate', dateFilter);
    if (searchFilter.trim()) params.set('search', searchFilter.trim());
    return `/api/bank/moves?${params.toString()}`;
  }, [bankAccountId, dateFilter, searchFilter]);

  const { data: movesData, loading: loadingMoves, refetch: refetchMoves } = useFetch<MovesResponse>(movesUrl);
  const moves = useMemo(() => movesData?.data ?? [], [movesData?.data]);
  const summary = useMemo(() => movesData?.summary ?? [], [movesData?.summary]);
  const selectedMove = moves.find((move) => move.id === selectedMoveId) ?? null;

  const accountOptions = useMemo(
    () => [
      { value: ALL_ACCOUNTS, label: 'Todas as contas' },
      ...((accounts ?? [])
        .filter((account) => account.active)
        .map((account) => ({ value: account.id, label: account.name, meta: account.currency })))
    ],
    [accounts]
  );

  const loadSuggestions = useCallback(async (moveId: string) => {
    setLoadingSuggestions(true);
    setSuggestions([]);
    setError('');

    try {
      const response = await fetch(`/api/bank/moves/${moveId}/suggestions`);
      const payload = await response.json();

      if (!response.ok) {
        setError(readApiError(payload, 'Erro ao carregar sugestoes'));
        return;
      }

      setSuggestions(payload);
    } catch {
      setError('Erro ao carregar sugestoes');
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    if (selectedMoveId && moves.length > 0 && !moves.some((move) => move.id === selectedMoveId)) {
      setSelectedMoveId(null);
      setSuggestions([]);
    }
  }, [moves, selectedMoveId]);

  function handleSelectMove(moveId: string) {
    setSelectedMoveId(moveId);
    void loadSuggestions(moveId);
  }

  async function handleReconcile(suggestion: Suggestion) {
    if (!selectedMoveId) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/bank/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankMoveId: selectedMoveId,
          transactionId: suggestion.transactionId,
          installmentId: suggestion.installmentId
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(readApiError(payload, 'Erro ao conciliar'));
        return;
      }

      setSelectedMoveId(null);
      setSuggestions([]);
      await refetchMoves();
    } catch {
      setError('Erro ao conciliar');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIgnore() {
    if (!selectedMoveId) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/bank/moves/${selectedMoveId}/ignore`, { method: 'POST' });
      const payload = await response.json();

      if (!response.ok) {
        setError(readApiError(payload, 'Erro ao ignorar movimento'));
        return;
      }

      setSelectedMoveId(null);
      setSuggestions([]);
      await refetchMoves();
    } catch {
      setError('Erro ao ignorar movimento');
    } finally {
      setSubmitting(false);
    }
  }

  const unreconciledCount = summaryCount(summary, 'unreconciled');
  const reconciledCount = summaryCount(summary, 'reconciled');
  const ignoredCount = summaryCount(summary, 'ignored');

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Conciliacao bancaria</h1>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="font-medium text-amber-600">{unreconciledCount} pendentes</span>
            <span className="text-emerald-600">{reconciledCount} conciliados</span>
            <span>{ignoredCount} ignorados</span>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="w-56">
          <SearchableSelect
            options={accountOptions}
            value={bankAccountId || ALL_ACCOUNTS}
            onChange={(value) => setBankAccountId(value === ALL_ACCOUNTS ? '' : value)}
            placeholder="Todas as contas"
            allowEmpty={false}
          />
        </div>
        <Input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="h-10 w-40" />
        <Input
          placeholder="Buscar movimento"
          value={searchFilter}
          onChange={(event) => setSearchFilter(event.target.value)}
          className="h-10 max-w-xs"
        />
      </div>

      {error ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex w-2/5 min-w-[320px] flex-col border-r border-gray-200">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Movimentos do banco ({moves.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingMoves ? (
              <div className="py-12 text-center text-sm text-gray-400">Carregando movimentos...</div>
            ) : moves.length === 0 ? (
              <EmptyState
                icon={<ListChecks className="h-9 w-9" />}
                title="Nenhum movimento pendente"
                description="Movimentos nao conciliados de extratos importados aparecem aqui."
              />
            ) : (
              moves.map((move) => (
                <BankMoveCard key={move.id} move={move} isSelected={selectedMoveId === move.id} onClick={() => handleSelectMove(move.id)} />
              ))
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {!selectedMove ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-gray-400">Selecione um movimento para ver sugestoes</p>
            </div>
          ) : (
            <>
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
                <p className="truncate text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Sugestoes para:{' '}
                  <span className="font-medium normal-case text-gray-700">{selectedMove.merchantName ?? selectedMove.description}</span>
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{selectedMove.merchantName ?? selectedMove.description}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{formatDate(selectedMove.date)}</p>
                    </div>
                    <p className={selectedMove.type === 'credit' ? 'text-sm font-semibold text-emerald-600' : 'text-sm font-semibold text-red-600'}>
                      {selectedMove.type === 'credit' ? '+' : '-'}
                      {formatCurrency(Number(selectedMove.originalAmount), selectedMove.originalCurrency)}
                    </p>
                  </div>
                </div>

                {loadingSuggestions ? (
                  <div className="py-8 text-center text-sm text-gray-400">Carregando sugestoes...</div>
                ) : suggestions.length > 0 ? (
                  suggestions.map((suggestion) => (
                    <SuggestionCard
                      key={`${suggestion.transactionId ?? 'tx'}-${suggestion.installmentId ?? 'inst'}-${suggestion.description}`}
                      suggestion={suggestion}
                      disabled={submitting}
                      onReconcile={() => void handleReconcile(suggestion)}
                    />
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-gray-200 bg-white py-8 text-center text-sm text-gray-400">
                    Nenhuma sugestao encontrada.
                  </div>
                )}

                <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                  <Button type="button" variant="outline" className="h-10 w-full justify-start gap-2" onClick={() => setCreateModalOpen(true)}>
                    <PlusCircle className="h-4 w-4 text-emerald-600" />
                    Criar lancamento deste movimento
                  </Button>
                  <Button type="button" variant="ghost" className="h-10 w-full justify-start gap-2" onClick={() => void handleIgnore()} disabled={submitting}>
                    <Ban className="h-4 w-4 text-gray-500" />
                    Marcar como ignorado
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedMove ? (
        <CreateFromMoveModal
          move={selectedMove}
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => {
            setCreateModalOpen(false);
            setSelectedMoveId(null);
            setSuggestions([]);
            void refetchMoves();
          }}
        />
      ) : null}
    </div>
  );
}

function CreateFromMoveModal({
  move,
  open,
  onClose,
  onCreated
}: {
  move: BankMove;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [description, setDescription] = useState(move.merchantName ?? move.description);
  const [categoryId, setCategoryId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [contactId, setContactId] = useState('');
  const [competenceDate, setCompetenceDate] = useState(move.date.slice(0, 10));
  const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
  const categoryType = move.type === 'credit' ? 'revenue' : 'expense';

  const { data: categories, refetch: refetchCategories } = useFetch<CategoryOption[]>(`/api/categories?type=${categoryType}`);
  const { data: dreNodes } = useFetch<DRENodeOption[]>('/api/dre-nodes?includeSubtotals=false');
  const { data: costCenters } = useFetch<CostCenterOption[]>('/api/cost-centers');
  const { data: contacts } = useFetch<ContactOption[]>('/api/contacts');

  useEffect(() => {
    if (!open) return;
    setError('');
    setDescription(move.merchantName ?? move.description);
    setCategoryId('');
    setCostCenterId('');
    setContactId('');
    setCompetenceDate(move.date.slice(0, 10));
    setQuickCategoryOpen(false);
  }, [move, open]);

  async function saveQuickCategory(data: Record<string, unknown>) {
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const payload = await readJson(response);

    if (!response.ok) {
      throw new Error(readApiError(payload, 'Erro ao salvar categoria.'));
    }

    const createdId = getCreatedId(payload);
    await refetchCategories();

    if (createdId) {
      setCategoryId(createdId);
    }

    setQuickCategoryOpen(false);
  }

  async function handleCreate() {
    if (!categoryId || !costCenterId) {
      setError('Categoria e centro de custo sao obrigatorios');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/bank/moves/${move.id}/create-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          categoryId,
          costCenterId,
          contactId: contactId || null,
          competenceDate
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(readApiError(payload, 'Erro ao criar lancamento'));
        return;
      }

      onCreated();
    } catch {
      setError('Erro ao criar lancamento');
    } finally {
      setLoading(false);
    }
  }

  const categoryOptions = (categories ?? [])
    .filter((category) => !category.deprecatedAt)
    .map((category) => ({ value: category.id, label: category.name, meta: category.dreNode?.name }));
  const costCenterOptions = (costCenters ?? [])
    .filter((costCenter) => costCenter.active)
    .map((costCenter) => ({ value: costCenter.id, label: costCenter.name }));
  const contactOptions = (contacts ?? [])
    .filter((contact) => contact.active)
    .map((contact) => ({ value: contact.id, label: contact.name }));

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Criar lancamento"
        description={`Movimento: ${move.description}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-md bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-600">{formatDate(move.date)}</span>
              <span className={move.type === 'credit' ? 'text-base font-semibold text-emerald-600' : 'text-base font-semibold text-red-600'}>
                {move.type === 'credit' ? '+' : '-'}
                {formatCurrency(Number(move.originalAmount), move.originalCurrency)}
              </span>
            </div>
          </div>

          <FormField id="description" label="Descricao" required>
            <Input id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
          </FormField>

          <FormField id="competenceDate" label="Data de competencia" required>
            <Input id="competenceDate" type="date" value={competenceDate} onChange={(event) => setCompetenceDate(event.target.value)} />
          </FormField>

          <FormField id="category" label="Categoria" required>
            <SearchableSelect
              options={categoryOptions}
              value={categoryId}
              onChange={setCategoryId}
              placeholder={`Buscar categoria de ${move.type === 'credit' ? 'receita' : 'despesa'}`}
              allowEmpty={false}
              actionLabel="Adicionar categoria"
              onAction={() => setQuickCategoryOpen(true)}
            />
          </FormField>

          <FormField id="costCenter" label="Centro de custo" required>
            <SearchableSelect
              options={costCenterOptions}
              value={costCenterId}
              onChange={setCostCenterId}
              placeholder="Buscar centro de custo"
              allowEmpty={false}
            />
          </FormField>

          <FormField id="contact" label="Contato">
            <SearchableSelect options={contactOptions} value={contactId} onChange={setContactId} placeholder="Buscar contato" />
          </FormField>

          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={loading || !categoryId || !costCenterId} onClick={() => void handleCreate()}>
              {loading ? 'Criando...' : 'Criar e conciliar'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={quickCategoryOpen} onClose={() => setQuickCategoryOpen(false)} title="Nova categoria">
        <QuickCategoryForm
          key={categoryType}
          transactionType={categoryType}
          dreNodes={dreNodes ?? []}
          onCancel={() => setQuickCategoryOpen(false)}
          onSave={saveQuickCategory}
        />
      </Modal>
    </>
  );
}
