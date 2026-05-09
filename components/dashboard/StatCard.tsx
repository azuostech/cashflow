import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';

interface StatCardProps {
  title: string;
  value: number;
  icon?: React.ReactNode;
  trend?: number;
  format?: 'currency' | 'number';
}

export function StatCard({ title, value, icon, trend, format = 'currency' }: StatCardProps) {
  const formatted = format === 'currency' ? formatCurrency(value) : value.toLocaleString('pt-BR');

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-app-subtle">{title}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold">{formatted}</p>
      {typeof trend === 'number' ? (
        <p className={trend >= 0 ? 'text-sm text-success' : 'text-sm text-danger'}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </p>
      ) : null}
    </Card>
  );
}
