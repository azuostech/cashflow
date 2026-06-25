'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useFetch } from '@/hooks/use-fetch';
import { formatCurrency } from '@/lib/utils/currency';
import { cn } from '@/lib/utils/cn';

interface BankAccount {
  id: string;
  name: string;
  currency: string;
  active: boolean;
}

interface CashflowEntry {
  date: string;
  label: string;
  inflow: number;
  outflow: number;
  inflowPending: number;
  outflowPending: number;
  cumulativeBalance: number;
  isRisk: boolean;
}

interface CashflowData {
  entries: CashflowEntry[];
  openingBalance: number;
  closingBalance: number;
  projectedClosing: number;
  totalInflow: number;
  totalOutflow: number;
  totalInflowPending: number;
  totalOutflowPending: number;
  minBalance: number;
  minBalanceDate: string | null;
  daysOfCash: number | null;
  currency: string;
}

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const monthRange = (() => {
  const now = new Date();
  return {
    start: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  };
})();

function groupByWeek(entries: CashflowEntry[]) {
  const weeks: { label: string; entries: CashflowEntry[]; isRisk: boolean }[] = [];
  let currentWeek: CashflowEntry[] = [];
  let currentMonday = '';

  for (const entry of entries) {
    const date = new Date(`${entry.date}T00:00:00`);
    const monday = new Date(date);
    const day = date.getDay();
    monday.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    const mondayKey = toDateInput(monday);

    if (mondayKey !== currentMonday) {
      if (currentWeek.length > 0) {
        weeks.push({
          label: `Semana de ${currentWeek[0].label}`,
          entries: currentWeek,
          isRisk: currentWeek.some((item) => item.isRisk)
        });
      }
      currentMonday = mondayKey;
      currentWeek = [];
    }
    currentWeek.push(entry);
  }

  if (currentWeek.length > 0) {
    weeks.push({
      label: `Semana de ${currentWeek[0].label}`,
      entries: currentWeek,
      isRisk: currentWeek.some((item) => item.isRisk)
    });
  }

  return weeks;
}

