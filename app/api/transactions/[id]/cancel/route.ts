import { ReconciliationStatus, TransactionStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { cancelTransactionSchema } from '@/lib/validations/transaction.schema';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const transaction = await prisma.transaction.findFirst({
    where: { id: params.id, companyId: session.companyId, deletedAt: null }
  });

  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (transaction.status === TransactionStatus.cancelled) {
    return NextResponse.json({ error: 'Lancamento ja cancelado' }, { status: 409 });
  }
  if (transaction.reconciliationStatus === ReconciliationStatus.reconciled) {
    return NextResponse.json({ error: 'Desconcilie o lancamento antes de cancelar' }, { status: 409 });
  }

  const body = await request.json();
  const parsed = cancelTransactionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  await prisma.$transaction(async (database) => {
    await database.transaction.update({
      where: { id: params.id },
      data: { status: TransactionStatus.cancelled }
    });

    await database.installment.updateMany({
      where: { transactionId: params.id, status: TransactionStatus.pending },
      data: { status: TransactionStatus.cancelled }
    });

    if (parsed.data.cancelFuture && transaction.recurrenceRuleId) {
      await database.transaction.updateMany({
        where: {
          companyId: session.companyId,
          recurrenceParentId: params.id,
          status: TransactionStatus.pending,
          deletedAt: null
        },
        data: { status: TransactionStatus.cancelled }
      });

      await database.recurrenceRule.update({
        where: { id: transaction.recurrenceRuleId },
        data: { active: false }
      });
    }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'cancel',
    entityType: 'transaction',
    entityId: params.id,
    beforeData: { status: transaction.status },
    afterData: { status: TransactionStatus.cancelled },
    justification: parsed.data.justification,
    request
  });

  return NextResponse.json({ cancelled: true });
}
