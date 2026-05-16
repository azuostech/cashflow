import { cookies } from 'next/headers';
import { z } from 'zod';
import { ACTIVE_COMPANY_COOKIE, getSessionContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonError, jsonOk } from '@/lib/utils/http';

const schema = z.object({
  companyId: z.string().uuid()
});

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30
};

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);

  if (!session.canAccessMultipleCompanies) {
    return jsonError('Seu perfil nao permite trocar de empresa.', 403);
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return jsonError('Empresa invalida.', 400);

  const { companyId } = parsed.data;

  if (session.role === 'consultor' && !session.accessibleCompanyIds.includes(companyId)) {
    return jsonError('Empresa fora do seu escopo de consultoria.', 403);
  }

  if (session.role === 'admin') {
    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch {
      return jsonError('Service role nao configurada para troca de empresa.', 500);
    }

    const { data: company } = await admin.from('companies').select('id').eq('id', companyId).maybeSingle();
    if (!company) return jsonError('Empresa nao encontrada.', 404);
  }

  cookies().set(ACTIVE_COMPANY_COOKIE, companyId, cookieOptions);
  return jsonOk({ success: true, activeCompanyId: companyId });
}
