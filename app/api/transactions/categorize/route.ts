import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { categorizeTransaction } from '@/lib/categorization';
import { jsonError, jsonOk } from '@/lib/utils/http';

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);

  const { statementId } = await request.json();
  if (!statementId) return jsonError('statementId obrigatorio.', 400);

  const supabase = createClient();

  const { data: statement } = await supabase
    .from('statements')
    .select('id, account_id, bank_accounts!inner(company_id)')
    .eq('id', statementId)
    .eq('bank_accounts.company_id', session.companyId)
    .single();

  if (!statement) return jsonError('Extrato nao encontrado.', 404);

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, description')
    .eq('statement_id', statementId)
    .is('category_id', null);

  if (!transactions?.length) return jsonOk({ updated: 0 });

  let updated = 0;

  for (const transaction of transactions) {
    const category = await categorizeTransaction(transaction.description, statement.account_id);
    if (!category) continue;

    await supabase.from('transactions').update({ category_id: category.id }).eq('id', transaction.id);
    updated += 1;
  }

  return jsonOk({ updated });
}
