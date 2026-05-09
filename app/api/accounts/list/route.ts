import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/utils/http';

const schema = z.object({
  bank_name: z.string().min(2),
  agency: z.string().max(10).optional().nullable(),
  account_number: z.string().max(20).optional().nullable(),
  account_type: z.string().max(30).optional().nullable()
});

export async function GET() {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);

  const supabase = createClient();
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('company_id', session.companyId)
    .order('created_at', { ascending: true });

  if (error) return jsonError(error.message, 500);

  return jsonOk(data ?? []);
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return jsonError('Dados invalidos para conta bancaria.', 400);
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('bank_accounts')
    .insert({
      ...parsed.data,
      company_id: session.companyId,
      account_type: parsed.data.account_type ?? 'Corrente'
    })
    .select('*')
    .single();

  if (error || !data) return jsonError(error?.message ?? 'Falha ao criar conta.', 500);

  return jsonOk(data, 201);
}
