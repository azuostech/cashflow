import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/utils/http';

const schema = z.object({
  name: z.string().min(2),
  type: z.enum(['income', 'expense']),
  color: z.string().regex(/^#([A-Fa-f0-9]{6})$/),
  keywords: z.array(z.string().min(1)).default([])
});

export async function GET() {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (!session.companyId) return jsonError('Selecione uma empresa para continuar.', 400);

  const supabase = createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', session.companyId)
    .order('created_at', { ascending: false });

  if (error) return jsonError(error.message, 500);

  return jsonOk(data ?? []);
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (!session.companyId) return jsonError('Selecione uma empresa para continuar.', 400);

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return jsonError('Dados invalidos para categoria.', 400);
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('categories')
    .insert({
      ...parsed.data,
      company_id: session.companyId
    })
    .select('*')
    .single();

  if (error || !data) return jsonError(error?.message ?? 'Falha ao criar categoria.', 500);

  return jsonOk(data, 201);
}
