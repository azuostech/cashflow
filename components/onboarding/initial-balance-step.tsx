'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';

interface InitialBalanceStepProps {
  accounts: { id: string; name: string; currency: string }[];
  onComplete: () => void;
  onSkip: () => void;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

export function InitialBalanceStep({ accounts, onComplete, onSkip }: InitialBalanceStepProps) {
  const initialDate = useMemo(() => today(), []);
  const [balances, setBalances] = useState<Record<string, { amount: string; date: string }>>(
    Object.fromEntries(accounts.map((account) => [account.id, { amount: '0', date: initialDate }]))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setLoading(true);
    setError('');

    for (const account of accounts) {
      const balance = balances[account.id] ?? { amount: '0', date: initialDate };
      const amount = Number.parseFloat(balance.amount.replace(',', '.')) || 0;

      const response = await fetch(`/api/bank-accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialBalance: amount,
          initialBalanceDate: balance.date
        })
      });

      if (!response.ok) {
        setError(`Erro ao salvar saldo inicial de ${account.name}`);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    onComplete();
  }

  return (
    <div className="mt-6 border-t border-gray-100 pt-6">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Saldo inicial das contas</h2>
      <p className="mb-5 text-sm text-gray-500">
        Informe o saldo de cada conta na data de inicio. Isso garante que os relatorios comecem com os valores corretos.
      </p>

      <div className="space-y-4">
        {accounts.map((account) => (
          <div key={account.id} className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="mb-3 text-sm font-medium text-gray-900">
              {account.name}
              <span className="ml-2 text-xs text-gray-400">{account.currency}</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id={`amount-${account.id}`} label="Saldo inicial">
                <Input
                  id={`amount-${account.id}`}
                  type="number"
                  step="0.01"
                  value={balances[account.id]?.amount ?? '0'}
                  onChange={(event) =>
                    setBalances((current) => ({
                      ...current,
                      [account.id]: { ...(current[account.id] ?? { date: initialDate }), amount: event.target.value }
                    }))
                  }
                  placeholder="0,00"
                />
              </FormField>
              <FormField id={`date-${account.id}`} label="Data do saldo">
                <Input
                  id={`date-${account.id}`}
                  type="date"
                  value={balances[account.id]?.date ?? initialDate}
                  onChange={(event) =>
                    setBalances((current) => ({
                      ...current,
                      [account.id]: { ...(current[account.id] ?? { amount: '0' }), date: event.target.value }
                    }))
                  }
                />
              </FormField>
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}

      <div className="mt-6 flex justify-between">
        <Button type="button" variant="ghost" onClick={onSkip} className="text-gray-500">
          Pular por agora
        </Button>
        <Button type="button" onClick={() => void handleSave()} disabled={loading}>
          {loading ? 'Salvando...' : 'Confirmar saldos'}
        </Button>
      </div>
    </div>
  );
}
