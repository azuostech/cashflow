import { currentMonth, monthRange } from '@/lib/utils/date';
import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { getFirstAccount } from '@/lib/reports';
import { jsonError, jsonOk } from '@/lib/utils/http';

interface Category {
  name: string;
  color: string;
}

interface DailyPoint {
  date: string;
  total_in: number;
  total_out: number;
  end_balance: number;
  transaction_count: number;
}

interface TransactionItem {
  id: string;
  date: string;
  description: string;
  type: 'credit' | 'debit';
  amount: number;
  balance_after: number | null;
  is_hidden: boolean;
  category_id: string | null;
  categories: Category | null;
}

function normalizeCategory(value: unknown): Category | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    const first = value[0] as Partial<Category> | undefined;
    if (!first?.name || !first?.color) return null;
    return { name: first.name, color: first.color };
  }

  const one = value as Partial<Category>;
  if (!one.name || !one.color) return null;
  return { name: one.name, color: one.color };
}

function parseDateParam(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return value;
}

function parseBooleanParam(value: string | null, fallback = false): boolean {
  if (!value) return fallback;
  return value.toLowerCase() === 'true';
}

export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);

  const { searchParams } = new URL(request.url);

  const defaultRange = monthRange(currentMonth());
  const startDate = parseDateParam(searchParams.get('startDate'), defaultRange.start);
  const endDate = parseDateParam(searchParams.get('endDate'), defaultRange.end);

  if (startDate > endDate) {
    return jsonError('Data inicial nao pode ser maior que a data final.', 400);
  }

  const type = searchParams.get('type') ?? 'all';
  const category = searchParams.get('category') ?? '';
  const search = (searchParams.get('search') ?? '').trim().toLowerCase();
  const includeHidden = parseBooleanParam(searchParams.get('includeHidden'));

  let accountId = searchParams.get('accountId');

  if (!accountId) {
    const account = await getFirstAccount(session.companyId);
    accountId = account?.id ?? null;
  }

  if (!accountId) {
    return jsonOk({
      initialBalance: 0,
      finalBalance: 0,
      totalIn: 0,
      totalOut: 0,
      variation: 0,
      dailyBalance: [],
      transactions: [],
      period: {
        startDate,
        endDate
      }
    });
  }

  const supabase = createClient();

  const { data: statements, error: statementsError } = await supabase
    .from('statements')
    .select('id, initial_balance, final_balance, period_start, period_end')
    .eq('account_id', accountId)
    .lte('period_start', endDate)
    .gte('period_end', startDate)
    .order('period_start', { ascending: true });

  if (statementsError) return jsonError(statementsError.message, 500);

  if (!statements || statements.length === 0) {
    return jsonOk({
      initialBalance: 0,
      finalBalance: 0,
      totalIn: 0,
      totalOut: 0,
      variation: 0,
      dailyBalance: [],
      transactions: [],
      period: {
        startDate,
        endDate
      }
    });
  }

  const statementIds = statements.map((statement) => statement.id);

  let query = supabase
    .from('transactions')
    .select('id, date, description, type, amount, balance_after, is_hidden, category_id, categories(name,color)')
    .in('statement_id', statementIds)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (!includeHidden) {
    query = query.eq('is_hidden', false);
  }

  const { data: transactions, error } = await query;

  if (error) return jsonError(error.message, 500);

  const allTransactions: TransactionItem[] = (transactions ?? []).map((transaction) => ({
    id: transaction.id,
    date: transaction.date,
    description: transaction.description,
    type: transaction.type,
    amount: Number(transaction.amount),
    balance_after: transaction.balance_after === null ? null : Number(transaction.balance_after),
    is_hidden: Boolean(transaction.is_hidden),
    category_id: transaction.category_id,
    categories: normalizeCategory(transaction.categories)
  }));

  let filteredTransactions = allTransactions;

  if (type === 'credit' || type === 'debit') {
    filteredTransactions = filteredTransactions.filter((transaction) => transaction.type === type);
  }

  if (category) {
    filteredTransactions = filteredTransactions.filter((transaction) => transaction.category_id === category);
  }

  if (search) {
    filteredTransactions = filteredTransactions.filter((transaction) => transaction.description.toLowerCase().includes(search));
  }

  const visibleTransactions = filteredTransactions.filter((transaction) => !transaction.is_hidden);

  const totalIn = visibleTransactions
    .filter((transaction) => transaction.type === 'credit')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const totalOut = visibleTransactions
    .filter((transaction) => transaction.type === 'debit')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const sortedAsc = [...visibleTransactions].sort((a, b) => a.date.localeCompare(b.date));
  const firstTx = sortedAsc[0];
  const lastTx = sortedAsc[sortedAsc.length - 1];

  const firstStatement = statements[0];
  const lastStatement = statements[statements.length - 1];

  const computedInitialFromTx = firstTx
    ? Number(
        (
          Number(firstTx.balance_after ?? 0) - (firstTx.type === 'credit' ? Number(firstTx.amount) : -Number(firstTx.amount))
        ).toFixed(2)
      )
    : null;

  const computedFinalFromTx = lastTx?.balance_after ?? null;

  const dailyMap = new Map<string, DailyPoint>();

  for (const transaction of visibleTransactions) {
    const existing = dailyMap.get(transaction.date) ?? {
      date: transaction.date,
      total_in: 0,
      total_out: 0,
      end_balance: Number(transaction.balance_after ?? 0),
      transaction_count: 0
    };

    if (transaction.type === 'credit') existing.total_in += Number(transaction.amount);
    if (transaction.type === 'debit') existing.total_out += Number(transaction.amount);

    existing.end_balance = Number(transaction.balance_after ?? existing.end_balance);
    existing.transaction_count += 1;
    dailyMap.set(transaction.date, existing);
  }

  return jsonOk({
    initialBalance: computedInitialFromTx ?? Number(firstStatement.initial_balance ?? 0),
    finalBalance: computedFinalFromTx ?? Number(lastStatement.final_balance ?? 0),
    totalIn,
    totalOut,
    variation: totalIn - totalOut,
    dailyBalance: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    transactions: filteredTransactions,
    period: {
      startDate,
      endDate
    }
  });
}
