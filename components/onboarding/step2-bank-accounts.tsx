'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/form-field';
import { InitialBalanceStep } from '@/components/onboarding/initial-balance-step';
import {
  onboardingBankAccountSchema,
  type OnboardingBankAccountFormInput,
  type OnboardingBankAccountInput
} from '@/lib/validations/onboarding.schema';

interface BankProvider {
  id: string;
  name: string;
  country: string;
  defaultCurrency: string;
}

interface BankAccount {
  id: string;
  name: string;
  type: string;
  currency: string;
}

interface OnboardingStep2BankAccountsProps {
  companyId: string | null;
  onComplete: () => void;
  onBack: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  checking: 'Conta Corrente',
  savings: 'Poupanca',
  cash: 'Caixa',
  digital: 'Conta Digital',
  investment: 'Investimento'
};

function today() {
  return new Date().toISOString().split('T')[0];
}

export function OnboardingStep2BankAccounts({ onComplete, onBack }: OnboardingStep2BankAccountsProps) {
  const [providers, setProviders] = useState<BankProvider[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid }
  } = useForm<OnboardingBankAccountFormInput, unknown, OnboardingBankAccountInput>({
    resolver: zodResolver(onboardingBankAccountSchema),
    mode: 'onChange',
    defaultValues: {
      currency: 'BRL',
      type: 'checking',
      initialBalance: 0,
      initialBalanceDate: today()
    }
  });

  useEffect(() => {
    async function loadData() {
      const [providerResponse, accountResponse] = await Promise.all([
        fetch('/api/bank-providers'),
        fetch('/api/bank-accounts')
      ]);

      if (providerResponse.ok) {
        setProviders(await providerResponse.json());
      }

      if (accountResponse.ok) {
        setAccounts(await accountResponse.json());
      }
    }

    void loadData();
  }, []);

  async function onAddAccount(data: OnboardingBankAccountInput) {
    setLoading(true);
    setServerError('');

    const response = await fetch('/api/bank-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      setServerError('Erro ao salvar conta bancaria.');
      setLoading(false);
      return;
    }

    const account: BankAccount = await response.json();
    setAccounts((previous) => [...previous, account]);
    reset({ currency: 'BRL', type: 'checking', initialBalance: 0, initialBalanceDate: today() });
    setLoading(false);
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Contas bancarias</h2>
      <p className="mb-6 text-sm text-gray-500">
        Adicione as contas onde a empresa movimenta dinheiro. <span className="text-gray-400">Pode adicionar mais depois.</span>
      </p>

      {accounts.length > 0 ? (
        <div className="mb-5 space-y-2">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5">
              <div>
                <span className="text-sm font-medium text-gray-900">{account.name}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {TYPE_LABELS[account.type]} / {account.currency}
                </span>
              </div>
              <span className="text-xs text-emerald-700">adicionada</span>
            </div>
          ))}
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onAddAccount)} className="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {accounts.length === 0 ? 'Primeira conta' : 'Adicionar outra conta'}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="acc-name" label="Nome da conta" error={errors.name?.message} required>
            <Input id="acc-name" placeholder="Ex: Nubank Corrente" {...register('name')} />
          </FormField>

          <FormField id="acc-type" label="Tipo" error={errors.type?.message} required>
            <Select id="acc-type" {...register('type')}>
              <option value="checking">Conta Corrente</option>
              <option value="savings">Poupanca</option>
              <option value="cash">Caixa Fisico</option>
              <option value="digital">Conta Digital</option>
              <option value="investment">Investimento</option>
            </Select>
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="acc-currency" label="Moeda" error={errors.currency?.message} required>
            <Select id="acc-currency" {...register('currency')}>
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
            </Select>
          </FormField>

          <FormField id="acc-balance" label="Saldo inicial" error={errors.initialBalance?.message}>
            <Input id="acc-balance" type="number" step="0.01" placeholder="0,00" {...register('initialBalance')} />
          </FormField>

          <FormField id="acc-balance-date" label="Data do saldo" error={errors.initialBalanceDate?.message} required>
            <Input id="acc-balance-date" type="date" {...register('initialBalanceDate')} />
          </FormField>
        </div>

        <FormField id="acc-provider" label="Banco (opcional)" error={errors.bankProviderId?.message}>
          <Select id="acc-provider" {...register('bankProviderId', { setValueAs: (value) => value || undefined })}>
            <option value="">Selecionar banco...</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name} ({provider.country})
              </option>
            ))}
          </Select>
        </FormField>

        {serverError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
        ) : null}

        <Button type="submit" variant="outline" disabled={loading || !isValid} className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50">
          {loading ? 'Adicionando...' : accounts.length === 0 ? 'Adicionar conta' : 'Adicionar outra conta'}
        </Button>
      </form>

      {accounts.length > 0 ? <InitialBalanceStep accounts={accounts} onComplete={onComplete} onSkip={onComplete} /> : null}

      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={onBack} className="text-gray-500">
          Voltar
        </Button>
        <div className="flex gap-3">
          {accounts.length === 0 ? (
            <Button type="button" variant="ghost" className="text-gray-500" onClick={() => setShowSkipConfirm(true)}>
              Pular por agora
            </Button>
          ) : null}
        </div>
      </div>

      {showSkipConfirm ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="mb-2 font-medium">Sem conta bancaria, o sistema ainda nao calcula saldos.</p>
          <p className="mb-3">Voce pode adicionar contas depois em Configuracoes / Contas Bancarias.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setShowSkipConfirm(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={onComplete} className="bg-amber-600 hover:bg-amber-700">
              Pular mesmo assim
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
