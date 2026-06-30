'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createCostCenterSchema } from '@/lib/validations/settings.schema';

export interface QuickCostCenterOption {
  id: string;
  name: string;
}

interface QuickCostCenterFormProps {
  costCenters: QuickCostCenterOption[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export function QuickCostCenterForm({ costCenters, onSave, onCancel }: QuickCostCenterFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit } = useForm<Record<string, string>>({
    defaultValues: {
      name: '',
      code: '',
      parentId: ''
    }
  });

  async function onSubmit(values: Record<string, string>) {
    const parsed = createCostCenterSchema.safeParse({
      name: values.name,
      code: values.code || null,
      parentId: values.parentId || null
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
      setError(err instanceof Error ? err.message : 'Erro ao salvar centro de custo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <FormField id="quick-cc-name" label="Nome" required>
        <Input id="quick-cc-name" placeholder="Ex: Comercial" {...register('name')} />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="quick-cc-code" label="Codigo">
          <Input id="quick-cc-code" placeholder="Ex: CC001" {...register('code')} />
        </FormField>
        <FormField id="quick-cc-parent" label="Centro de custo pai">
          <Select id="quick-cc-parent" {...register('parentId')}>
            <option value="">Sem pai</option>
            {costCenters.map((costCenter) => (
              <option key={costCenter.id} value={costCenter.id}>
                {costCenter.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Criando...' : 'Criar centro'}
        </Button>
      </div>
    </form>
  );
}
