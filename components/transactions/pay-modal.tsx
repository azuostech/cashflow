'use client';

import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Modal } from '@/components/shared/modal';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useFetch } from '@/hooks/use-fetch';
import { type TransactionListItem } from '@/hooks/use-transactions';
import { formatCurrency } from '@/lib/utils/currency';

interface BankAccount {
  id: string;
  name: string;
  currency: string;
  active: boolean;
}

interface PayModalProps {
  transaction: TransactionListItem | null;
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
}

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

export function PayModal({ transaction, open, onClose, onPaid }: PayModalProps) {
  const [paymentDate, setPaymentDate] = useState(todayDate());
  const [bankAccountId, setBankAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { data: accounts } = useFetch<BankAccount[]>('/api/bank-accounts?active=all');

  useEffect(() => {
    if (!transaction) return;
    setPaymentDate(todayDate());
    setBankAccountId(transaction.bankAccountId ?? '');
    setError('');
  }, [transaction]);

  async function handlePay() {
    if (!transaction) return;
    if (!paymentDate || !bankAccountId) {
      setError('Preencha data e conta bancaria.');
      return;
    }

    setLoading(true);
    setError('');

    const response = await fetch(`/api/transactions/${transaction.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentDate, bankAccountId })
    });

    if (response.ok) {
      onPaid();
      onClose();
    } else {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Erro ao registrar pagamento.');
    }

    setLoading(false);
  }

  if (!transaction) return null;

  const isRevenue = transaction.type === 'revenue';
  const title = isRevenue ? 'Registrar recebimento' : 'Registrar pagamento';

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="truncate text-sm font-medium text-gray-900">{transaction.description}</p>
          <p className={`mt-1 text-lg font-semibold ${isRevenue ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(Number(transaction.originalAmount), transaction.originalCurrency)}
          </p>
        </div>

        <FormField id="payDate" label="Data" required>
          <Input id="payDate" type="date" max={todayDate()} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
        </FormField>

        <FormField id="payAccount" label="Conta bancaria" required>
          <Select id="payAccount" value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}>
            <option value="">Selecionar conta</option>
            {(accounts ?? [])
              .filter((account) => account.active)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
          </Select>
        </FormField>

        {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={loading} onClick={handlePay} className="gap-2">
            <CreditCard className="h-4 w-4" />
            {loading ? 'Registrando...' : isRevenue ? 'Confirmar recebimento' : 'Confirmar pagamento'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
