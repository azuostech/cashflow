import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from './dashboard-client';

function getDatabaseHostLabel(): string {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return 'DATABASE_URL nao configurada';

  try {
    const url = new URL(rawUrl);
    return `${url.hostname}${url.port ? `:${url.port}` : ''}`;
  } catch {
    return 'DATABASE_URL invalida';
  }
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let role;
  try {
    role = await prisma.userCompanyRole.findFirst({
      where: { userId: user.id, active: true },
      include: {
        company: {
          include: {
            bankAccounts: { where: { active: true }, take: 1 },
            costCenters: { where: { active: true }, take: 1 },
            categories: { where: { active: true }, take: 1 }
          }
        }
      },
      orderBy: { acceptedAt: 'asc' }
    });
  } catch (error) {
    console.error('Dashboard database connection error:', error);

    return (
      <div className="max-w-2xl rounded-lg border border-red-200 bg-white p-5">
        <p className="text-sm font-semibold text-red-700">Banco de dados indisponivel</p>
        <p className="mt-2 text-sm text-gray-600">
          O app autenticou no Supabase, mas o Prisma nao conseguiu conectar ao Postgres configurado em
          {' '}
          <span className="font-medium text-gray-900">{getDatabaseHostLabel()}</span>.
        </p>
        <p className="mt-3 text-sm text-gray-500">
          Atualize `DATABASE_URL` e `DIRECT_URL` com a string de conexao correta do Supabase. Se a senha tiver caracteres
          especiais, use a senha percent-encoded.
        </p>
      </div>
    );
  }

  if (!role) {
    redirect('/onboarding');
  }

  const hasBankAccount = role.company.bankAccounts.length > 0;
  const hasCostCenter = role.company.costCenters.length > 0;
  const hasCategory = role.company.categories.length > 0;

  if (!hasCostCenter) {
    redirect(`/onboarding?step=${hasBankAccount ? 3 : 2}`);
  }

  if (!hasCategory) {
    redirect('/onboarding?step=4');
  }

  return <DashboardClient companyName={role.company.name} />;
}
