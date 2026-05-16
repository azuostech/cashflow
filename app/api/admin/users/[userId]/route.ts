import { z } from 'zod';
import { getSessionContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonError, jsonOk } from '@/lib/utils/http';

interface Params {
  params: {
    userId: string;
  };
}

const updateSchema = z
  .object({
    fullName: z.string().min(2).optional(),
    password: z.string().min(6).optional()
  })
  .refine((value) => value.fullName || value.password, {
    message: 'Informe ao menos um campo para atualizar.'
  });

export async function PATCH(request: Request, { params }: Params) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (session.role !== 'admin') return jsonError('Apenas administradores podem atualizar usuarios.', 403);

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return jsonError('Service role nao configurada.', 500);
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Dados invalidos para atualizar usuario.', 400);

  const { data: targetUser } = await admin
    .from('users')
    .select('id, role')
    .eq('id', params.userId)
    .maybeSingle();

  if (!targetUser) return jsonError('Usuario nao encontrado.', 404);
  if (targetUser.role === 'admin') return jsonError('Nao e permitido alterar dados de outro admin por esta tela.', 400);

  if (parsed.data.fullName) {
    const { error: profileError } = await admin
      .from('users')
      .update({ full_name: parsed.data.fullName.trim() })
      .eq('id', params.userId);

    if (profileError) return jsonError(profileError.message, 500);
  }

  if (parsed.data.password) {
    const { error: authError } = await admin.auth.admin.updateUserById(params.userId, {
      password: parsed.data.password
    });

    if (authError) return jsonError(authError.message, 500);
  }

  const { data: updated } = await admin
    .from('users')
    .select('id, email, full_name, role, created_at, last_login')
    .eq('id', params.userId)
    .maybeSingle();

  return jsonOk(updated);
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (session.role !== 'admin') return jsonError('Apenas administradores podem excluir usuarios.', 403);

  if (session.userId === params.userId) {
    return jsonError('Nao e permitido excluir seu proprio usuario.', 400);
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return jsonError('Service role nao configurada.', 500);
  }

  const { data: targetUser } = await admin
    .from('users')
    .select('id, role')
    .eq('id', params.userId)
    .maybeSingle();

  if (!targetUser) return jsonError('Usuario nao encontrado.', 404);
  if (targetUser.role === 'admin') return jsonError('Nao e permitido excluir outro admin por esta tela.', 400);

  const { error: authError } = await admin.auth.admin.deleteUser(params.userId);
  if (authError) return jsonError(authError.message, 500);

  await admin.from('users').delete().eq('id', params.userId);

  return jsonOk({ success: true });
}
