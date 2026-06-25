'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/form-field';
import { Modal } from '@/components/shared/modal';
import { TypeBadge } from '@/components/shared/type-badge';
import { useFetch } from '@/hooks/use-fetch';
import { createCategorySchema, updateCategorySchema } from '@/lib/validations/settings.schema';

interface DRENode {
  id: string;
  name: string;
  code: string;
  sign: number;
  type: string;
}

interface Category {
  id: string;
  name: string;
  type: 'revenue' | 'expense' | 'transfer';
  dreNodeId: string;
  cashflowGroup: string;
  parentId: string | null;
  color: string | null;
  icon: string | null;
  deprecatedAt: string | null;
}

const DRE_TYPE_LABELS: Record<string, string> = {
  revenue: 'Receita',
  deduction: 'Deducao',
  variable_cost: 'Custo Variavel',
  fixed_cost: 'Despesa Fixa',
  financial: 'Financeiro',
  tax: 'Imposto',
  profit_distribution: 'Distribuicao',
  depreciation: 'Depreciacao'
};

const CASHFLOW_GROUPS = [
  { value: 'operating_inflow', label: 'Entrada Operacional' },
  { value: 'operating_outflow', label: 'Saida Operacional' },
  { value: 'investing_inflow', label: 'Entrada Investimento' },
  { value: 'investing_outflow', label: 'Saida Investimento' },
  { value: 'financing_inflow', label: 'Entrada Financiamento' },
  { value: 'financing_outflow', label: 'Saida Financiamento' },
  { value: 'transfer', label: 'Transferencia' }
];

