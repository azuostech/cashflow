'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FormField } from '@/components/shared/form-field';
import { Modal } from '@/components/shared/modal';
import { TypeBadge } from '@/components/shared/type-badge';
import { useFetch } from '@/hooks/use-fetch';
import { createCostCenterSchema, updateCostCenterSchema } from '@/lib/validations/settings.schema';

interface CostCenter {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  active: boolean;
  transactionCount?: number;
}

export default function CostCentersSettingsPage() {
  const { data: costCenters, refetch } = useFetch<CostCenter[]>('/api/cost-centers?active=all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [apiError, setApiError] = useState('');
  const allCostCenters = costCenters ?? [];
  const visible = showInactive ? allCostCenters : allCostCenters.filter((costCenter) => costCenter.active);

  function getParentName(parentId: string | null) {
    if (!parentId) return '--';
    return allCostCenters.find((costCenter) => costCenter.id === parentId)?.name ?? '--';
  }

  async function saveCostCenter(data: Record<string, unknown>, id?: string) {
    const response = await fetch(id ? `/api/cost-centers/${id}` : '/api/cost-centers', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error ?? 'Erro ao salvar centro de custo.');
    }

    await refetch();
    setCreateOpen(false);
    setEditing(null);
  }

  async function deactivate(id: string) {
    if (!window.confirm('Desativar este centro de custo?')) return;

    setApiError('');
    const response = await fetch(`/api/cost-centers/${id}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      setApiError(result.error ?? 'Erro ao desativar.');
      return;
    }

    await refetch();
  }

  async function reactivate(id: string) {
    setApiError('');
    const response = await fetch(`/api/cost-centers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true })
    });

    if (!response.ok) {
      setApiError('Erro ao reativar centro de custo.');
      return;
    }

    await refetch();
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Centros de custo</h1>
          <p className="mt-1 text-sm text-gray-500">Organize receitas e despesas por area da empresa.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500">
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            Mostrar inativos
          </label>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Novo
          </Button>
        </div>
      </div>

      {apiError ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{apiError}</div> : null}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Nome</TableHead>
              <TableHead>Codigo</TableHead>
              <TableHead>Pai</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Lancamentos</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-gray-400">
                  Nenhum centro de custo encontrado
                </TableCell>
              </TableRow>
            ) : null}
            {visible.map((costCenter) => (
              <TableRow key={costCenter.id} className={costCenter.active ? '' : 'opacity-60'}>
                <TableCell className="font-medium text-gray-900">{costCenter.name}</TableCell>
                <TableCell className="text-gray-500">{costCenter.code ?? '--'}</TableCell>
                <TableCell className="text-gray-500">{getParentName(costCenter.parentId)}</TableCell>
                <TableCell>
                  <TypeBadge type={costCenter.active ? 'active' : 'inactive'} />
                </TableCell>
                <TableCell className="text-right text-gray-500">{costCenter.transactionCount ?? 0}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {costCenter.active ? (
                      <>
                        <Button type="button" variant="outline" className="h-8 px-3" onClick={() => setEditing(costCenter)}>
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 border-red-200 px-3 text-red-600 hover:bg-red-50"
                          onClick={() => deactivate(costCenter.id)}
                        >
                          Desativar
                        </Button>
                      </>
                    ) : (
                      <Button type="button" variant="outline" className="h-8 px-3" onClick={() => reactivate(costCenter.id)}>
                        Reativar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo centro de custo">
        <CostCenterForm
          costCenters={allCostCenters.filter((costCenter) => costCenter.active)}
          onCancel={() => setCreateOpen(false)}
          onSave={(data) => saveCostCenter(data)}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar centro de custo">
        {editing ? (
          <CostCenterForm
            costCenters={allCostCenters.filter((costCenter) => costCenter.active && costCenter.id !== editing.id)}
            initialData={editing}
            onCancel={() => setEditing(null)}
            onSave={(data) => saveCostCenter(data, editing.id)}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function CostCenterForm({
  costCenters,
  initialData,
  onSave,
  onCancel
}: {
  costCenters: CostCenter[];
  initialData?: CostCenter;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit } = useForm<Record<string, string | null>>({
    defaultValues: {
      name: initialData?.name ?? '',
      code: initialData?.code ?? '',
      parentId: initialData?.parentId ?? ''
    }
  });

  async function onSubmit(values: Record<string, string | null>) {
    const payload = {
      name: values.name,
      code: values.code || null,
      parentId: values.parentId || null
    };
    const parsed = initialData ? updateCostCenterSchema.safeParse(payload) : createCostCenterSchema.safeParse(payload);

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
      <FormField id="cc-name" label="Nome" required>
        <Input id="cc-name" placeholder="Ex: Comercial" {...register('name')} />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="cc-code" label="Codigo">
          <Input id="cc-code" placeholder="Ex: CC001" {...register('code')} />
        </FormField>
        <FormField id="cc-parent" label="Centro de custo pai">
          <Select id="cc-parent" {...register('parentId')}>
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
          {loading ? 'Salvando...' : initialData ? 'Salvar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
}
