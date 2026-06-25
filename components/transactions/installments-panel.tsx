'use client';

import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Modal } from '@/components/shared/modal';
import { StatusBadge } from '@/components/transactions/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useFetch } from '@/hooks/use-fetch';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';

interface BankAccount {
  id: string;
  name: string;
  active: boolean;
}

interface Installment {
  id: string;
  number: number;
  originalAmount: string | number;
  originalCurrency: string;
  dueDate: string;
  paymentDate: string | null;
  status: string;
  bankAccountId: string | null;
  bankAccount?: { id: string; name: string; currency: string } | null;
}

interface InstallmentsPanelProps {
  transactionId: string;
  currency: string;
  onPaid?: () => void;
}

function dateOnly(value: string) {
  return value.split('T')[0];
}

export function InstallmentsPanel({ transactionId, currency, onPaid }: InstallmentsPanelProps) {
  const { data: installments, refetch } = useFetch<Installment[]>(`/api/transactions/${transactionId}/installments`);
  const [payingInstallment, setPayingInstallment] = useState<Installment | null>(null);
  const list = installments ?? [];

  const paid = list.filter((installment) => installment.status === 'paid' || installment.status === 'received');
  const pending = list.filter((installment) => installment.status === 'pending');
  const totalPaid = paid.length;
  const totalCount = list.length;
  const amountPaid = paid.reduce((sum, installment) => sum + Number(installment.originalAmount), 0);
  const amountPending = pending.reduce((sum, installment) => sum + Number(installment.originalAmount), 0);

  async function handlePaid() {
    await refetch();
    onPaid?.();
    setPayingInstallment(null);
  }

  if (list.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Parcelas ({totalPaid}/{totalCount} pagas)
        </span>
        {amountPaid > 0 ? <span className="text-xs font-medium text-emerald-600">Pago: {formatCurrency(amountPaid, currency)}</span> : null}
        {amountPending > 0 ? (
          <span className="text-xs font-medium text-amber-600">Pendente: {formatCurrency(amountPending, currency)}</span>
        ) : null}
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${(totalPaid / totalCount) * 100}%` }} />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-3 py-2 text-left font-medium text-gray-400">Parcela</th>
                <th className="px-3 py-2 text-left font-medium text-gray-400">Vencimento</th>
                <th className="px-3 py-2 text-right font-medium text-gray-400">Valor</th>
                <th className="px-3 py-2 text-left font-medium text-gray-400">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-400">Pagamento</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((installment) => {
                const isPaid = installment.status === 'paid' || installment.status === 'received';
                const overdue = !isPaid && dateOnly(installment.dueDate) < new Date().toISOString().split('T')[0];

                return (
                  <tr key={installment.id} className={`border-b border-gray-50 last:border-0 ${overdue ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-2 font-medium text-gray-700">#{installment.number}</td>
                    <td className={`px-3 py-2 ${overdue ? 'font-medium text-red-600' : 'text-gray-500'}`}>{formatDate(installment.dueDate)}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-800">
                      {formatCurrency(Number(installment.originalAmount), currency)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={installment.status} />
                    </td>
                    <td className="px-3 py-2 text-gray-400">
                      {installment.paymentDate ? formatDate(installment.paymentDate) : '--'}
                      {installment.bankAccount ? <div className="text-gray-300">{installment.bankAccount.name}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {installment.status === 'pending' ? (
                        <button
                          type="button"
                          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                          onClick={() => setPayingInstallment(installment)}
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Pagar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <InstallmentPayModal
        transactionId={transactionId}
        installment={payingInstallment}
        open={!!payingInstallment}
        onClose={() => setPayingInstallment(null)}
        onPaid={handlePaid}
      />
    </div>
  );
}

function InstallmentPayModal({
  transactionId,
  installment,
  open,
  onClose,
  onPaid
}: {
  transactionId: string;
  installment: Installment | null;
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [paymentDate, setPaymentDate] = useState(today);
  const [bankAccountId, setBankAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { data: accounts } = useFetch<BankAccount[]>('/api/bank-accounts?active=all');

  useEffect(() => {
    if (!installment) return;
    setPaymentDate(today);
    setBankAccountId(installment.bankAccountId ?? '');
    setError('');
  }, [installment, today]);

  if (!installment) return null;

  async function handlePay() {
    if (!installment) return;
    if (!bankAccountId) {
      setError('Selecione uma conta bancaria.');
      return;
    }

    setLoading(true);
    setError('');

    const response = await fetch(`/api/transactions/${transactionId}/installments/${installment.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentDate, bankAccountId })
    });

    if (response.ok) {
      await onPaid();
    } else {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Erro ao registrar pagamento');
    }

    setLoading(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={`Pagar parcela #${installment.number}`} size="sm">
      <div className="space-y-4">
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Valor</p>
          <p className="mt-1 text-lg font-semibold text-red-600">
            {formatCurrency(Number(installment.originalAmount), installment.originalCurrency)}
          </p>
        </div>
        <div>
          <label htmlFor="installmentPaymentDate" className="mb-1 block text-xs font-medium text-gray-500">
            Data do pagamento
          </label>
          <Input id="installmentPaymentDate" type="date" max={today} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
        </div>
        <div>
          <label htmlFor="installmentBankAccount" className="mb-1 block text-xs font-medium text-gray-500">
            Conta bancaria
          </label>
          <Select id="installmentBankAccount" value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}>
            <option value="">Selecionar</option>
            {(accounts ?? [])
              .filter((account) => account.active)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </Select>
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={loading} onClick={() => void handlePay()}>
            {loading ? 'Registrando...' : 'Confirmar pagamento'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
