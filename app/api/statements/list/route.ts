import { getSessionContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getCompanyAccounts } from '@/lib/reports';
import { jsonError, jsonOk } from '@/lib/utils/http';

export async function GET() {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);

  const supabase = createClient();

  const accounts = await getCompanyAccounts(session.companyId);

  const { data: statements, error } = await supabase
    .from('statements')
    .select('id, account_id, period_start, period_end, initial_balance, final_balance, file_name, file_url, uploaded_at, status, bank_accounts!inner(id, bank_name, company_id)')
    .eq('bank_accounts.company_id', session.companyId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    return jsonError(error.message, 500);
  }

  const statementIds = (statements ?? []).map((statement) => statement.id);
  const { data: txCountData } = statementIds.length
    ? await supabase.from('transactions').select('statement_id').in('statement_id', statementIds)
    : { data: [] as { statement_id: string }[] };

  const countMap = new Map<string, number>();
  for (const row of txCountData ?? []) {
    const count = countMap.get(row.statement_id) ?? 0;
    countMap.set(row.statement_id, count + 1);
  }

  const enrichedStatements = (statements ?? []).map((statement) => ({
    ...statement,
    transactions_count: countMap.get(statement.id) ?? 0
  }));

  return jsonOk({ accounts, statements: enrichedStatements });
}
