'use client';

import { useEffect, useState } from 'react';
import { DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { currentMonth, monthRange } from '@/lib/utils/date';
import { MonthlyComparisonChart, MonthlyPoint } from '@/components/dashboard/MonthlyComparisonChart';
import { MonthlySummaryList } from '@/components/dashboard/MonthlySummaryList';

interface DashboardData {
  initialBalance: number;
  finalBalance: number;
  totalIn: number;
  totalOut: number;
  variation: number;
  monthlyComparison: MonthlyPoint[];
  monthlySummary: MonthlyPoint[];
  period: {
    startDate: string;
    endDate: string;
  };
}

interface StatementSummary {
  period_start: string;
  period_end: string;
}

export default function DashboardPage() {
  const defaultRange = monthRange(currentMonth());

  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    async function loadLatestStatementPeriod() {
      const response = await fetch('/api/statements/list', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);

      const statements = Array.isArray(payload?.statements) ? (payload.statements as StatementSummary[]) : [];
      const latest = statements[0];

      if (latest?.period_start && latest?.period_end) {
        setStartDate(latest.period_start);
        setEndDate(latest.period_end);
      }
    }

    loadLatestStatementPeriod().catch(() => null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchDashboard() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate,
        endDate
      });

      const response = await fetch(`/api/reports/dashboard?${params.toString()}`, {
        signal: controller.signal,
        cache: 'no-store'
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? 'Falha ao carregar dashboard.');
        setData(null);
        setLoading(false);
        return;
      }

      setData(payload);
      setLoading(false);
    }

    fetchDashboard().catch((requestError) => {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      setLoading(false);
      setError('Falha ao carregar dashboard.');
      setData(null);
    });

    return () => controller.abort();
  }, [startDate, endDate]);

  return (
    <section>
      <Header title="Dashboard" subtitle="Comparativo mensal de fluxo de caixa" />

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-app-subtle">Data inicio</label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-app-subtle">Data fim</label>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <div className="md:col-span-2 md:flex md:items-end md:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const range = monthRange(currentMonth());
                setStartDate(range.start);
                setEndDate(range.end);
              }}
            >
              Voltar para mes atual
            </Button>
          </div>
        </div>
      </Card>

      {error ? <p className="mb-4 rounded-lg border border-danger/30 bg-red-50 p-3 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="mb-4 text-sm text-app-subtle">Carregando dados...</p> : null}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Saldo inicial" value={data?.initialBalance ?? 0} icon={<Wallet className="h-4 w-4 text-primary" />} />
        <StatCard title="Entradas" value={data?.totalIn ?? 0} icon={<TrendingUp className="h-4 w-4 text-success" />} />
        <StatCard title="Saidas" value={data?.totalOut ?? 0} icon={<TrendingDown className="h-4 w-4 text-danger" />} />
        <StatCard title="Saldo final" value={data?.finalBalance ?? 0} icon={<DollarSign className="h-4 w-4 text-secondary" />} />
      </div>

      <div className="mb-6">
        <MonthlyComparisonChart data={data?.monthlyComparison ?? []} />
      </div>

      <MonthlySummaryList data={data?.monthlySummary ?? []} />
    </section>
  );
}
