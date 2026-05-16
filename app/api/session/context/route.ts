import { getAccessibleCompanies, getSessionContext } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/utils/http';

export async function GET() {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);

  const companies = await getAccessibleCompanies(session);

  return jsonOk({
    user: {
      id: session.userId,
      email: session.email,
      fullName: session.fullName,
      role: session.role
    },
    activeCompanyId: session.companyId,
    canAccessMultipleCompanies: session.canAccessMultipleCompanies,
    companies
  });
}
