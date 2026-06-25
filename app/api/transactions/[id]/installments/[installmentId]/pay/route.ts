import { ReconciliationStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { payInstallmentSchema } from '@/lib/validations/transaction.schema';

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; installmentId: string } }
) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const installment = await prisma.installment.findFirst({
    where: { id: params.installmentId, transactionId: params.id, companyId: session.companyId }
  });

  if (!installment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (installment.status !== TransactionStatus.pending) {
    return NextResponse.json({ error: 'Parcela nao esta pendente' }, { status: 409 });
  }
  if (installment.reconciliationStatus === ReconciliationStatus.reconciled) {
    return NextResponse.json({ error: 'Parcela conciliada nao pode ser paga manualmente' }, { status: 409 });
  }

  const body = await request.json();
  const parsed = payInstallmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  if (parseDateOnly(parsed.data.paymentDate) > new Date()) {
    return NextResponse.json({ error: 'Data nao pode ser futura' }, { status: 422 });
  }

  if (parsed.data.amount !== undefined) {
    const paidCents = Math.round(parsed.data.amount * 100);
    const installmentCents = Math.round(Number(installment.originalAmount) * 100);
    if (paidCents !== installmentCents) {
      return NextResponse.json({ error: 'Pagamento parcial ainda nao e suportado nesta etapa' }, { status: 422 });
    }
  }

  const account = await prisma.bankAccount.findFirst({
    where: { id: parsed.data.bankAccountId, companyId: session.companyId, active: true }
  });
  if (!account) return NextResponse.json({ error: 'Conta invalida' }, { status: 422 });

  const parent = await prisma.transaction.findFirst({
    where: { id: params.id, companyId: session.companyId, deletedAt: null },
    select: { type: true, status: true }
  });
  if (!parent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newStatus = parent.type === TransactionType.revenue ? TransactionStatus.received : TransactionStatus.paid;

  const { updated, parentUpdated } = await prisma.$transaction(async (database) => {
    const updatedInstallment = await database.installment.update({
      where: { id: params.installmentId },
      data: {
        status: newStatus,
        paymentDate: parseDateOnly(parsed.data.paymentDate),
        bankAccountId: parsed.data.bankAccountId
      }
    });

    const pendingCount = await database.installment.count({
      where: {
        transactionId: params.id,
        companyId: session.companyId,
        status: { in: [TransactionStatus.pending, TransactionStatus.overdue] }
      }
    });

    let updatedParent = false;
    if (pendingCount === 0 && parent.status !== newStatus) {
      await database.transaction.update({
        where: { id: params.id },
        data: {
          status: newStatus,
          paymentDate: parseDateOnly(parsed.data.paymentDate),
          bankAccountId: parsed.data.bankAccountId
        }
      });
      updatedParent = true;
    }

    return { updated: updatedInstallment, parentUpdated: updatedParent };
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'update',
    entityType: 'installment',
    entityId: params.installmentId,
    beforeData: { status: installment.status },
    afterData: { status: newStatus, paymentDate: parsed.data.paymentDate },
    request
  });

  if (parentUpdated) {
    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'update',
      entityType: 'transaction',
      entityId: params.id,
      beforeData: { status: parent.status },
      afterData: { status: newStatus, paymentDate: parsed.data.paymentDate, reason: 'all_installments_paid' },
      request
    });
  }

  return NextResponse.json(updated);
}
