'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';

interface DRENode {
  id: string;
  name: string;
  code: string;
  type: string;
}

type CategoryType = 'revenue' | 'expense';
type CashflowGroup = 'operating_inflow' | 'operating_outflow';

interface CategoryDraft {
  name: string;
  type: CategoryType;
  cashflowGroup: CashflowGroup;
  dreNodeId: string;
  color: string;
}

const CATEGORY_SUGGESTIONS = [
  { name: 'Receita de Servicos', type: 'revenue' as const, cashflowGroup: 'operating_inflow' as const, dreNodeCode: '1.2', color: '#10b981' },
  { name: 'Receita de Produtos', type: 'revenue' as const, cashflowGroup: 'operating_inflow' as const, dreNodeCode: '1.1', color: '#059669' },
  { name: 'Outras Receitas', type: 'revenue' as const, cashflowGroup: 'operating_inflow' as const, dreNodeCode: '1.3', color: '#34d399' },
  { name: 'Pessoal e Encargos', type: 'expense' as const, cashflowGroup: 'operating_outflow' as const, dreNodeCode: '4.1', color: '#ef4444' },
  { name: 'Aluguel e Ocupacao', type: 'expense' as const, cashflowGroup: 'operating_outflow' as const, dreNodeCode: '4.2', color: '#f97316' },
  { name: 'Marketing e Publicidade', type: 'expense' as const, cashflowGroup: 'operating_outflow' as const, dreNodeCode: '4.3', color: '#8b5cf6' },
  { name: 'TI / Software / Ferramentas', type: 'expense' as const, cashflowGroup: 'operating_outflow' as const, dreNodeCode: '4.4', color: '#3b82f6' },
  { name: 'Despesas Administrativas', type: 'expense' as const, cashflowGroup: 'operating_outflow' as const, dreNodeCode: '4.5', color: '#6b7280' },
  { name: 'Custo dos Servicos', type: 'expense' as const, cashflowGroup: 'operating_outflow' as const, dreNodeCode: '3.2', color: '#dc2626' },
  { name: 'Tarifas Bancarias e IOF', type: 'expense' as const, cashflowGroup: 'operating_outflow' as const, dreNodeCode: '5.3', color: '#9ca3af' },
  { name: 'Impostos sobre Receita', type: 'expense' as const, cashflowGroup: 'operating_outflow' as const, dreNodeCode: '2.1', color: '#f59e0b' }
];

interface OnboardingStep4CategoriesProps {
  companyId: string | null;
  onComplete: () => void;
  onBack: () => void;
}

