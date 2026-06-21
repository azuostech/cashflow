'use client';

import { useEffect, useMemo, useState } from 'react';
import { DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { EvolutionChart, EvolutionPoint } from '@/components/dashboard/EvolutionChart';
import { TransactionRow, TransactionView } from '@/components/transactions/TransactionRow';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { currentMonth, monthRange } from '@/lib/utils/date';
import { formatDateBR } from '@/lib/utils/format';

interface DailyReportData {
  initialBalance: number;
  finalBalance: number;
  totalIn: number;
  totalOut: number;
  variation: number;
  dailyBalance: EvolutionPoint[];
  transactions: TransactionView[];
  period: {
    startDate: string;
    endDate: string;
  };
}

interface CategoryOption {
  id: string;
  name: string;
  color: string;
  type: 'income' | 'expense';
}

interface StatementSummary {
  period_start: string;
  period_end: string;
}

const categoryColors = ['#E24B4A', '#639922', '#D85A30', '#BA7517', '#378ADD', '#993556', '#1D9E75'];

function formatPtDate(date: string): string {
  return formatDateBR(date);
}

export default function FluxoDiarioPage() {
  const defaultRange = monthRange(currentMonth());

  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [includeHidden, setIncludeHidden] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [data, setData] = useState<DailyReportData | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingCategoryFor, setSavingCategoryFor] = useState<string | null>(null);
  const [savingHiddenFor, setSavingHiddenFor] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense');
  const [newCategoryColor, setNewCategoryColor] = useState('#E24B4A');

  async function loadCategories() {
    const response = await fetch('/api/categories/list', { cache: 'no-store' });
    const payload = await response.json();
    setCategories(Array.isArray(payload) ? payload : []);
  }

  async function loadDailyReport(signal?: AbortSignal) {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      startDate,
      endDate,
      type: typeFilter,
      category: categoryFilter,
      search: searchFilter,
      includeHidden: includeHidden ? 'true' : 'false'
    });

    const response = await fetch(`/api/reports/daily?${params.toString()}`, {
      signal,
      cache: 'no-store'
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? 'Falha ao carregar fluxo diario.');
      setData(null);
      setLoading(false);
      return;
    }

    setData(payload);
    setLoading(false);
  }

  useEffect(() => {
    const controller = new AbortController();

    loadDailyReport(controller.signal).catch((requestError) => {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      setLoading(false);
      setError('Falha ao carregar fluxo diario.');
      setData(null);
    });

    return () => controller.abort();
  }, [startDate, endDate, typeFilter, categoryFilter, searchFilter, includeHidden]);

  useEffect(() => {
    loadCategories().catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    async function loadLatestStatementPeriod() {
      const response = await fetch('/api/statements/list', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);

      const statements = Array.isArray(payload?.statements) ? (payload.statements as StatementSummary[]) : [];
      const latest = statements[0];

      if (latest?.period_start && latest?.period_end) {
        setStartDate(latest.period_start);
        setEndDate(latest.period_end);
      }
    }

    loadLatestStatementPeriod().catch(() => null);
  }, []);

  useEffect(() => {
    if (!selectedDate || !data?.dailyBalance.some((point) => point.date === selectedDate)) {
      setSelectedDate(null);
    }
  }, [data, selectedDate]);

  const displayedTransactions = useMemo(() => {
    if (!data) return [];
    if (!selectedDate) return data.transactions;

    return data.transactions.filter((transaction) => transaction.date === selectedDate);
  }, [data, selectedDate]);

  async function handleTransactionCategoryChange(transactionId: string, categoryId: string | null) {
    setSavingCategoryFor(transactionId);

    await fetch(`/api/transactions/${transactionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId })
    });

    await loadDailyReport();
    setSavingCategoryFor(null);
  }

  async function handleTransactionHiddenChange(transactionId: string, isHidden: boolean) {
    setSavingHiddenFor(transactionId);

    const response = await fetch(`/api/transactions/${transactionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_hidden: isHidden })
    });

    if (!response.ok) {
      setError('Falha ao atualizar status da transacao.');
      setSavingHiddenFor(null);
      return;
    }

    await loadDailyReport();
    setSavingHiddenFor(null);
  }

  async function createQuickCategory() {
    if (!newCategoryName.trim()) return;

    setCreatingCategory(true);

    const response = await fetch('/api/categories/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newCategoryName.trim(),
        type: newCategoryType,
        color: newCategoryColor,
        keywords: []
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error ?? 'Falha ao criar categoria.');
      setCreatingCategory(false);
      return;
    }

    setNewCategoryName('');
    setNewCategoryType('expense');
    setNewCategoryColor('#E24B4A');

    await loadCategories();
    setCreatingCategory(false);
  }

  const listTitle = selectedDate
    ? `Transacoes do dia ${formatPtDate(selectedDate)}`
    : `Transacoes do periodo (${formatPtDate(startDate)} a ${formatPtDate(endDate)})`;

  return (
    <section>
      <Header title="Fluxo de Caixa Diario" subtitle="Analise diaria com filtros, grafico e categorizacao direta." />

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-app-subtle">Data inicio</label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-app-subtle">Data fim</label>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-app-subtle">Tipo</label>
            <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">Todas</option>
              <option value="credit">Entradas</option>
              <option value="debit">Saidas</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-app-subtle">Categoria</label>
            <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">Todas categorias</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-app-subtle">Busca</label>
            <Input placeholder="Buscar descricao" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setSelectedDate(null)} disabled={!selectedDate}>
            Limpar selecao do grafico
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const range = monthRange(currentMonth());
              setStartDate(range.start);
              setEndDate(range.end);
              setTypeFilter('all');
              setCategoryFilter('');
              setSearchFilter('');
              setIncludeHidden(false);
              setSelectedDate(null);
            }}
          >
            Voltar para mes atual
          </Button>
          <label className="inline-flex items-center gap-2 rounded-lg border border-app-border bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={includeHidden}
              onChange={(event) => setIncludeHidden(event.target.checked)}
              aria-label="Mostrar lancamentos desabilitados"
            />
            Mostrar desabilitados
          </label>
        </div>
        <p className="mt-2 text-xs text-app-subtle">Lancamentos desabilitados nao entram nos totais e graficos do periodo.</p>
      </Card>

      <Card className="mb-6">
        <h3 className="mb-3 text-lg font-semibold">Criar categoria rapida</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            placeholder="Nome da categoria"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
          />
          <Select value={newCategoryType} onChange={(event) => setNewCategoryType(event.target.value as 'income' | 'expense')}>
            <option value="expense">Saida</option>
            <option value="income">Entrada</option>
          </Select>
          <Select value={newCategoryColor} onChange={(event) => setNewCategoryColor(event.target.value)}>
            {categoryColors.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </Select>
          <Button type="button" onClick={createQuickCategory} disabled={creatingCategory}>
            {creatingCategory ? 'Criando...' : 'Criar categoria'}
          </Button>
        </div>
      </Card>

      {error ? <p className="mb-4 rounded-lg border border-danger/30 bg-red-50 p-3 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="mb-4 text-sm text-app-subtle">Carregando dados...</p> : null}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Saldo inicial" value={data?.initialBalance ?? 0} icon={<Wallet className="h-4 w-4 text-primary" />} />
        <StatCard title="Entradas" value={data?.totalIn ?? 0} icon={<TrendingUp className="h-4 w-4 text-success" />} />
        <StatCard title="Saidas" value={data?.totalOut ?? 0} icon={<TrendingDown className="h-4 w-4 text-danger" />} />
        <StatCard title="Saldo final" value={data?.finalBalance ?? 0} icon={<DollarSign className="h-4 w-4 text-secondary" />} />
      </div>

      <div className="mb-6">
        <EvolutionChart
          data={data?.dailyBalance ?? []}
          selectedDate={selectedDate}
          onSelectDate={(date) => setSelectedDate((current) => (current === date ? null : date))}
        />
      </div>

      <Card>
        <h3 className="mb-4 text-lg font-semibold">{listTitle}</h3>
        <div className="space-y-2">
          {displayedTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className={savingCategoryFor === transaction.id || savingHiddenFor === transaction.id ? 'opacity-60' : ''}
            >
              <TransactionRow
                transaction={transaction}
                editableCategories={categories.map((category) => ({ id: category.id, name: category.name }))}
                onCategoryChange={handleTransactionCategoryChange}
                onHiddenChange={handleTransactionHiddenChange}
              />
            </div>
          ))}

          {displayedTransactions.length === 0 ? <p className="text-sm text-app-subtle">Sem transacoes para o periodo.</p> : null}
        </div>
      </Card>
    </section>
  );
}
