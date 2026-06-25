import {
  ReconciliationMethod,
  ReconciliationStatus,
  TransactionStatus,
  TransactionType
} from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';

const reconcileSchema = z
  .object({
    bankMoveId: z.string().uuid(),
    transactionId: z.string().uuid().optional().nullable(),
    installmentId: z.string().uuid().optional().nullable()
  })
  .refine((data) => Boolean(data.transactionId) !== Boolean(data.installmentId), {
    message: 'Informe transactionId ou installmentId'
  });

function paidStatus(type: TransactionType): TransactionStatus {
  return type === TransactionType.revenue ? TransactionStatus.received : TransactionStatus.paid;
}

async function updateParentTransactionReconciliation(
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

export async function POST(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const body = await request.json();
  const parsed = reconcileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { bankMoveId, transactionId, installmentId } = parsed.data;

  const move = await prisma.bankMove.findFirst({
    where: { id: bankMoveId, companyId: session.companyId }
  });

  if (!move) return NextResponse.json({ error: 'BankMove nao encontrado' }, { status: 404 });
  if (move.reconciliationStatus === ReconciliationStatus.reconciled) {
    return NextResponse.json({ error: 'Movimento ja conciliado' }, { status: 409 });
  }

  const transaction = transactionId
    ? await prisma.transaction.findFirst({
        where: { id: transactionId, companyId: session.companyId, deletedAt: null }
      })
    : null;

  if (transactionId && !transaction) {
    return NextResponse.json({ error: 'Lancamento nao encontrado' }, { status: 404 });
  }
  if (transaction?.reconciliationStatus === ReconciliationStatus.reconciled) {
    return NextResponse.json({ error: 'Lancamento ja conciliado' }, { status: 409 });
  }

  const installment = installmentId
    ? await prisma.installment.findFirst({
        where: { id: installmentId, companyId: session.companyId },
        include: { transaction: true }
      })
    : null;

  if (installmentId && !installment) {
    return NextResponse.json({ error: 'Parcela nao encontrada' }, { status: 404 });
  }
  if (installment?.reconciliationStatus === ReconciliationStatus.reconciled) {
    return NextResponse.json({ error: 'Parcela ja conciliada' }, { status: 409 });
  }
  if (installment?.transaction.deletedAt) {
    return NextResponse.json({ error: 'Lancamento da parcela excluido' }, { status: 404 });
  }

  const reconciliation = await prisma.$transaction(async (database) => {
    const created = await database.reconciliation.create({
      data: {
        companyId: session.companyId,
        bankMoveId,
        transactionId: transactionId ?? null,
        installmentId: installmentId ?? null,
        amountMatched: move.originalAmount,
        method: ReconciliationMethod.manual,
        confidence: null,
        status: 'active',
        reconciledById: session.userId
      }
    });

    await database.bankMove.update({
      where: { id: bankMoveId },
      data: { reconciliationStatus: ReconciliationStatus.reconciled }
    });

    if (transaction) {
      await database.transaction.update({
        where: { id: transaction.id },
        data: {
          reconciliationStatus: ReconciliationStatus.reconciled,
          paymentDate: move.date,
          status: paidStatus(transaction.type),
          bankAccountId: move.bankAccountId
        }
      });
    }

    if (installment) {
      await database.installment.update({
        where: { id: installment.id },
        data: {
          reconciliationStatus: ReconciliationStatus.reconciled,
          paymentDate: move.date,
          status: paidStatus(installment.transaction.type),
          bankAccountId: move.bankAccountId
        }
      });

      await updateParentTransactionReconciliation(database, installment.transactionId);
    }

    await database.reconciliationSuggestion.updateMany({
      where: {
        companyId: session.companyId,
        bankMoveId,
        status: 'pending',
        transactionId: transactionId ?? null,
        installmentId: installmentId ?? null
      },
      data: {
        status: 'accepted',
        reviewedAt: new Date(),
        reviewedById: session.userId
      }
    });

    await database.reconciliationSuggestion.updateMany({
      where: {
        companyId: session.companyId,
        bankMoveId,
        status: 'pending'
      },
      data: {
        status: 'expired'
      }
    });

    return created;
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'reconcile',
    entityType: 'reconciliation',
    entityId: reconciliation.id,
    afterData: {
      bankMoveId,
      transactionId: transactionId ?? null,
      installmentId: installmentId ?? null,
      amountMatched: String(move.originalAmount)
    },
    request
  });

  return NextResponse.json(reconciliation, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const bankMoveId = searchParams.get('bankMoveId');

  const reconciliations = await prisma.reconciliation.findMany({
    where: {
      ...(bankMoveId ? { bankMoveId } : {}),
      bankMove: { companyId: session.companyId },
      status: 'active'
    },
    include: {
      bankMove: {
        select: {
          id: true,
          description: true,
          date: true,
          originalAmount: true,
          originalCurrency: true
        }
      },
      transaction: { select: { id: true, description: true, status: true } },
      installment: {
        select: {
          id: true,
          number: true,
          status: true,
          transaction: { select: { id: true, description: true } }
        }
      }
    },
    orderBy: { reconciledAt: 'desc' },
    take: 50
  });

  return NextResponse.json(reconciliations);
}
