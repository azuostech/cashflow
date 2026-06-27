import { NextResponse } from 'next/server';
import { getFinancialCenterSummary } from '@/lib/dashboard/financial-center';
import { getSessionContext, isSessionError } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const summary = await getFinancialCenterSummary(session.companyId);

  return NextResponse.json(summary);
}
