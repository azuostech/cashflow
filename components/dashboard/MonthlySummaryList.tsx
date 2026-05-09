import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';
import { MonthlyPoint } from '@/components/dashboard/MonthlyComparisonChart';

function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

export function MonthlySummaryList({ data }: { data: MonthlyPoint[] }) {
  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold">Resumo mensal para comparacao</h3>
      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.month} className="grid grid-cols-1 gap-2 rounded-lg border border-app-border p-3 md:grid-cols-6 md:items-center">
            <p className="font-semibold capitalize">{formatMonth(item.month)}</p>
            <p className="text-success">Entradas: {formatCurrency(item.total_in)}</p>
            <p className="text-danger">Saidas: {formatCurrency(item.total_out)}</p>
            <p className={item.net >= 0 ? 'text-success' : 'text-danger'}>Variacao: {formatCurrency(item.net)}</p>
            <p className="text-app-subtle">Saldo final: {formatCurrency(item.end_balance)}</p>
            <p className="text-app-subtle">Lancamentos: {item.transaction_count}</p>
          </div>
        ))}

        {data.length === 0 ? <p className="text-sm text-app-subtle">Sem dados para o periodo selecionado.</p> : null}
      </div>
    </Card>
  );
}
