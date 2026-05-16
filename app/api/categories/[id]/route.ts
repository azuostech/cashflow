import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/utils/http';

const schema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(['income', 'expense']).optional(),
  color: z.string().regex(/^#([A-Fa-f0-9]{6})$/).optional(),
  keywords: z.array(z.string().min(1)).optional()
});

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
    .from('categories')
    .select('*')
    .eq('id', params.id)
    .eq('company_id', session.companyId)
    .single();

  if (error || !data) return jsonError('Categoria nao encontrada.', 404);

  return jsonOk(data);
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (!session.companyId) return jsonError('Selecione uma empresa para continuar.', 400);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError('Dados invalidos para atualizacao.', 400);
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('categories')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('company_id', session.companyId)
    .select('*')
    .single();

  if (error || !data) return jsonError(error?.message ?? 'Falha ao atualizar categoria.', 500);

  return jsonOk(data);
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (!session.companyId) return jsonError('Selecione uma empresa para continuar.', 400);

  const supabase = createClient();
  const { error } = await supabase.from('categories').delete().eq('id', params.id).eq('company_id', session.companyId);

  if (error) return jsonError(error.message, 500);

  return jsonOk({ success: true });
}
