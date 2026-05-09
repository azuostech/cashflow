'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';

export interface MonthlyPoint {
  month: string;
  total_in: number;
  total_out: number;
  net: number;
  transaction_count: number;
  end_balance: number;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: '2-digit'
  }).format(date);
}

export function MonthlyComparisonChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <Card className="h-[360px]">
      <h3 className="mb-4 text-lg font-semibold">Comparacao mensal de entradas e saidas</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tickFormatter={formatMonthLabel} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value))}
            labelFormatter={(label) => `Mes: ${formatMonthLabel(String(label))}`}
          />
          <Legend />
          <Bar dataKey="total_in" name="Entradas" fill="#1D9E75" radius={[6, 6, 0, 0]} />
          <Bar dataKey="total_out" name="Saidas" fill="#E24B4A" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
