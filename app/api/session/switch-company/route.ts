import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getHomeRoute } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({
  companyId: z.string().uuid()
});

function setSessionCookies(companyId: string, homeRoute: string) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  };

  cookies().set('cf_active_company', companyId, cookieOptions);
  cookies().set('cf_home_route', homeRoute, cookieOptions);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Empresa invalida' }, { status: 422 });
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = await prisma.userCompanyRole.findFirst({
    where: {
      userId: user.id,
      companyId: parsed.data.companyId,
      active: true,
      acceptedAt: { not: null }
    },
    include: { company: true }
  });

  if (!role) {
    return NextResponse.json({ error: 'Sem acesso a esta empresa' }, { status: 403 });
  }

  const homeRoute = getHomeRoute(role.role);
  setSessionCookies(role.companyId, homeRoute);

  return NextResponse.json({
    companyId: role.companyId,
    companyName: role.company.name,
    role: role.role,
    homeRoute
  });
}