export function OnboardingStep4Categories({ onComplete, onBack }: OnboardingStep4CategoriesProps) {
  const [nodes, setNodes] = useState<DRENode[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(['Receita de Servicos', 'Pessoal e Encargos', 'Aluguel e Ocupacao', 'Despesas Administrativas', 'Impostos sobre Receita'])
  );
  const [customItems, setCustomItems] = useState<CategoryDraft[]>([]);
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState<CategoryType>('expense');
  const [customDreNodeId, setCustomDreNodeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadNodes() {
      const response = await fetch('/api/dre-nodes');

      if (!response.ok) {
        setError('Erro ao carregar plano DRE.');
        return;
      }

      const data: DRENode[] = await response.json();
      setNodes(data);
      setCustomDreNodeId(data[0]?.id ?? '');
    }

    void loadNodes();
  }, []);

  const revenues = useMemo(() => CATEGORY_SUGGESTIONS.filter((suggestion) => suggestion.type === 'revenue'), []);
  const expenses = useMemo(() => CATEGORY_SUGGESTIONS.filter((suggestion) => suggestion.type === 'expense'), []);

  function toggle(name: string) {
    setSelected((previous) => {
      const next = new Set(previous);

      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }

      return next;
    });
  }

  function addCustom() {
    const name = customName.trim();

    if (!name || !customDreNodeId) {
      setError('Informe o nome e o no DRE da categoria personalizada.');
      return;
    }

    setCustomItems((previous) =>
      previous.some((item) => item.name.toLowerCase() === name.toLowerCase())
        ? previous
        : [
            ...previous,
            {
              name,
              type: customType,
              cashflowGroup: customType === 'revenue' ? 'operating_inflow' : 'operating_outflow',
              dreNodeId: customDreNodeId,
              color: customType === 'revenue' ? '#10b981' : '#64748b'
            }
          ]
    );
    setCustomName('');
    setError('');
  }

  async function onFinish() {
    if (nodes.length === 0) {
      setError('Nenhum no DRE disponivel para criar categorias.');
      return;
    }

    const selectedItems = CATEGORY_SUGGESTIONS.filter((suggestion) => selected.has(suggestion.name))
      .map((suggestion) => {
        const node = nodes.find((item) => item.code === suggestion.dreNodeCode) ?? nodes[0];
        return {
          name: suggestion.name,
          type: suggestion.type,
          cashflowGroup: suggestion.cashflowGroup,
          color: suggestion.color,
          dreNodeId: node.id
        };
      });

    const items = [...selectedItems, ...customItems];

    if (items.length === 0) {
      setError('Selecione ou crie ao menos 1 categoria.');
      return;
    }

    setLoading(true);
    setError('');

    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });

    if (!response.ok) {
      setError('Erro ao salvar categorias.');
      setLoading(false);
      return;
    }

    onComplete();
  }

  function renderSuggestion(suggestion: (typeof CATEGORY_SUGGESTIONS)[number]) {
    const active = selected.has(suggestion.name);

    return (
      <button
        key={suggestion.name}
        type="button"
        onClick={() => toggle(suggestion.name)}
        className={cn(
          'flex items-center gap-2 rounded-md border p-2.5 text-left text-sm transition-colors',
          active
            ? suggestion.type === 'revenue'
              ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
              : 'border-red-300 bg-red-50 text-red-800'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
        )}
      >
        <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: suggestion.color }} />
        {suggestion.name}
      </button>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Plano de contas</h2>
      <p className="mb-6 text-sm text-gray-500">Selecione categorias para comecar. Voce pode personalizar depois.</p>

      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Receitas</p>
          <div className="grid gap-2 sm:grid-cols-2">{revenues.map(renderSuggestion)}</div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-600">Despesas</p>
          <div className="grid gap-2 sm:grid-cols-2">{expenses.map(renderSuggestion)}</div>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Categoria personalizada</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
          <Input
            placeholder="Nome da categoria"
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCustom();
              }
            }}
          />
          <Select value={customType} onChange={(event) => setCustomType(event.target.value as CategoryType)}>
            <option value="expense">Despesa</option>
            <option value="revenue">Receita</option>
          </Select>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Select value={customDreNodeId} onChange={(event) => setCustomDreNodeId(event.target.value)}>
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.code} - {node.name}
              </option>
            ))}
          </Select>
          <Button type="button" variant="outline" onClick={addCustom} disabled={!customName.trim() || !customDreNodeId}>
            Adicionar
          </Button>
        </div>

        {customItems.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {customItems.map((item) => (
              <span key={item.name} className="rounded-full bg-white px-3 py-1 text-xs text-gray-600 ring-1 ring-gray-200">
                {item.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        {selected.size + customItems.length} categoria{selected.size + customItems.length !== 1 ? 's' : ''} selecionada
        {selected.size + customItems.length !== 1 ? 's' : ''}
      </p>

      {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="mt-6 flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack} className="text-gray-500">
          Voltar
        </Button>
        <Button type="button" onClick={onFinish} disabled={loading || selected.size + customItems.length === 0} className="px-8">
          {loading ? 'Finalizando...' : 'Concluir configuracao'}
        </Button>
      </div>
    </div>
  );
}
