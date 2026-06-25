import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

interface CreateAuditLogInput {
  companyId: string;
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  justification?: string | null;
  retroactive?: boolean;
  request?: Request | null;
}

export async function createAuditLog(input: CreateAuditLogInput): Promise<void> {
  const beforeData = toJsonRecord(input.beforeData ?? null);
  const afterData = toJsonRecord(input.afterData ?? null);
  const diff = computeDiff(beforeData, afterData);

  await prisma.auditLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeData: beforeData as Prisma.InputJsonValue | undefined,
      afterData: afterData as Prisma.InputJsonValue | undefined,
      diff: diff as Prisma.InputJsonValue | undefined,
      justification: input.justification ?? null,
      retroactive: input.retroactive ?? false,
      ipAddress: input.request
        ? input.request.headers.get('x-forwarded-for') ?? input.request.headers.get('x-real-ip') ?? null
        : null,
      userAgent: input.request?.headers.get('user-agent') ?? null
    }
  });
}

function toJsonRecord(value: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!value) return null;
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function computeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): Record<string, { before: unknown; after: unknown }> | null {
  if (!before || !after) return null;

  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of Array.from(allKeys)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diff[key] = { before: before[key], after: after[key] };
    }
  }

  return Object.keys(diff).length > 0 ? diff : null;
}
