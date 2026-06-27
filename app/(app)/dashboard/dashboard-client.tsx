'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Landmark,
  Link2,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  WalletCards
} from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { useFetch } from '@/hooks/use-fetch';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/currency';

interface BankBalance {
  accountId: string;
  accountName: string;
  currency: string;
  balance: number;
}

interface DashboardKPIs {
  period: { start: string; end: string };
  currency: string;
  revenue: number;
  expenses: number;
  result: number;
  margin: number;
  bankBalances: BankBalance[];
  totalBalance: number;
  burnRateDaily: number;
  daysOfCash: number | null;
  pendingPayables: number;
  pendingReceivables: number;
  overduePayables: number;
  overdueReceivables: number;
  unreconciledCount: number;
  prevRevenue: number;
  prevExpenses: number;
  prevResult: number;
  revenueGrowth: number | null;
  expensesGrowth: number | null;
  topExpenses: { categoryName: string; value: number; percent: number }[];
}

interface WeeklyProjection {
  week: string;
  inflow: number;
  outflow: number;
  balance: number;
  isRisk: boolean;
}

interface ProjectionData {
  weekly: WeeklyProjection[];
  daysOfCash: number | null;
  totalBalance: number;
  projectedClose: number;
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

function monthLabel() {
  return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-gray-400">sem comparativo</span>;

  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
        positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  previous,
  growth,
  tone
}: {
  label: string;
  value: string;
  previous?: string;
  growth?: number | null;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        {growth !== undefined ? <GrowthBadge value={growth} /> : null}
      </div>
      <p className={cn('break-words text-xl font-semibold', tone)}>{value}</p>
      {previous ? <p className="mt-1 text-xs text-gray-400">Anterior: {previous}</p> : null}
    </div>
  );
}

function DaysOfCashCard({ kpis }: { kpis: DashboardKPIs }) {
  const tone =
    kpis.daysOfCash === null
      ? 'border-gray-200 bg-white text-gray-500'
      : kpis.daysOfCash >= 30
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : kpis.daysOfCash >= 15
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-red-200 bg-red-50 text-red-700';

  return (
    <div className={cn('rounded-lg border p-4', tone)}>
      <div className="mb-3 flex items-center gap-2">
        <WalletCards className="h-4 w-4" />
        <p className="text-xs font-medium uppercase tracking-wide">Dias de caixa</p>
      </div>
      <p className="text-4xl font-bold leading-none">{kpis.daysOfCash ?? '-'}</p>
      <p className="mt-2 text-xs text-gray-500">Saldo consolidado: {formatCurrency(kpis.totalBalance, kpis.currency)}</p>
      <p className="mt-1 text-xs text-gray-500">Burn rate: {formatCurrency(kpis.burnRateDaily, kpis.currency)}/dia</p>
    </div>
  );
}

