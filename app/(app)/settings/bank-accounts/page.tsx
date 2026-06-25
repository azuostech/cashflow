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
import { formatCurrency } from '@/lib/utils/currency';
import { createBankAccountSchema } from '@/lib/validations/bank-account.schema';
import { updateBankAccountSchema } from '@/lib/validations/settings.schema';

interface BankProvider {
  id: string;
  name: string;
  country: string;
}

interface BankAccount {
  id: string;
  name: string;
  type: string;
  currency: string;
  bankProviderId: string | null;
  bankProvider?: { id: string; name: string } | null;
  bankName: string | null;
  agency: string | null;
  accountNumber: string | null;
  initialBalance: string | number;
  initialBalanceDate: string;
  color: string | null;
  includeInConsolidatedCashflow: boolean;
  active: boolean;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function BankAccountsSettingsPage() {
  const { data: accounts, refetch } = useFetch<BankAccount[]>('/api/bank-accounts?active=all');
  const { data: providers } = useFetch<BankProvider[]>('/api/bank-providers');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [apiError, setApiError] = useState('');

  async function deactivate(id: string) {
    if (!window.confirm('Desativar esta conta bancaria?')) return;

    setBusyId(id);
    setApiError('');
    const response = await fetch(`/api/bank-accounts/${id}`, { method: 'DELETE' });

    if (!response.ok) {
      const data = await response.json();
      setApiError(data.error ?? 'Erro ao desativar conta bancaria.');
    } else {
      await refetch();
    }

    setBusyId(null);
  }

  async function reactivate(id: string) {
    setBusyId(id);
    setApiError('');
    const response = await fetch(`/api/bank-accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true })
    });

    if (!response.ok) {
      setApiError('Erro ao reativar conta bancaria.');
    } else {
      await refetch();
    }

    setBusyId(null);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Contas bancarias</h1>
          <p className="mt-1 text-sm text-gray-500">Gerencie as contas onde a empresa movimenta dinheiro.</p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          Nova conta
        </Button>
      </div>

      {apiError ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{apiError}</div> : null}

      {!accounts?.length ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">Nenhuma conta bancaria cadastrada.</p>
          <Button type="button" onClick={() => setCreateOpen(true)} className="mt-4">
            Adicionar primeira conta
          </Button>
        </div>
      ) : null}

      <div className="space-y-3">
        {accounts?.map((account) => (
          <div
            key={account.id}
            className={[
              'flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4',
              account.active ? '' : 'opacity-60'
            ].join(' ')}
          >
            <div className="h-10 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: account.color ?? '#d1d5db' }} />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{account.name}</span>
                <TypeBadge type={account.type} />
                <span className="text-xs text-gray-400">{account.currency}</span>
                {!account.active ? <TypeBadge type="inactive" /> : null}
              </div>
              <div className="text-xs text-gray-400">
                Saldo inicial: {formatCurrency(Number(account.initialBalance), account.currency)}
                {account.bankProvider?.name ? ` / ${account.bankProvider.name}` : ''}
                {account.accountNumber ? ` / Conta ${account.accountNumber}` : ''}
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              {account.active ? (
                <>
                  <Button type="button" variant="outline" className="h-8 px-3" onClick={() => setEditingAccount(account)}>
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 border-red-200 px-3 text-red-600 hover:bg-red-50"
                    onClick={() => deactivate(account.id)}
                    disabled={busyId === account.id}
                  >
                    Desativar
                  </Button>
                </>
              ) : (
                <Button type="button" variant="outline" className="h-8 px-3" onClick={() => reactivate(account.id)} disabled={busyId === account.id}>
                  Reativar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova conta bancaria">
        <BankAccountForm
          providers={providers ?? []}
          onCancel={() => setCreateOpen(false)}
          onSave={async (data) => {
            const response = await fetch('/api/bank-accounts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Erro ao criar conta.');
            await refetch();
            setCreateOpen(false);
          }}
        />
      </Modal>

      <Modal open={!!editingAccount} onClose={() => setEditingAccount(null)} title="Editar conta bancaria">
        {editingAccount ? (
          <BankAccountForm
            providers={providers ?? []}
            initialData={editingAccount}
            onCancel={() => setEditingAccount(null)}
            onSave={async (data) => {
              const response = await fetch(`/api/bank-accounts/${editingAccount.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });

              if (!response.ok) throw new Error('Erro ao salvar conta.');
              await refetch();
              setEditingAccount(null);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function BankAccountForm({
  providers,
  initialData,
  onSave,
  onCancel
}: {
  providers: BankProvider[];
  initialData?: BankAccount;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit } = useForm<Record<string, string | number | boolean | null>>({
    defaultValues: initialData
      ? {
          name: initialData.name,
          type: initialData.type,
          currency: initialData.currency,
          bankProviderId: initialData.bankProviderId ?? '',
          bankName: initialData.bankName ?? '',
          agency: initialData.agency ?? '',
          accountNumber: initialData.accountNumber ?? '',
          initialBalance: Number(initialData.initialBalance),
          initialBalanceDate: new Date(initialData.initialBalanceDate).toISOString().split('T')[0],
          color: initialData.color ?? '',
          includeInConsolidatedCashflow: initialData.includeInConsolidatedCashflow
        }
      : {
          name: '',
          type: 'checking',
          currency: 'BRL',
          bankProviderId: '',
          bankName: '',
          agency: '',
          accountNumber: '',
          initialBalance: 0,
          initialBalanceDate: today(),
          color: '',
          includeInConsolidatedCashflow: true
        }
  });

  async function onSubmit(values: Record<string, string | number | boolean | null>) {
    const payload = {
      ...values,
      bankProviderId: values.bankProviderId || null,
      bankName: values.bankName || null,
      agency: values.agency || null,
      accountNumber: values.accountNumber || null,
      color: values.color || null,
      includeInConsolidatedCashflow: Boolean(values.includeInConsolidatedCashflow)
    };

    const parsed = initialData ? updateBankAccountSchema.safeParse(payload) : createBankAccountSchema.safeParse(payload);

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

      <FormField id="name" label="Nome da conta" required>
        <Input id="name" placeholder="Ex: Nubank Corrente" {...register('name')} />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="type" label="Tipo" required>
          <Select id="type" {...register('type')}>
            <option value="checking">Conta Corrente</option>
            <option value="savings">Poupanca</option>
            <option value="cash">Caixa Fisico</option>
            <option value="digital">Conta Digital</option>
            <option value="investment">Investimento</option>
          </Select>
        </FormField>
        <FormField id="currency" label="Moeda" required>
          <Select id="currency" {...register('currency')}>
            <option value="BRL">BRL</option>
            <option value="USD">USD</option>
          </Select>
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="initialBalance" label="Saldo inicial">
          <Input id="initialBalance" type="number" step="0.01" {...register('initialBalance')} />
        </FormField>
        <FormField id="initialBalanceDate" label="Data do saldo" required>
          <Input id="initialBalanceDate" type="date" {...register('initialBalanceDate')} />
        </FormField>
      </div>

      <FormField id="bankProviderId" label="Banco">
        <Select id="bankProviderId" {...register('bankProviderId')}>
          <option value="">Selecionar banco...</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name} ({provider.country})
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id="bankName" label="Banco manual">
          <Input id="bankName" {...register('bankName')} />
        </FormField>
        <FormField id="agency" label="Agencia">
          <Input id="agency" {...register('agency')} />
        </FormField>
        <FormField id="accountNumber" label="Conta">
          <Input id="accountNumber" {...register('accountNumber')} />
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="color" label="Cor">
          <Input id="color" type="color" className="h-10" {...register('color')} />
        </FormField>
        <label className="flex items-center gap-2 pt-7 text-sm text-gray-600">
          <input type="checkbox" {...register('includeInConsolidatedCashflow')} />
          Incluir no fluxo consolidado
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : initialData ? 'Salvar alteracoes' : 'Adicionar conta'}
        </Button>
      </div>
    </form>
  );
}
