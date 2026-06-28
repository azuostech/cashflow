import { NextRequest, NextResponse } from 'next/server';
import { buildAuditLogWhere, parseAuditLimit } from '@/lib/audit-logs/query';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const limit = parseAuditLimit(searchParams);

  const logs = await prisma.auditLog.findMany({
    where: buildAuditLogWhere(session.companyId, searchParams),
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return NextResponse.json(logs);
}
