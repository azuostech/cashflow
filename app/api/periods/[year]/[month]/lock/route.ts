import { NextRequest, NextResponse } from 'next/server';
import { isValidPeriod, lockPeriod } from '@/lib/periods/close';
import { getSessionContext, isSessionError } from '@/lib/session';

export async function POST(request: NextRequest, { params }: { params: { year: string; month: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  if (session.role !== 'owner') {
    return NextResponse.json({ error: 'Apenas o owner pode bloquear periodos' }, { status: 403 });
  }

  const year = Number(params.year);
  const month = Number(params.month);

  if (!isValidPeriod(year, month)) {
    return NextResponse.json({ error: 'Periodo invalido' }, { status: 400 });
  }

  try {
    await lockPeriod(session.companyId, year, month, session.userId, request);
    return NextResponse.json({ locked: true, year, month });
  } catch (error) {
    const exception = error as Error;
    return NextResponse.json({ error: exception.message }, { status: 409 });
  }
}