export default function ChartOfAccountsSettingsPage() {
  const { data: dreNodes } = useFetch<DRENode[]>('/api/dre-nodes?includeSubtotals=false');
  const { data: categories, refetch } = useFetch<Category[]>('/api/categories?includeDeprecated=true');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showDeprecated, setShowDeprecated] = useState(false);
  const [createFor, setCreateFor] = useState<{ node: DRENode; parent?: Category } | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [apiError, setApiError] = useState('');

  function toggleCollapse(id: string) {
    setCollapsed((previous) => {
      const next = new Set(Array.from(previous));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function categoriesForNode(dreNodeId: string, parentId: string | null = null) {
    return (categories ?? []).filter(
      (category) => category.dreNodeId === dreNodeId && category.parentId === parentId && (showDeprecated || !category.deprecatedAt)
    );
  }

  async function saveCategory(data: Record<string, unknown>, id?: string) {
    const response = await fetch(id ? `/api/categories/${id}` : '/api/categories', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error ?? 'Erro ao salvar categoria.');
    }

    await refetch();
    setCreateFor(null);
    setEditing(null);
  }

  async function deprecateCategory(id: string) {
    if (!window.confirm('Deprecar esta categoria? Ela nao aparecera em novos lancamentos.')) return;

    setApiError('');
    const response = await fetch(`/api/categories/${id}/deprecate`, { method: 'POST' });
    const result = await response.json();

    if (!response.ok) {
      setApiError(result.error ?? 'Erro ao deprecar categoria.');
      return;
    }

    await refetch();
  }

  function renderCategory(category: Category, depth = 0) {
    const children = categoriesForNode(category.dreNodeId, category.id);

    return (
      <div key={category.id}>
        <div className={['flex items-center gap-3 px-6 py-2.5', category.deprecatedAt ? 'opacity-50' : ''].join(' ')} style={{ paddingLeft: 24 + depth * 24 }}>
          <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: category.color ?? '#d1d5db' }} />
          <span className={['flex-1 text-sm text-gray-800', category.deprecatedAt ? 'line-through' : ''].join(' ')}>{category.name}</span>
          <TypeBadge type={category.type} />
          {category.deprecatedAt ? <TypeBadge type="deprecated" /> : null}
          {!category.deprecatedAt ? (
            <div className="flex gap-2">
              <button type="button" className="text-xs text-emerald-600 hover:underline" onClick={() => setCreateFor({ node: dreNodes!.find((node) => node.id === category.dreNodeId)!, parent: category })}>
                Subcategoria
              </button>
              <button type="button" className="text-xs text-gray-500 hover:text-gray-700" onClick={() => setEditing(category)}>
                Editar
              </button>
              <button type="button" className="text-xs text-red-500 hover:text-red-700" onClick={() => deprecateCategory(category.id)}>
                Deprecar
              </button>
            </div>
          ) : null}
        </div>
        {children.map((child) => renderCategory(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Plano de contas</h1>
          <p className="mt-1 text-sm text-gray-500">Categorias sao vinculadas a estrutura DRE. DRENodes sao somente leitura no MVP.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500">
          <input type="checkbox" checked={showDeprecated} onChange={(event) => setShowDeprecated(event.target.checked)} />
          Mostrar depreciadas
        </label>
      </div>

      {apiError ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{apiError}</div> : null}

      <div className="space-y-2">
        {(dreNodes ?? []).map((node) => {
          const nodeCategories = categoriesForNode(node.id);
          const isCollapsed = collapsed.has(node.id);

          return (
            <div key={node.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <button type="button" className="flex w-full items-center gap-3 bg-gray-50 px-4 py-3 text-left" onClick={() => toggleCollapse(node.id)}>
                <span className="w-10 font-mono text-xs text-gray-400">{node.code}</span>
                <span className={['h-2 w-2 flex-shrink-0 rounded-full', node.sign > 0 ? 'bg-emerald-500' : 'bg-red-500'].join(' ')} />
                <span className="flex-1 text-sm font-medium text-gray-800">{node.name}</span>
                <span className="text-xs text-gray-400">{DRE_TYPE_LABELS[node.type] ?? node.type}</span>
                <span className="text-xs text-gray-400">{isCollapsed ? '+' : '-'}</span>
              </button>

              {!isCollapsed ? (
                <div className="divide-y divide-gray-100">
                  {nodeCategories.length === 0 ? <p className="px-6 py-3 text-xs italic text-gray-400">Nenhuma categoria neste no.</p> : null}
                  {nodeCategories.map((category) => renderCategory(category))}
                  <div className="px-6 py-2">
                    <button type="button" className="text-xs text-emerald-600 hover:underline" onClick={() => setCreateFor({ node })}>
                      Nova categoria em {node.name}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Modal open={!!createFor} onClose={() => setCreateFor(null)} title={createFor?.parent ? 'Nova subcategoria' : 'Nova categoria'}>
        {createFor ? (
          <CategoryForm
            dreNode={createFor.node}
            parent={createFor.parent}
            onCancel={() => setCreateFor(null)}
            onSave={(data) => saveCategory(data)}
          />
        ) : null}
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar categoria">
        {editing ? (
          <CategoryEditForm
            category={editing}
            onCancel={() => setEditing(null)}
            onSave={(data) => saveCategory(data, editing.id)}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function CategoryForm({
  dreNode,
  parent,
  onSave,
  onCancel
}: {
  dreNode: DRENode;
  parent?: Category;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit } = useForm<Record<string, string>>({
    defaultValues: {
      name: '',
      type: dreNode.sign > 0 ? 'revenue' : 'expense',
      cashflowGroup: dreNode.sign > 0 ? 'operating_inflow' : 'operating_outflow',
      color: '#10b981',
      icon: ''
    }
  });

  async function onSubmit(values: Record<string, string>) {
    const parsed = createCategorySchema.safeParse({
      ...values,
      dreNodeId: dreNode.id,
      parentId: parent?.id ?? null,
      color: values.color || null,
      icon: values.icon || null
    });

    if (!parsed.success) {
      setError('Revise os campos antes de salvar.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSave(parsed.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {parent ? <p className="text-sm text-gray-500">Subcategoria de {parent.name}</p> : null}
      <FormField id="cat-name" label="Nome" required>
        <Input id="cat-name" placeholder="Ex: Receita de Servicos" {...register('name')} />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="cat-type" label="Tipo">
          <Select id="cat-type" {...register('type')}>
            <option value="revenue">Receita</option>
            <option value="expense">Despesa</option>
            <option value="transfer">Transferencia</option>
          </Select>
        </FormField>
        <FormField id="cat-color" label="Cor">
          <Input id="cat-color" type="color" className="h-10" {...register('color')} />
        </FormField>
      </div>
      <FormField id="cat-cashflow" label="Grupo no Fluxo de Caixa">
        <Select id="cat-cashflow" {...register('cashflowGroup')}>
          {CASHFLOW_GROUPS.map((group) => (
            <option key={group.value} value={group.value}>
              {group.label}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Criando...' : 'Criar categoria'}
        </Button>
      </div>
    </form>
  );
}

function CategoryEditForm({
  category,
  onSave,
  onCancel
}: {
  category: Category;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit } = useForm<Record<string, string>>({
    defaultValues: {
      name: category.name,
      color: category.color ?? '#10b981',
      icon: category.icon ?? ''
    }
  });

  async function onSubmit(values: Record<string, string>) {
    const parsed = updateCategorySchema.safeParse({
      name: values.name,
      color: values.color || null,
      icon: values.icon || null
    });

    if (!parsed.success) {
      setError('Revise os campos antes de salvar.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSave(parsed.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <FormField id="edit-cat-name" label="Nome" required>
        <Input id="edit-cat-name" {...register('name')} />
      </FormField>
      <FormField id="edit-cat-color" label="Cor">
        <Input id="edit-cat-color" type="color" className="h-10" {...register('color')} />
      </FormField>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
