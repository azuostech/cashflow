import { Card } from '@/components/ui/card';
import { TransactionRow, TransactionView } from '@/components/transactions/TransactionRow';

interface TransactionListProps {
  transactions: TransactionView[];
  title?: string;
}

export function TransactionList({ transactions, title = 'Transacoes do periodo' }: TransactionListProps) {
  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      <div className="space-y-2">
        {transactions.map((transaction) => (
          <TransactionRow key={transaction.id} transaction={transaction} />
        ))}
        {transactions.length === 0 ? <p className="text-sm text-app-subtle">Sem transacoes para o periodo.</p> : null}
      </div>
    </Card>
  );
}
