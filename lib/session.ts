import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export interface SessionContext {
  userId: string;
  email: string;
  companyId: string;
  role: 'owner' | 'admin' | 'financial' | 'accountant' | 'viewer';
}

export async function getSessionContext(): Promise<SessionContext | NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeCompanyCookie = cookies().get('cf_active_company')?.value;
  const whereClause = activeCompanyCookie
    ? { userId: user.id, companyId: activeCompanyCookie, active: true }
    : { userId: user.id, active: true };

  const userRole = await prisma.userCompanyRole.findFirst({
    where: whereClause,
    orderBy: { acceptedAt: 'asc' }
  });

  if (!userRole) {
    return NextResponse.json({ error: 'No company access' }, { status: 403 });
  }

  return {
    userId: user.id,
    email: user.email ?? '',
    companyId: userRole.companyId,
    role: userRole.role
  };
}

export function isSessionError(value: SessionContext | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
