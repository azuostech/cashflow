import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/utils/http';

const schema = z.object({
  bank_name: z.string().min(2).optional(),
  agency: z.string().max(10).optional().nullable(),
  account_number: z.string().max(20).optional().nullable(),
  account_type: z.string().max(30).optional().nullable()
});

interface Params {
  params: {
    id: string;
  };
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (!session.companyId) return jsonError('Selecione uma empresa para continuar.', 400);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError('Dados invalidos para atualizacao.', 400);

  const supabase = createClient();
  const { data, error } = await supabase
    .from('bank_accounts')
    .update(parsed.data)
    .eq('id', params.id)
    .eq('company_id', session.companyId)
    .select('*')
    .single();

  if (error || !data) return jsonError(error?.message ?? 'Conta nao encontrada.', 404);

  return jsonOk(data);
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (!session.companyId) return jsonError('Selecione uma empresa para continuar.', 400);

  const supabase = createClient();
  const { error } = await supabase
    .from('bank_accounts')
    .delete()
    .eq('id', params.id)
    .eq('company_id', session.companyId);

  if (error) return jsonError(error.message, 500);

  return jsonOk({ success: true });
}