export default function CashflowReportPage() {
  const [startDate, setStartDate] = useState(monthRange.start);
  const [endDate, setEndDate] = useState(monthRange.end);
  const [bankAccountId, setBankAccountId] = useState('');
  const { data: accounts } = useFetch<BankAccount[]>('/api/bank-accounts');
  const reportUrl = useMemo(() => {
    const params = new URLSearchParams({ startDate, endDate });
    if (bankAccountId) params.set('bankAccountId', bankAccountId);
    return `/api/reports/cashflow?${params.toString()}`;
  }, [bankAccountId, endDate, startDate]);
  const { data, loading, error } = useFetch<CashflowData>(reportUrl);
  const currency = data?.currency ?? 'BRL';
  const weeks = data?.entries ? groupByWeek(data.entries) : [];
  const hasRisk = data?.entries.some((entry) => entry.isRisk) ?? false;

  return (
    <div className="max-w-5xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Fluxo de caixa</h1>
        <p className="mt-0.5 text-sm text-gray-500">Realizados e projecao de entradas e saidas</p>
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-9 w-40" />
        <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-9 w-40" />
        <Select value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)} className="h-9 w-64 py-1.5">
          <option value="">Todas as contas</option>
          {(accounts ?? [])
            .filter((account) => account.active)
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
        </Select>
      </div>

      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

      {data ? (
        <>
          {data.daysOfCash !== null ? <DaysOfCashPanel data={data} currency={currency} /> : null}

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Entradas realizadas', value: data.totalInflow, color: 'text-emerald-600' },
              { label: 'Saidas realizadas', value: data.totalOutflow, color: 'text-red-600' },
              { label: 'Entradas previstas', value: data.totalInflowPending, color: 'text-emerald-500' },
              { label: 'Saidas previstas', value: data.totalOutflowPending, color: 'text-red-400' }
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="mb-2 text-xs text-gray-400">{kpi.label}</p>
                <p className={cn('text-lg font-semibold', kpi.color)}>{formatCurrency(kpi.value, currency)}</p>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {hasRisk ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          Semanas com saldo projetado negativo detectadas. Revise os lancamentos pendentes.
        </div>
      ) : null}

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Calculando fluxo...</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {weeks.map((week, weekIndex) => (
            <div key={`${week.label}-${weekIndex}`}>
              <div
                className={cn(
                  'border-b px-4 py-2 text-xs font-medium uppercase tracking-wide',
                  week.isRisk ? 'border-red-100 bg-red-50 text-red-600' : 'border-gray-100 bg-gray-50 text-gray-400'
                )}
              >
                {week.label}
                {week.isRisk ? <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">risco de caixa</span> : null}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {week.entries
                    .filter((entry) => entry.inflow > 0 || entry.outflow > 0 || entry.inflowPending > 0 || entry.outflowPending > 0)
                    .map((entry) => (
                      <tr key={entry.date} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className={cn('w-16 px-4 py-2.5 text-xs', entry.isRisk ? 'font-medium text-red-500' : 'text-gray-400')}>
                          {entry.label}
                        </td>
                        <td className="px-4 py-2.5">
                          <EntryParts entry={entry} currency={currency} />
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right text-sm font-medium',
                            entry.cumulativeBalance >= 0 ? 'text-gray-700' : 'text-red-600'
                          )}
                        >
                          {formatCurrency(entry.cumulativeBalance, currency)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
          {weeks.length === 0 && !loading ? <div className="py-12 text-center text-sm text-gray-400">Nenhum movimento no periodo selecionado</div> : null}
        </div>
      )}
    </div>
  );
}

function DaysOfCashPanel({ data, currency }: { data: CashflowData; currency: string }) {
  const tone =
    data.daysOfCash !== null && data.daysOfCash >= 30
      ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
      : data.daysOfCash !== null && data.daysOfCash >= 15
        ? 'border-amber-200 bg-amber-50 text-amber-600'
        : 'border-red-200 bg-red-50 text-red-600';

  return (
    <div className={cn('mb-5 flex items-center gap-5 rounded-lg border p-5', tone)}>
      <div>
        <p className="text-5xl font-bold leading-none">{data.daysOfCash}</p>
        <p className="mt-1 text-sm text-gray-500">dias de caixa</p>
      </div>
      <div className="w-px self-stretch bg-gray-200" />
      <div className="space-y-1 text-sm text-gray-600">
        <p>
          Saldo atual: <strong>{formatCurrency(data.closingBalance, currency)}</strong>
        </p>
        <p>
          Saldo abertura: <strong>{formatCurrency(data.openingBalance, currency)}</strong>
        </p>
        <p>
          Saldo projetado: <strong>{formatCurrency(data.projectedClosing, currency)}</strong>
        </p>
        {data.minBalanceDate ? (
          <p className="text-red-600">
            Minimo {formatCurrency(data.minBalance, currency)} em{' '}
            {new Date(`${data.minBalanceDate}T00:00:00`).toLocaleDateString('pt-BR')}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EntryParts({ entry, currency }: { entry: CashflowEntry; currency: string }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {entry.inflow > 0 ? <span className="text-xs text-emerald-600">+{formatCurrency(entry.inflow, currency)} realizado</span> : null}
      {entry.outflow > 0 ? <span className="text-xs text-red-600">-{formatCurrency(entry.outflow, currency)} realizado</span> : null}
      {entry.inflowPending > 0 ? <span className="text-xs text-emerald-500">+{formatCurrency(entry.inflowPending, currency)} previsto</span> : null}
      {entry.outflowPending > 0 ? <span className="text-xs text-red-400">-{formatCurrency(entry.outflowPending, currency)} previsto</span> : null}
    </div>
  );
}
