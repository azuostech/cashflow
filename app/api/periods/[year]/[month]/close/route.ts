import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { closePeriod, isValidPeriod } from '@/lib/periods/close';
import { getSessionContext, isSessionError } from '@/lib/session';

const schema = z.object({
  notes: z.string().max(1000).optional().nullable()
});

function isFuturePeriod(year: number, month: number) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return year > currentYear || (year === currentYear && month > currentMonth);
}

export async function POST(request: NextRequest, { params }: { params: { year: string; month: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  if (!['owner', 'admin', 'financial'].includes(session.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const year = Number(params.year);
  const month = Number(params.month);

  if (!isValidPeriod(year, month)) {
    return NextResponse.json({ error: 'Periodo invalido' }, { status: 400 });
  }

  if (isFuturePeriod(year, month)) {
    return NextResponse.json({ error: 'Nao e possivel fechar um periodo futuro' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  try {
    await closePeriod(session.companyId, year, month, session.userId, parsed.data.notes ?? undefined, request);
    return NextResponse.json({ closed: true, year, month });
  } catch (error) {
    const exception = error as Error;
    return NextResponse.json({ error: exception.message }, { status: 409 });
  }
}
