import { endOfMonth, startOfMonth } from 'date-fns';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDashboardKPIs } from '@/lib/dashboard/kpis';
import { getSessionContext, isSessionError } from '@/lib/session';

export const dynamic = 'force-dynamic';

const schema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
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

  const now = new Date();
  const start = parsed.data.startDate ? parseDateOnly(parsed.data.startDate) : startOfMonth(now);
  const end = parsed.data.endDate ? parseDateOnly(parsed.data.endDate) : endOfMonth(now);

  if (start > end) {
    return NextResponse.json({ error: 'startDate must be before endDate' }, { status: 422 });
  }

  const kpis = await getDashboardKPIs(session.companyId, start, end);

  return NextResponse.json(kpis);
}
