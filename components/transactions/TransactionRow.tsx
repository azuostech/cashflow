import { CategoryBadge } from '@/components/transactions/CategoryBadge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils/format';

export interface TransactionView {
  id: string;
  date: string;
  description: string;
  type: 'credit' | 'debit';
  amount: number;
  balance_after: number | null;
  is_hidden?: boolean | null;
  category_id?: string | null;
  categories?: {
    name: string;
    color: string;
  } | null;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface TransactionRowProps {
  transaction: TransactionView;
  editableCategories?: CategoryOption[];
  onCategoryChange?: (transactionId: string, categoryId: string | null) => Promise<void> | void;
  onHiddenChange?: (transactionId: string, isHidden: boolean) => Promise<void> | void;
}

export function TransactionRow({ transaction, editableCategories, onCategoryChange, onHiddenChange }: TransactionRowProps) {
  const isHidden = Boolean(transaction.is_hidden);
  const gridColsClass = onHiddenChange ? 'md:grid-cols-7' : 'md:grid-cols-6';

  return (
    <div
      className={`grid grid-cols-1 gap-2 rounded-lg border border-app-border p-3 md:items-center ${gridColsClass} ${
        isHidden ? 'bg-app-muted/40 opacity-80' : ''
      }`}
    >
      <p className="text-sm text-app-subtle">{new Date(transaction.date).toLocaleDateString('pt-BR')}</p>
      <p className={`md:col-span-2 ${isHidden ? 'line-through text-app-subtle' : ''}`}>{transaction.description}</p>
      {editableCategories && onCategoryChange ? (
        <select
          className="h-10 rounded-lg border border-app-border px-2 text-sm"
          value={transaction.category_id ?? ''}
          onChange={(event) => {
            const nextValue = event.target.value || null;
            onCategoryChange(transaction.id, nextValue);
          }}
          aria-label="Editar categoria da transacao"
        >
          <option value="">Sem categoria</option>
          {editableCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      ) : (
        <CategoryBadge name={transaction.categories?.name} color={transaction.categories?.color} />
      )}
      <p
        className={
          isHidden
            ? 'font-semibold text-app-subtle line-through'
            : transaction.type === 'credit'
              ? 'font-semibold text-success'
              : 'font-semibold text-danger'
        }
      >
        {transaction.type === 'credit' ? '+' : '-'} {formatCurrency(transaction.amount)}
      </p>
      <p className="text-sm text-app-subtle">
        Saldo: {transaction.balance_after === null ? '-' : formatCurrency(transaction.balance_after)}
      </p>
      {onHiddenChange ? (
        <div className="md:justify-self-end">
          <Button
            type="button"
            variant={isHidden ? 'secondary' : 'outline'}
            onClick={() => onHiddenChange(transaction.id, !isHidden)}
          >
            {isHidden ? 'Habilitar' : 'Desabilitar'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
