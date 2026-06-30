'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createCategorySchema } from '@/lib/validations/settings.schema';

export type QuickCategoryType = 'revenue' | 'expense';

export interface DRENodeOption {
  id: string;
  name: string;
  code: string;
  sign: number;
  type: string;
}

interface QuickCategoryFormProps {
  transactionType: QuickCategoryType;
  dreNodes: DRENodeOption[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

const QUICK_CASHFLOW_GROUPS = [
  { value: 'operating_inflow', label: 'Entrada Operacional', type: 'revenue' },
  { value: 'investing_inflow', label: 'Entrada Investimento', type: 'revenue' },
  { value: 'financing_inflow', label: 'Entrada Financiamento', type: 'revenue' },
  { value: 'operating_outflow', label: 'Saida Operacional', type: 'expense' },
  { value: 'investing_outflow', label: 'Saida Investimento', type: 'expense' },
  { value: 'financing_outflow', label: 'Saida Financiamento', type: 'expense' }
] as const;

const QUICK_CATEGORY_COLOR: Record<QuickCategoryType, string> = {
  revenue: '#10b981',
  expense: '#ef4444'
};

export function QuickCategoryForm({ transactionType, dreNodes, onSave, onCancel }: QuickCategoryFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const availableDreNodes = useMemo(() => dreNodes.filter((node) => (transactionType === 'revenue' ? node.sign > 0 : node.sign < 0)), [dreNodes, transactionType]);
  const cashflowGroups = QUICK_CASHFLOW_GROUPS.filter((group) => group.type === transactionType);
  const defaultDreNodeId = availableDreNodes[0]?.id ?? '';
  const defaultCashflowGroup = cashflowGroups[0]?.value ?? (transactionType === 'revenue' ? 'operating_inflow' : 'operating_outflow');

  const { register, handleSubmit, setValue, watch } = useForm<Record<string, string>>({
    defaultValues: {
      name: '',
      dreNodeId: defaultDreNodeId,
      cashflowGroup: defaultCashflowGroup,
      color: QUICK_CATEGORY_COLOR[transactionType]
    }
  });

  const selectedDreNodeId = watch('dreNodeId');

  useEffect(() => {
    if (!selectedDreNodeId && defaultDreNodeId) {
      setValue('dreNodeId', defaultDreNodeId);
    }
  }, [defaultDreNodeId, selectedDreNodeId, setValue]);

  async function onSubmit(values: Record<string, string>) {
    if (!availableDreNodes.some((node) => node.id === values.dreNodeId)) {
      setError('Selecione uma linha DRE valida.');
      return;
    }

    const parsed = createCategorySchema.safeParse({
      name: values.name,
      type: transactionType,
      dreNodeId: values.dreNodeId,
      cashflowGroup: values.cashflowGroup || defaultCashflowGroup,
      parentId: null,
      color: values.color || QUICK_CATEGORY_COLOR[transactionType],
      icon: null
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
      setError(err instanceof Error ? err.message : 'Erro ao salvar categoria.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <FormField id="quick-cat-name" label="Nome" required>
        <Input id="quick-cat-name" placeholder={transactionType === 'revenue' ? 'Ex: Receita de Servicos' : 'Ex: Software e Api'} {...register('name')} />
      </FormField>

      <FormField id="quick-cat-dre-node" label="Linha DRE" required>
        <Select id="quick-cat-dre-node" disabled={availableDreNodes.length === 0} {...register('dreNodeId')}>
          {availableDreNodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.code} - {node.name}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="quick-cat-cashflow" label="Grupo no fluxo" required>
          <Select id="quick-cat-cashflow" {...register('cashflowGroup')}>
            {cashflowGroups.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="quick-cat-color" label="Cor">
          <Input id="quick-cat-color" type="color" className="h-10" {...register('color')} />
        </FormField>
      </div>

      {availableDreNodes.length === 0 ? <p className="text-sm text-gray-500">Nenhuma linha DRE disponivel para este tipo.</p> : null}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading || availableDreNodes.length === 0}>
          {loading ? 'Criando...' : 'Criar categoria'}
        </Button>
      </div>
    </form>
  );
}
