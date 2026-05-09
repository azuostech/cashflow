'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';

export interface EvolutionPoint {
  date: string;
  total_in: number;
  total_out: number;
  end_balance: number;
}

interface EvolutionChartProps {
  data: EvolutionPoint[];
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
}

function formatAxisDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}`;
}

export function EvolutionChart({ data, selectedDate = null, onSelectDate }: EvolutionChartProps) {
  return (
    <Card className="h-[340px]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Evolucao diaria do saldo</h3>
        <p className="text-xs text-app-subtle">Clique em um ponto para filtrar as transacoes por dia</p>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart
          data={data}
          onClick={(state) => {
            const clickedDate = state?.activePayload?.[0]?.payload?.date;
            if (clickedDate && onSelectDate) {
              onSelectDate(String(clickedDate));
            }
          }}
        >
          <defs>
            <linearGradient id="balance" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#1D9E75" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={formatAxisDate} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Area
            type="monotone"
            dataKey="end_balance"
            stroke="#1D9E75"
            fill="url(#balance)"
            strokeWidth={2}
            dot={(props) => {
              const payloadDate = String(props.payload?.date ?? '');
              const selected = selectedDate && payloadDate === selectedDate;

              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={selected ? 5 : 2}
                  fill={selected ? '#ffffff' : '#1D9E75'}
                  stroke="#1D9E75"
                  strokeWidth={selected ? 2 : 1}
                  opacity={selected ? 1 : 0.45}
                />
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
