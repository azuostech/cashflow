import { z } from 'zod';
import { getSessionContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonError, jsonOk } from '@/lib/utils/http';

interface Params {
  params: {
    companyId: string;
  };
}

const createUserSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

export async function GET(_: Request, { params }: Params) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (session.role !== 'admin') return jsonError('Apenas administradores podem gerenciar usuarios.', 403);

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return jsonError('Service role nao configurada.', 500);
  }

  const { data: company } = await admin
    .from('companies')
    .select('id, name, cnpj, created_at')
    .eq('id', params.companyId)
    .maybeSingle();

  if (!company) return jsonError('Empresa nao encontrada.', 404);

  const { data: users, error } = await admin
    .from('users')
    .select('id, email, full_name, role, created_at, last_login')
    .eq('company_id', params.companyId)
    .order('created_at', { ascending: true });

  if (error) return jsonError(error.message, 500);

  return jsonOk({
    company,
    users: users ?? []
  });
}

export async function POST(request: Request, { params }: Params) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (session.role !== 'admin') return jsonError('Apenas administradores podem criar usuarios.', 403);

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return jsonError('Service role nao configurada.', 500);
  }

  const parsed = createUserSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return jsonError('Dados invalidos para criar usuario.', 400);

  const { data: company } = await admin.from('companies').select('id').eq('id', params.companyId).maybeSingle();
  if (!company) return jsonError('Empresa nao encontrada.', 404);

  const email = parsed.data.email.toLowerCase().trim();
  const fullName = parsed.data.fullName.trim();

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      company_id: params.companyId,
      role: 'cliente'
    }
  });

  if (authError || !authUser.user) {
    return jsonError(authError?.message ?? 'Falha ao criar usuario no auth.', 500);
  }

  const { data: profile, error: profileError } = await admin
    .from('users')
    .insert({
      id: authUser.user.id,
      company_id: params.companyId,
      email,
      full_name: fullName,
      role: 'cliente',
      password_hash: ''
    })
    .select('id, email, full_name, role, created_at, last_login')
    .single();

  if (profileError || !profile) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return jsonError(profileError?.message ?? 'Falha ao criar perfil do usuario.', 500);
  }

  return jsonOk(profile, 201);
}
