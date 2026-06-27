import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateCashflow } from '@/lib/reports/cashflow';
import { getSessionContext, isSessionError } from '@/lib/session';

export const dynamic = 'force-dynamic';

const schema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
  bankAccountId: z.string().uuid().optional()
});

type WeeklyProjection = {
  week: string;
  inflow: number;
  outflow: number;
  balance: number;
  isRisk: boolean;
};

function mondayKey(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return monday.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(today.getDate() + parsed.data.days);

  const result = await calculateCashflow(session.companyId, today, end, parsed.data.bankAccountId);
  const weekly: WeeklyProjection[] = [];
  let currentWeek = '';
  let weekInflow = 0;
  let weekOutflow = 0;
  let weekBalance = result.openingBalance;
  let weekRisk = false;

  for (const entry of result.entries) {
    const weekKey = mondayKey(entry.date);

    if (weekKey !== currentWeek) {
      if (currentWeek) {
        weekly.push({
          week: currentWeek,
          inflow: weekInflow,
          outflow: weekOutflow,
          balance: weekBalance,
          isRisk: weekRisk
        });
      }

      currentWeek = weekKey;
      weekInflow = 0;
      weekOutflow = 0;
      weekRisk = false;
    }

    weekInflow += entry.inflow + entry.inflowPending;
    weekOutflow += entry.outflow + entry.outflowPending;
    weekBalance = entry.cumulativeBalance;
    if (entry.isRisk) weekRisk = true;
  }

  if (currentWeek) {
    weekly.push({
      week: currentWeek,
      inflow: weekInflow,
      outflow: weekOutflow,
      balance: weekBalance,
      isRisk: weekRisk
    });
  }

  return NextResponse.json({
    daily: result.entries,
    weekly,
    daysOfCash: result.daysOfCash,
    totalBalance: result.closingBalance,
    projectedClose: result.projectedClosing,
    currency: result.currency
  });
}
