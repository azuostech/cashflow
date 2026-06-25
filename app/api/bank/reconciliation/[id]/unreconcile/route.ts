import { ReconciliationStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';

const schema = z.object({
  justification: z.string().min(10, 'Justificativa obrigatoria (minimo 10 caracteres)')
});

async function refreshInstallmentParent(
  database: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  transactionId: string
) {
  const [total, reconciled] = await Promise.all([
    database.installment.count({ where: { transactionId } }),
    database.installment.count({
      where: {
        transactionId,
        reconciliationStatus: ReconciliationStatus.reconciled
      }
    })
  ]);

  if (total === 0) return;

  await database.transaction.update({
    where: { id: transactionId },
    data: {
      reconciliationStatus:
        reconciled === 0
          ? ReconciliationStatus.unreconciled
          : reconciled === total
            ? ReconciliationStatus.reconciled
            : ReconciliationStatus.partial
    }
  });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  if (!['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const reconciliation = await prisma.reconciliation.findFirst({
    where: { id: params.id },
    include: {
      bankMove: true,
      installment: { select: { id: true, transactionId: true } }
    }
  });

  if (!reconciliation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (reconciliation.companyId !== session.companyId || reconciliation.bankMove.companyId !== session.companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (reconciliation.status !== 'active') {
    return NextResponse.json({ error: 'Conciliacao nao esta ativa' }, { status: 409 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  await prisma.$transaction(async (database) => {
    await database.reconciliation.update({
      where: { id: params.id },
      data: {
        status: 'reversed',
        unreconciledById: session.userId,
        unreconciledAt: new Date(),
        unreconcileReason: parsed.data.justification
      }
    });

    const activeBankMoveCount = await database.reconciliation.count({
      where: { bankMoveId: reconciliation.bankMoveId, status: 'active' }
    });

    await database.bankMove.update({
      where: { id: reconciliation.bankMoveId },
      data: {
        reconciliationStatus: activeBankMoveCount > 0 ? ReconciliationStatus.partial : ReconciliationStatus.unreconciled
      }
    });

    if (reconciliation.transactionId) {
      const activeTransactionCount = await database.reconciliation.count({
        where: { transactionId: reconciliation.transactionId, status: 'active' }
      });

      if (activeTransactionCount === 0) {
        await database.transaction.update({
          where: { id: reconciliation.transactionId },
          data: { reconciliationStatus: ReconciliationStatus.unreconciled }
        });
      }
    }

    if (reconciliation.installmentId) {
      const activeInstallmentCount = await database.reconciliation.count({
        where: { installmentId: reconciliation.installmentId, status: 'active' }
      });

      if (activeInstallmentCount === 0) {
        await database.installment.update({
          where: { id: reconciliation.installmentId },
          data: { reconciliationStatus: ReconciliationStatus.unreconciled }
        });
      }

      if (reconciliation.installment?.transactionId) {
        await refreshInstallmentParent(database, reconciliation.installment.transactionId);
      }
    }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'unreconcile',
    entityType: 'reconciliation',
    entityId: params.id,
    beforeData: {
      status: reconciliation.status,
      bankMoveId: reconciliation.bankMoveId,
      transactionId: reconciliation.transactionId,
      installmentId: reconciliation.installmentId
    },
    afterData: { status: 'reversed' },
    justification: parsed.data.justification,
    request
  });

  return NextResponse.json({ unreconciled: true });
}
