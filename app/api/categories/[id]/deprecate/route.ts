import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  if (!['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const category = await prisma.category.findFirst({
    where: { id: params.id, companyId: session.companyId }
  });

  if (!category) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (category.deprecatedAt) {
    return NextResponse.json({ error: 'Categoria ja esta depreciada' }, { status: 409 });
  }

  const activeChildren = await prisma.category.count({
    where: { parentId: params.id, active: true, deprecatedAt: null }
  });

  if (activeChildren > 0) {
    return NextResponse.json({ error: 'Deprecie as subcategorias antes de deprecar esta categoria' }, { status: 409 });
  }

  const updated = await prisma.category.update({
    where: { id: params.id },
    data: { deprecatedAt: new Date() }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'update',
    entityType: 'category',
    entityId: params.id,
    beforeData: category as unknown as Record<string, unknown>,
    afterData: updated as unknown as Record<string, unknown>,
    request
  });

  return NextResponse.json({ deprecated: true, deprecatedAt: updated.deprecatedAt });
}
