import { ReconciliationStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const move = await prisma.bankMove.findFirst({
    where: { id: params.id, companyId: session.companyId }
  });

  if (!move) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (move.reconciliationStatus === ReconciliationStatus.reconciled) {
    return NextResponse.json({ error: 'Movimento ja conciliado' }, { status: 409 });
  }

  const isIgnoring = move.reconciliationStatus !== ReconciliationStatus.ignored;
  const newStatus = isIgnoring ? ReconciliationStatus.ignored : ReconciliationStatus.unreconciled;

  await prisma.bankMove.update({
    where: { id: params.id },
    data: { reconciliationStatus: newStatus }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'adjust',
    entityType: 'bank_move',
    entityId: params.id,
    beforeData: { reconciliationStatus: move.reconciliationStatus },
    afterData: { reconciliationStatus: newStatus },
    request
  });

  return NextResponse.json({
    ignored: isIgnoring,
    reconciliationStatus: newStatus
  });
}
