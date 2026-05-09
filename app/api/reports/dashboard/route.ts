import { currentMonth, monthRange } from '@/lib/utils/date';
import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { getFirstAccount } from '@/lib/reports';
import { jsonError, jsonOk } from '@/lib/utils/http';

interface MonthlyPoint {
  month: string;
  total_in: number;
  total_out: number;
  net: number;
  transaction_count: number;
  end_balance: number;
}

function parseDateParam(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return value;
}

function toMonthKey(date: string): string {
  return date.slice(0, 7);
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

  let accountId = searchParams.get('accountId');

  if (!accountId) {
    const account = await getFirstAccount(session.companyId);
    accountId = account?.id ?? null;
  }

  if (!accountId) return jsonError('Nenhuma conta cadastrada para a empresa.', 404);

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
      monthlyComparison: [],
      monthlySummary: [],
      period: {
        startDate,
        endDate
      }
    });
  }

  const statementIds = statements.map((statement) => statement.id);

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, date, type, amount, balance_after')
    .in('statement_id', statementIds)
    .eq('is_hidden', false)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) return jsonError(error.message, 500);

  const txs = (transactions ?? []).map((transaction) => ({
    id: transaction.id,
    date: transaction.date,
    month: toMonthKey(transaction.date),
    type: transaction.type,
    amount: Number(transaction.amount),
    balance_after: transaction.balance_after === null ? null : Number(transaction.balance_after)
  }));

  const totalIn = txs.filter((tx) => tx.type === 'credit').reduce((sum, tx) => sum + tx.amount, 0);
  const totalOut = txs.filter((tx) => tx.type === 'debit').reduce((sum, tx) => sum + tx.amount, 0);

  const firstStatement = statements[0];
  const lastStatement = statements[statements.length - 1];

  const firstTx = txs[0];
  const lastTx = txs[txs.length - 1];

  const computedInitialFromTx = firstTx
    ? Number(
        (
          Number(firstTx.balance_after ?? 0) - (firstTx.type === 'credit' ? Number(firstTx.amount) : -Number(firstTx.amount))
        ).toFixed(2)
      )
    : null;

  const computedFinalFromTx = lastTx?.balance_after ?? null;

  const monthlyMap = new Map<string, MonthlyPoint>();

  for (const tx of txs) {
    const existing = monthlyMap.get(tx.month) ?? {
      month: tx.month,
      total_in: 0,
      total_out: 0,
      net: 0,
      transaction_count: 0,
      end_balance: Number(tx.balance_after ?? 0)
    };

    if (tx.type === 'credit') existing.total_in += tx.amount;
    if (tx.type === 'debit') existing.total_out += tx.amount;

    existing.net = existing.total_in - existing.total_out;
    existing.transaction_count += 1;
    existing.end_balance = Number(tx.balance_after ?? existing.end_balance);
    monthlyMap.set(tx.month, existing);
  }

  const monthlySeries = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  return jsonOk({
    initialBalance: computedInitialFromTx ?? Number(firstStatement.initial_balance ?? 0),
    finalBalance: computedFinalFromTx ?? Number(lastStatement.final_balance ?? 0),
    totalIn,
    totalOut,
    variation: totalIn - totalOut,
    monthlyComparison: monthlySeries,
    monthlySummary: monthlySeries,
    period: {
      startDate,
      endDate
    }
  });
}
