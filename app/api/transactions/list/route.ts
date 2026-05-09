import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/utils/http';

export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);

  const { searchParams } = new URL(request.url);
  const statementId = searchParams.get('statementId');
  const type = searchParams.get('type');
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  const supabase = createClient();

  let query = supabase
    .from('transactions')
    .select('id, date, description, document_number, type, amount, balance_after, category_id, categories(name,color), statements!inner(id, bank_accounts!inner(company_id))')
    .eq('statements.bank_accounts.company_id', session.companyId)
    .eq('is_hidden', false)
    .order('date', { ascending: false });

  if (statementId) query = query.eq('statement_id', statementId);
  if (type && (type === 'credit' || type === 'debit')) query = query.eq('type', type);
  if (category) query = query.eq('category_id', category);
  if (search) query = query.ilike('description', `%${search}%`);

  const { data, error } = await query;

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonOk(data ?? []);
}
