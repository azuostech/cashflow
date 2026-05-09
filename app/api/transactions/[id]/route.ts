import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/utils/http';

const schema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  is_hidden: z.boolean().optional()
});

interface Params {
  params: {
    id: string;
  };
}

export async function GET(_: Request, { params }: Params) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);

  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*, categories(name,color), statements!inner(bank_accounts!inner(company_id))')
    .eq('id', params.id)
    .eq('statements.bank_accounts.company_id', session.companyId)
    .single();

  if (error || !data) {
    return jsonError('Transacao nao encontrada.', 404);
  }

  return jsonOk(data);
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return jsonError('Dados de atualizacao invalidos.', 400);
  }

  const supabase = createClient();

  const { data: existing } = await supabase
    .from('transactions')
    .select('id, statements!inner(bank_accounts!inner(company_id))')
    .eq('id', params.id)
    .eq('statements.bank_accounts.company_id', session.companyId)
    .single();

  if (!existing) {
    return jsonError('Transacao nao encontrada.', 404);
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('*')
    .single();

  if (error || !data) {
    return jsonError(error?.message ?? 'Falha ao atualizar transacao.', 500);
  }

  return jsonOk(data);
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);

  const supabase = createClient();

  const { data: existing } = await supabase
    .from('transactions')
    .select('id, statements!inner(bank_accounts!inner(company_id))')
    .eq('id', params.id)
    .eq('statements.bank_accounts.company_id', session.companyId)
    .single();

  if (!existing) return jsonError('Transacao nao encontrada.', 404);

  const { error } = await supabase.from('transactions').delete().eq('id', params.id);
  if (error) return jsonError(error.message, 500);

  return jsonOk({ success: true });
}
