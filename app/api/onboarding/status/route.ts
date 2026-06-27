import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getHomeRoute } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    return NextResponse.json({ step: 1, hasCompany: false });
  }

  const { company } = role;
  const hasBankAccount = company.bankAccounts.length > 0;
  const hasCostCenter = company.costCenters.length > 0;
  const hasCategory = company.categories.length > 0;

  let step: number | 'complete' = 'complete';
  if (!hasCostCenter) step = hasBankAccount ? 3 : 2;
  if (!hasCategory && hasCostCenter) step = 4;

  const homeRoute = getHomeRoute(role.role);
  const cookieStore = cookies();
  cookieStore.set('cf_active_company', company.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
  cookieStore.set('cf_home_route', homeRoute, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });

  return NextResponse.json({
    step,
    hasCompany: true,
    companyId: company.id,
    companyName: company.name,
    role: role.role,
    homeRoute,
    hasBankAccount,
    hasCostCenter,
    hasCategory
  });
}
