import { NextRequest, NextResponse } from 'next/server';
import { buildAuditLogWhere, parseAuditLimit } from '@/lib/audit-logs/query';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';

function csvCell(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const limit = parseAuditLimit(searchParams, 5000);
  const logs = await prisma.auditLog.findMany({
    where: buildAuditLogWhere(session.companyId, searchParams),
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  const headers = [
    'created_at',
    'action',
    'entity_type',
    'entity_id',
    'user_name',
    'user_email',
    'justification',
    'retroactive',
    'before_data',
    'after_data',
    'diff'
  ];

  const rows = logs.map((log) =>
    [
      log.createdAt,
      log.action,
      log.entityType,
      log.entityId,
      log.user?.name ?? '',
      log.user?.email ?? '',
      log.justification ?? '',
      log.retroactive,
      log.beforeData,
      log.afterData,
      log.diff
    ]
      .map(csvCell)
      .join(',')
  );

  const csv = [headers.map(csvCell).join(','), ...rows].join('\n');
  const fileName = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`
    }
  });
}
