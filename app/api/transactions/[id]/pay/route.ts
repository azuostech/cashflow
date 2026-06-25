import { ReconciliationStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { payTransactionSchema } from '@/lib/validations/transaction.schema';

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const transaction = await prisma.transaction.findFirst({
    where: { id: params.id, companyId: session.companyId, deletedAt: null }
  });

  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (transaction.status !== TransactionStatus.pending && transaction.status !== TransactionStatus.overdue) {
    return NextResponse.json({ error: 'Lancamento nao esta pendente' }, { status: 409 });
  }
  if (transaction.reconciliationStatus === ReconciliationStatus.reconciled) {
    return NextResponse.json({ error: 'Lancamento conciliado nao pode ser pago manualmente' }, { status: 409 });
  }

  const body = await request.json();
  const parsed = payTransactionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { paymentDate, bankAccountId, amount, notes } = parsed.data;

  if (parseDateOnly(paymentDate) > new Date()) {
    return NextResponse.json({ error: 'Data de pagamento nao pode ser futura' }, { status: 422 });
  }

  if (amount !== undefined && Math.round(amount * 100) !== Math.round(Number(transaction.originalAmount) * 100)) {
    return NextResponse.json({ error: 'Pagamento parcial ainda nao e suportado nesta etapa' }, { status: 422 });
  }

  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, companyId: session.companyId, active: true }
  });
  if (!account) return NextResponse.json({ error: 'Conta bancaria invalida' }, { status: 422 });

  const newStatus = transaction.type === TransactionType.revenue ? TransactionStatus.received : TransactionStatus.paid;

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data: {
      status: newStatus,
      paymentDate: parseDateOnly(paymentDate),
      bankAccountId,
      ...(notes ? { notes } : {})
    }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'update',
    entityType: 'transaction',
    entityId: params.id,
    beforeData: { status: transaction.status, paymentDate: transaction.paymentDate },
    afterData: { status: newStatus, paymentDate },
    request
  });

  return NextResponse.json(updated);
}
