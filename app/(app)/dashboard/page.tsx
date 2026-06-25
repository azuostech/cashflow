import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = await prisma.userCompanyRole.findFirst({
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

  const cards = ['Saldo total', 'Receita do mes', 'Despesa do mes', 'Resultado'];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mb-6 text-sm text-gray-500">Bem-vindo ao CashFlowAI, {role.company.name}.</p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((label) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">{label}</p>
            <p className="text-xl font-semibold text-gray-300">--</p>
            <p className="mt-1 text-xs text-gray-400">Etapa 07</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="mb-1 text-sm font-medium text-emerald-800">Etapa 02 concluida</p>
        <p className="text-xs text-emerald-700">
          Auth, onboarding, empresa, contas bancarias, centros de custo e categorias estao prontos. Proxima etapa: Cadastros Base.
        </p>
      </div>
    </div>
  );
}
