import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateCashflow } from '@/lib/reports/cashflow';
import { getSessionContext, isSessionError } from '@/lib/session';

const schema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bankAccountId: z.string().uuid().optional(),
  riskThreshold: z.coerce.number().default(0)
});

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const query = parsed.data;
  const result = await calculateCashflow(
    session.companyId,
    parseDateOnly(query.startDate),
    parseDateOnly(query.endDate),
    query.bankAccountId,
    query.riskThreshold
  );

  return NextResponse.json(result);
}