function ProjectionChart({
  projection,
  loading,
  currency
}: {
  projection: ProjectionData | null;
  loading: boolean;
  currency: string;
}) {
  if (loading || !projection?.weekly.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Projecao de caixa em 30 dias</h2>
        </div>
        <div className="flex h-36 items-center justify-center text-sm text-gray-400">
          {loading ? <LoadingSpinner /> : 'Sem dados para projetar'}
        </div>
      </div>
    );
  }

  const weekly = projection.weekly;
  const balances = weekly.map((week) => week.balance);
  const maxValue = Math.max(...balances, 0);
  const minValue = Math.min(...balances, 0);
  const range = maxValue - minValue || 1;
  const width = 640;
  const height = 150;
  const pad = 12;
  const zeroY = pad + (maxValue / range) * (height - pad * 2);
  const denominator = Math.max(weekly.length - 1, 1);
  const points = weekly.map((week, index) => ({
    x: pad + (index / denominator) * (width - pad * 2),
    y: pad + ((maxValue - week.balance) / range) * (height - pad * 2),
    week
  }));
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-800">Projecao de caixa em 30 dias</h2>
        <p className="text-xs text-gray-500">
          Fechamento projetado:{' '}
          <span className={cn('font-semibold', projection.projectedClose >= 0 ? 'text-emerald-700' : 'text-red-700')}>
            {formatCurrency(projection.projectedClose, currency)}
          </span>
        </p>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="Grafico de saldo projetado">
        {minValue < 0 ? (
          <>
            <rect x={pad} y={zeroY} width={width - pad * 2} height={height - pad - zeroY} fill="#fee2e2" opacity="0.65" />
            <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} stroke="#d1d5db" strokeDasharray="4 4" />
          </>
        ) : null}
        <path d={path} fill="none" stroke="#059669" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {points.map((point) => (
          <circle
            key={point.week.week}
            cx={point.x}
            cy={point.y}
            r={point.week.isRisk ? 4 : 3}
            fill={point.week.isRisk ? '#dc2626' : '#059669'}
          />
        ))}
        {points
          .filter((_, index) => index % 2 === 0 || index === points.length - 1)
          .map((point) => (
            <text key={`${point.week.week}-label`} x={point.x} y={height - 2} textAnchor="middle" fontSize="10" fill="#6b7280">
              {new Date(`${point.week.week}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </text>
          ))}
      </svg>

      {projection.daysOfCash !== null ? (
        <p className="mt-2 text-xs text-gray-500">
          Dias de caixa pela projecao: <span className="font-semibold text-gray-700">{projection.daysOfCash}</span>
        </p>
      ) : null}
    </div>
  );
}

export function DashboardClient({ companyName }: { companyName: string }) {
  const { data: kpis, loading: kpisLoading, error: kpisError } = useFetch<DashboardKPIs>(
    `/api/dashboard/kpis?startDate=${monthRange.start}&endDate=${monthRange.end}`
  );
  const {
    data: projection,
    loading: projectionLoading,
    error: projectionError
  } = useFetch<ProjectionData>('/api/dashboard/cashflow-projection?days=30');
  const currency = kpis?.currency ?? projection?.currency ?? 'BRL';

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {companyName} - {monthLabel()} vs mes anterior
          </p>
        </div>
      </div>

      {kpisError ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{kpisError}</div> : null}
      {projectionError ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">{projectionError}</div>
      ) : null}

      {kpisLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : kpis ? (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Receita"
              value={formatCurrency(kpis.revenue, currency)}
              previous={formatCurrency(kpis.prevRevenue, currency)}
              growth={kpis.revenueGrowth}
              tone="text-emerald-700"
            />
            <KpiCard
              label="Despesas"
              value={formatCurrency(kpis.expenses, currency)}
              previous={formatCurrency(kpis.prevExpenses, currency)}
              growth={kpis.expensesGrowth}
              tone="text-red-700"
            />
            <KpiCard
              label="Resultado"
              value={formatCurrency(kpis.result, currency)}
              previous={formatCurrency(kpis.prevResult, currency)}
              tone={kpis.result >= 0 ? 'text-emerald-700' : 'text-red-700'}
            />
            <KpiCard label="Margem" value={`${kpis.margin.toFixed(1)}%`} tone={kpis.margin >= 0 ? 'text-emerald-700' : 'text-red-700'} />
          </div>

          <div className="mb-5 grid gap-3 lg:grid-cols-3">
            <DaysOfCashCard kpis={kpis} />

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-gray-700">
                <CalendarClock className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">A pagar</p>
              </div>
              <p className="text-2xl font-semibold text-gray-900">{kpis.pendingPayables}</p>
              <p className="mt-1 text-xs text-gray-500">
                {kpis.overduePayables > 0 ? <span className="font-medium text-red-700">{kpis.overduePayables} vencidas · </span> : null}
                {Math.max(kpis.pendingPayables - kpis.overduePayables, 0)} em dia
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-gray-700">
                <ReceiptText className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">A receber</p>
              </div>
              <p className="text-2xl font-semibold text-gray-900">{kpis.pendingReceivables}</p>
              <p className="mt-1 text-xs text-gray-500">
                {kpis.overdueReceivables > 0 ? (
                  <span className="font-medium text-amber-700">{kpis.overdueReceivables} vencidas · </span>
                ) : null}
                {Math.max(kpis.pendingReceivables - kpis.overdueReceivables, 0)} em dia
              </p>
            </div>
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Landmark className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-800">Saldo por conta</h2>
              </div>
              {kpis.bankBalances.length ? (
                <div className="space-y-3">
                  {kpis.bankBalances.map((balance) => (
                    <div key={balance.accountId} className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">{balance.accountName}</p>
                        <p className="text-xs text-gray-400">{balance.currency}</p>
                      </div>
                      <p className={cn('shrink-0 text-sm font-semibold', balance.balance >= 0 ? 'text-gray-800' : 'text-red-700')}>
                        {formatCurrency(balance.balance, balance.currency)}
                      </p>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4 border-t border-gray-100 pt-3 text-sm">
                    <span className="font-medium text-gray-500">Total consolidado</span>
                    <span className={cn('font-semibold', kpis.totalBalance >= 0 ? 'text-gray-900' : 'text-red-700')}>
                      {formatCurrency(kpis.totalBalance, currency)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Nenhuma conta bancaria ativa no caixa consolidado.</p>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-800">Maiores despesas</h2>
              {kpis.topExpenses.length ? (
                <div className="space-y-3">
                  {kpis.topExpenses.map((expense) => (
                    <div key={expense.categoryName}>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="truncate text-xs font-medium text-gray-600">{expense.categoryName}</span>
                        <span className="shrink-0 text-xs font-semibold text-gray-700">{formatCurrency(expense.value, currency)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100">
                        <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${Math.min(expense.percent, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Sem despesas no periodo.</p>
              )}
            </div>
          </div>

          <div className="mb-5">
            <ProjectionChart projection={projection} loading={projectionLoading} currency={currency} />
          </div>

          {kpis.unreconciledCount > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <span>{kpis.unreconciledCount} movimentos bancarios nao conciliados</span>
              </div>
              <Link href="/bank/reconciliation" className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline">
                Conciliar <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <Link2 className="h-4 w-4" />
              Movimentos bancarios conciliados.
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
