import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidPeriod, reopenPeriod } from '@/lib/periods/close';
import { getSessionContext, isSessionError } from '@/lib/session';

const schema = z.object({
  justification: z.string().min(20, 'Justificativa obrigatoria (minimo 20 caracteres)')
});

export async function POST(request: NextRequest, { params }: { params: { year: string; month: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  if (!['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Apenas admin ou owner podem reabrir periodos' }, { status: 403 });
  }

  const year = Number(params.year);
  const month = Number(params.month);

  if (!isValidPeriod(year, month)) {
    return NextResponse.json({ error: 'Periodo invalido' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  try {
    await reopenPeriod(session.companyId, year, month, session.userId, parsed.data.justification, request);
    return NextResponse.json({ reopened: true, year, month });
  } catch (error) {
    const exception = error as Error;
    return NextResponse.json({ error: exception.message }, { status: 409 });
  }
}
