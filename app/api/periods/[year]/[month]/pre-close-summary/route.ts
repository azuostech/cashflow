import { NextRequest, NextResponse } from 'next/server';
import { getPreCloseSummary, isValidPeriod } from '@/lib/periods/close';
import { getSessionContext, isSessionError } from '@/lib/session';

export async function GET(_request: NextRequest, { params }: { params: { year: string; month: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const year = Number(params.year);
  const month = Number(params.month);

  if (!isValidPeriod(year, month)) {
    return NextResponse.json({ error: 'Periodo invalido' }, { status: 400 });
  }

  const summary = await getPreCloseSummary(session.companyId, year, month);
  return NextResponse.json(summary);
}
