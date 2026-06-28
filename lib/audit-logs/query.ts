import { AuditAction, Prisma } from '@prisma/client';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

export function buildAuditLogWhere(companyId: string, searchParams: URLSearchParams): Prisma.AuditLogWhereInput {
  const action = searchParams.get('action');
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  const userId = searchParams.get('userId');
  const query = searchParams.get('q')?.trim();
  const from = parseDate(searchParams.get('from'));
  const to = parseDate(searchParams.get('to'), true);
  const where: Prisma.AuditLogWhereInput = { companyId };

  if (action && Object.values(AuditAction).includes(action as AuditAction)) {
    where.action = action as AuditAction;
  }

  if (entityType) {
    where.entityType = entityType;
  }

  if (entityId && UUID_PATTERN.test(entityId)) {
    where.entityId = entityId;
  }

  if (userId && UUID_PATTERN.test(userId)) {
    where.userId = userId;
  }

  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {})
    };
  }

  if (query) {
    const textSearch: Prisma.AuditLogWhereInput[] = [
      { entityType: { contains: query, mode: 'insensitive' } },
      { user: { is: { name: { contains: query, mode: 'insensitive' } } } },
      { user: { is: { email: { contains: query, mode: 'insensitive' } } } }
    ];

    if (UUID_PATTERN.test(query)) {
      textSearch.push({ entityId: query });
    }

    where.AND = [{ OR: textSearch }];
  }

  return where;
}

export function parseAuditLimit(searchParams: URLSearchParams, max = 500) {
  const limit = Number(searchParams.get('limit') ?? 100);
  if (!Number.isFinite(limit) || limit <= 0) return 100;
  return Math.min(Math.trunc(limit), max);
}
