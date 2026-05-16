import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/utils/http';

interface Params {
  params: {
    id: string;
  };
}

export async function GET(_: Request, { params }: Params) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (!session.companyId) return jsonError('Selecione uma empresa para continuar.', 400);

  const supabase = createClient();

  const { data, error } = await supabase
    .from('statements')
    .select('*, bank_accounts!inner(company_id), transactions(*)')
    .eq('id', params.id)
    .eq('bank_accounts.company_id', session.companyId)
    .single();

  if (error || !data) {
    return jsonError('Extrato nao encontrado.', 404);
  }

  return jsonOk(data);
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (!session.companyId) return jsonError('Selecione uma empresa para continuar.', 400);

  const supabase = createClient();

  const { data: statement } = await supabase
    .from('statements')
    .select('id, file_url, bank_accounts!inner(company_id)')
    .eq('id', params.id)
    .eq('bank_accounts.company_id', session.companyId)
    .single();

  if (!statement) {
    return jsonError('Extrato nao encontrado.', 404);
  }

  if (statement.file_url) {
    await supabase.storage.from('statements').remove([statement.file_url]);
  }

  const { error } = await supabase.from('statements').delete().eq('id', params.id);
  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonOk({ success: true });
}
