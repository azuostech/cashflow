import { ReconciliationMethod, ReconciliationStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { normalizeDescription } from '@/lib/utils/normalize';

const schema = z.object({
  description: z.string().min(3).max(500).optional(),
  categoryId: z.string().uuid(),
  costCenterId: z.string().uuid(),
  competenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  contactId: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable()
});

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const move = await prisma.bankMove.findFirst({
    where: { id: params.id, companyId: session.companyId },
    include: { bankAccount: true }
  });

  if (!move) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (move.reconciliationStatus === ReconciliationStatus.reconciled) {
    return NextResponse.json({ error: 'Movimento ja conciliado' }, { status: 409 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  const transactionType = move.type === 'credit' ? TransactionType.revenue : TransactionType.expense;
  const transactionStatus = transactionType === TransactionType.revenue ? TransactionStatus.received : TransactionStatus.paid;

  const category = await prisma.category.findFirst({
    where: {
      id: data.categoryId,
      companyId: session.companyId,
      active: true,
      deprecatedAt: null,
      type: transactionType
    }
  });
  if (!category) return NextResponse.json({ error: 'Categoria invalida' }, { status: 422 });

  const costCenter = await prisma.costCenter.findFirst({
    where: { id: data.costCenterId, companyId: session.companyId, active: true }
  });
  if (!costCenter) return NextResponse.json({ error: 'Centro de custo invalido' }, { status: 422 });

  if (data.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: data.contactId, companyId: session.companyId, active: true }
    });
    if (!contact) return NextResponse.json({ error: 'Contato invalido' }, { status: 422 });
  }

  const description = data.description ?? move.merchantName ?? move.description;
  const normalized = normalizeDescription(description);
  const competenceDate = data.competenceDate ? parseDateOnly(data.competenceDate) : move.date;

  const transaction = await prisma.$transaction(async (database) => {
    const created = await database.transaction.create({
      data: {
        companyId: session.companyId,
        type: transactionType,
        description,
        notes: data.notes ?? null,
        originalAmount: move.originalAmount,
        originalCurrency: move.originalCurrency,
        convertedAmount: move.convertedAmount,
        companyCurrency: move.companyCurrency,
        exchangeRate: move.exchangeRate,
        exchangeRateDate: move.exchangeRateDate,
        competenceDate,
        dueDate: move.date,
        paymentDate: move.date,
        status: transactionStatus,
        categoryId: data.categoryId,
        costCenterId: data.costCenterId,
        bankAccountId: move.bankAccountId,
        contactId: data.contactId ?? null,
        origin: 'bank_move',
        reconciliationStatus: ReconciliationStatus.reconciled,
        isReversal: false,
        isInstallment: false,
        hasCostCenterSplit: false,
        requiresApproval: false,
        approvalStatus: 'not_required',
        createdFromBankMoveId: move.id,
        descriptionNormalized: normalized.normalized,
        merchantName: move.merchantName ?? normalized.merchantName,
        merchantDocument: move.merchantDocument ?? normalized.merchantDocument,
        createdById: session.userId
      }
    });

    await database.reconciliation.create({
      data: {
        companyId: session.companyId,
        bankMoveId: move.id,
        transactionId: created.id,
        amountMatched: move.originalAmount,
        method: ReconciliationMethod.manual,
        confidence: null,
        status: 'active',
        reconciledById: session.userId
      }
    });

    await database.bankMove.update({
      where: { id: move.id },
      data: { reconciliationStatus: ReconciliationStatus.reconciled }
    });

    await database.reconciliationSuggestion.updateMany({
      where: {
        companyId: session.companyId,
        bankMoveId: move.id,
        status: 'pending'
      },
      data: {
        status: 'expired',
        reviewedAt: new Date(),
        reviewedById: session.userId,
        createdTransactionId: created.id
      }
    });

    return created;
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'reconcile',
    entityType: 'bank_move',
    entityId: move.id,
    afterData: {
      createdTransactionId: transaction.id,
      method: 'create_from_move',
      amountMatched: String(move.originalAmount)
    },
    request
  });

  return NextResponse.json(transaction, { status: 201 });
}
