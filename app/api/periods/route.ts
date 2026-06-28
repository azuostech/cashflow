import { AccountingPeriodStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPeriodDates } from '@/lib/periods/close';
import { getSessionContext, isSessionError, type SessionContext } from '@/lib/session';

function clampLimit(value: string | null): number {
  const parsed = Number(value ?? 24);
  if (!Number.isFinite(parsed)) return 24;
  return Math.min(Math.max(Math.trunc(parsed), 1), 60);
}

function canClose(status: AccountingPeriodStatus, role: SessionContext['role'], future: boolean) {
  return !future && status === AccountingPeriodStatus.open && ['owner', 'admin', 'financial'].includes(role);
}

function canReopen(status: AccountingPeriodStatus, role: SessionContext['role']) {
  return status === AccountingPeriodStatus.closed && ['owner', 'admin'].includes(role);
}

function canLock(status: AccountingPeriodStatus, role: SessionContext['role']) {
  return status === AccountingPeriodStatus.closed && role === 'owner';
}

function canUnlock(status: AccountingPeriodStatus, role: SessionContext['role']) {
  return status === AccountingPeriodStatus.locked && role === 'owner';
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get('limit'));

  const existing = await prisma.accountingPeriod.findMany({
    where: { companyId: session.companyId },
    include: {
      closedBy: { select: { name: true, email: true } },
      reopenedBy: { select: { name: true, email: true } }
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: limit
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const months = [];

  for (let index = 0; index < limit; index += 1) {
    const date = new Date(currentYear, currentMonth - 1 - index, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const period = existing.find((item) => item.year === year && item.month === month) ?? null;
    const status = period?.status ?? AccountingPeriodStatus.open;
    const future = year > currentYear || (year === currentYear && month > currentMonth);
    const dates = getPeriodDates(year, month);

    months.push({
      year,
      month,
      label: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      status,
      periodStart: dates.start,
      periodEnd: dates.end,
      period,
      canClose: canClose(status, session.role, future),
      canReopen: canReopen(status, session.role),
      canLock: canLock(status, session.role),
      canUnlock: canUnlock(status, session.role)
    });
  }

  return NextResponse.json(months);
}
