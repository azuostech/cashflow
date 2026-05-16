import { z } from 'zod';
import { getSessionContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonError, jsonOk } from '@/lib/utils/http';
import { formatCNPJ, validateCNPJ } from '@/lib/utils/validators';

const schema = z.object({
  name: z.string().min(2),
  cnpj: z.string().min(14)
});

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (session.role !== 'admin') return jsonError('Apenas administradores podem criar empresas.', 403);

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return jsonError('Service role nao configurada.', 500);
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return jsonError('Dados invalidos para criar empresa.', 400);

  const normalizedCnpj = formatCNPJ(parsed.data.cnpj);
  if (!validateCNPJ(normalizedCnpj)) return jsonError('CNPJ invalido.', 400);

  const { data: existing } = await admin.from('companies').select('id').eq('cnpj', normalizedCnpj).maybeSingle();
  if (existing) return jsonError('Ja existe uma empresa com este CNPJ.', 400);

  const { data: company, error } = await admin
    .from('companies')
    .insert({
      name: parsed.data.name.trim(),
      cnpj: normalizedCnpj
    })
    .select('id, name, cnpj, created_at, updated_at')
    .single();

  if (error || !company) {
    return jsonError(error?.message ?? 'Falha ao criar empresa.', 500);
  }

  return jsonOk(company, 201);
}
