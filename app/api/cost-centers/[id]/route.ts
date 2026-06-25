import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { updateCostCenterSchema } from '@/lib/validations/settings.schema';

async function isDescendant(candidateParentId: string, childId: string, companyId: string): Promise<boolean> {
  let currentId: string | null = candidateParentId;
  const seen = new Set<string>();

  while (currentId) {
    if (currentId === childId) return true;
    if (seen.has(currentId)) return true;
    seen.add(currentId);

    const costCenterParent: { parentId: string | null } | null = await prisma.costCenter.findFirst({
      where: { id: currentId, companyId },
      select: { parentId: true }
    });

    currentId = costCenterParent?.parentId ?? null;
  }

  return false;
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const costCenter = await prisma.costCenter.findFirst({
    where: { id: params.id, companyId: session.companyId }
  });

  if (!costCenter) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(costCenter);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const costCenter = await prisma.costCenter.findFirst({
    where: { id: params.id, companyId: session.companyId }
  });

  if (!costCenter) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const parsed = updateCostCenterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  if (parsed.data.parentId) {
    const parent = await prisma.costCenter.findFirst({
      where: { id: parsed.data.parentId, companyId: session.companyId }
    });

    if (!parent) {
      return NextResponse.json({ error: 'Centro de custo pai invalido' }, { status: 422 });
    }

    if (await isDescendant(parsed.data.parentId, params.id, session.companyId)) {
      return NextResponse.json({ error: 'Centro de custo nao pode ser pai de si mesmo ou de seus ancestrais' }, { status: 422 });
    }
  }

  const updated = await prisma.costCenter.update({
    where: { id: params.id },
    data: parsed.data
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'update',
    entityType: 'cost_center',
    entityId: params.id,
    beforeData: costCenter as unknown as Record<string, unknown>,
    afterData: updated as unknown as Record<string, unknown>,
    request
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  if (!['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const costCenter = await prisma.costCenter.findFirst({
    where: { id: params.id, companyId: session.companyId }
  });

  if (!costCenter) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const linkedTransactions = await prisma.transaction.count({
    where: { costCenterId: params.id, deletedAt: null }
  });
  const activeChildren = await prisma.costCenter.count({
    where: { parentId: params.id, active: true }
  });

  if (linkedTransactions > 0) {
    return NextResponse.json({ error: 'Centro de custo possui lancamentos. Desative-o apenas apos revisar os vinculos.' }, { status: 409 });
  }

  if (activeChildren > 0) {
    return NextResponse.json({ error: 'Centro de custo possui filhos ativos. Remova-os primeiro.' }, { status: 409 });
  }

  const updated = await prisma.costCenter.update({
    where: { id: params.id },
    data: { active: false }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'delete',
    entityType: 'cost_center',
    entityId: params.id,
    beforeData: costCenter as unknown as Record<string, unknown>,
    afterData: updated as unknown as Record<string, unknown>,
    request
  });

  return NextResponse.json({ deactivated: true });
}
