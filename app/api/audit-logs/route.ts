import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('entityType');
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);

  const logs = await prisma.auditLog.findMany({
    where: {
      companyId: session.companyId,
      ...(entityType ? { entityType } : {})
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: Number.isFinite(limit) ? limit : 50
  });

  return NextResponse.json(logs);
}
