import {
  Prisma,
  ReconciliationStatus,
  TransactionStatus,
  TransactionType
} from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { guardPeriod, calcConvertedAmount } from '@/lib/transactions/domain';
import { updateTransactionSchema, type UpdateTransactionInput } from '@/lib/validations/transaction.schema';

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function dateFrom(value: string | Date): Date {
  return typeof value === 'string' ? parseDateOnly(value) : value;
}

function hasKey<T extends object>(value: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

async function validateCategory(companyId: string, categoryId: string, transactionType: TransactionType) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, companyId, active: true, deprecatedAt: null }
  });

  if (!category) return 'Categoria invalida ou depreciada';

  const typeMatches =
    (transactionType === TransactionType.revenue && category.type === TransactionType.revenue) ||
    (transactionType !== TransactionType.revenue && category.type !== TransactionType.revenue);

  return typeMatches ? null : 'Tipo da categoria incompativel com o tipo do lancamento';
}

async function validateUpdateRelations(
  data: UpdateTransactionInput,
  transaction: {
    type: TransactionType;
    status: TransactionStatus;
    categoryId: string | null;
    costCenterId: string | null;
    bankAccountId: string | null;
    destBankAccountId: string | null;
    contactId: string | null;
    paymentDate: Date | null;
  },
  companyId: string
): Promise<string | null> {
  const finalStatus = (data.status as TransactionStatus | undefined) ?? transaction.status;
  const finalCategoryId = data.categoryId === undefined ? transaction.categoryId : data.categoryId;
  const finalCostCenterId = data.costCenterId === undefined ? transaction.costCenterId : data.costCenterId;
  const finalBankAccountId = data.bankAccountId === undefined ? transaction.bankAccountId : data.bankAccountId;
  const finalDestBankAccountId =
    data.destBankAccountId === undefined ? transaction.destBankAccountId : data.destBankAccountId;
  const finalContactId = data.contactId === undefined ? transaction.contactId : data.contactId;
  const finalPaymentDate = data.paymentDate === undefined ? transaction.paymentDate : data.paymentDate;

  if (transaction.type !== TransactionType.transfer) {
    if (!finalCategoryId) return 'categoryId obrigatorio';
    if (!finalCostCenterId) return 'costCenterId obrigatorio';

    const categoryError = await validateCategory(companyId, finalCategoryId, transaction.type);
    if (categoryError) return categoryError;

    const costCenter = await prisma.costCenter.findFirst({
      where: { id: finalCostCenterId, companyId, active: true }
    });
    if (!costCenter) return 'Centro de custo invalido';
  } else {
    if (!finalBankAccountId || !finalDestBankAccountId) {
      return 'Contas de origem e destino obrigatorias para transferencia';
    }
    if (finalBankAccountId === finalDestBankAccountId) {
      return 'Conta de origem e destino nao podem ser iguais';
    }
  }

  if (finalBankAccountId) {
    const account = await prisma.bankAccount.findFirst({
      where: { id: finalBankAccountId, companyId, active: true }
    });
    if (!account) return 'Conta bancaria invalida';
  }

  if (finalDestBankAccountId) {
    const account = await prisma.bankAccount.findFirst({
      where: { id: finalDestBankAccountId, companyId, active: true }
    });
    if (!account) return 'Conta bancaria de destino invalida';
  }

  if (finalContactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: finalContactId, companyId, active: true }
    });
    if (!contact) return 'Contato invalido';
  }

  if (finalStatus === TransactionStatus.paid || finalStatus === TransactionStatus.received) {
    if (!finalPaymentDate) return 'Data de pagamento obrigatoria';
    if (!finalBankAccountId) return 'Conta bancaria obrigatoria';
    if (dateFrom(finalPaymentDate) > new Date()) return 'Data de pagamento nao pode ser futura';
  }

  return null;
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const transaction = await prisma.transaction.findFirst({
    where: { id: params.id, companyId: session.companyId, deletedAt: null },
    include: {
      category: { select: { id: true, name: true, color: true, type: true } },
      costCenter: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true, type: true } },
      bankAccount: { select: { id: true, name: true, currency: true } },
      destBankAccount: { select: { id: true, name: true, currency: true } },
      installments: { orderBy: { number: 'asc' } },
      recurrenceRule: true
    }
  });

  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(transaction);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const transaction = await prisma.transaction.findFirst({
    where: { id: params.id, companyId: session.companyId, deletedAt: null }
  });
  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (transaction.status === TransactionStatus.cancelled) {
    return NextResponse.json({ error: 'Lancamento cancelado nao pode ser editado' }, { status: 409 });
  }

  if (transaction.status === TransactionStatus.paid || transaction.status === TransactionStatus.received) {
    if (!['owner', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Apenas admin pode editar lancamentos ja pagos' }, { status: 403 });
    }
  }

  const body = await request.json();
  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const data = parsed.data;
  const relationError = await validateUpdateRelations(data, transaction, session.companyId);
  if (relationError) return NextResponse.json({ error: relationError }, { status: 422 });

  const company = await prisma.company.findUnique({ where: { id: session.companyId } });
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

  let convertedAmount: number | undefined;
  if (
    data.originalAmount !== undefined ||
    data.originalCurrency !== undefined ||
    data.exchangeRate !== undefined
  ) {
    const amount = data.originalAmount ?? Number(transaction.originalAmount);
    const currency = data.originalCurrency ?? transaction.originalCurrency;
    const rate = data.exchangeRate === undefined ? Number(transaction.exchangeRate) : data.exchangeRate;

    try {
      convertedAmount = calcConvertedAmount(amount, currency, company.baseCurrency, rate ?? null);
    } catch (error) {
      const exception = error as Error & { status?: number };
      return NextResponse.json({ error: exception.message }, { status: exception.status ?? 422 });
    }
  }

  let retroactive = false;
  try {
    const guard = await guardPeriod(
      session.companyId,
      data.competenceDate ? parseDateOnly(data.competenceDate) : transaction.competenceDate,
      session.role,
      data.justification
    );
    retroactive = guard.retroactive;
  } catch (error) {
    const exception = error as Error & { status?: number };
    return NextResponse.json({ error: exception.message }, { status: exception.status ?? 403 });
  }

  const updateData: Prisma.TransactionUncheckedUpdateInput = {};
  if (hasKey(data, 'description')) updateData.description = data.description;
  if (hasKey(data, 'notes')) updateData.notes = data.notes ?? null;
  if (hasKey(data, 'originalAmount')) updateData.originalAmount = data.originalAmount;
  if (hasKey(data, 'originalCurrency')) updateData.originalCurrency = data.originalCurrency;
  if (convertedAmount !== undefined) updateData.convertedAmount = convertedAmount;
  if (hasKey(data, 'exchangeRate')) updateData.exchangeRate = data.exchangeRate ?? 1;
  if (hasKey(data, 'exchangeRateDate')) {
    updateData.exchangeRateDate = data.exchangeRateDate ? parseDateOnly(data.exchangeRateDate) : null;
  }
  if (hasKey(data, 'competenceDate') && data.competenceDate) {
    updateData.competenceDate = parseDateOnly(data.competenceDate);
  }
  if (hasKey(data, 'dueDate') && data.dueDate) updateData.dueDate = parseDateOnly(data.dueDate);
  if (hasKey(data, 'paymentDate')) {
    updateData.paymentDate = data.paymentDate ? parseDateOnly(data.paymentDate) : null;
  }
  if (hasKey(data, 'status')) updateData.status = data.status as TransactionStatus;
  if (hasKey(data, 'categoryId')) updateData.categoryId = data.categoryId ?? null;
  if (hasKey(data, 'costCenterId')) updateData.costCenterId = data.costCenterId ?? null;
  if (hasKey(data, 'bankAccountId')) updateData.bankAccountId = data.bankAccountId ?? null;
  if (hasKey(data, 'destBankAccountId')) updateData.destBankAccountId = data.destBankAccountId ?? null;
  if (hasKey(data, 'contactId')) updateData.contactId = data.contactId ?? null;
  if (hasKey(data, 'installmentCount')) updateData.installmentCount = data.installmentCount ?? null;
  if (hasKey(data, 'sourceDocumentNumber')) {
    updateData.sourceDocumentNumber = data.sourceDocumentNumber ?? null;
  }
  if (hasKey(data, 'externalReference')) updateData.externalReference = data.externalReference ?? null;

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data: updateData
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'update',
    entityType: 'transaction',
    entityId: params.id,
    beforeData: {
      description: transaction.description,
      status: transaction.status,
      originalAmount: String(transaction.originalAmount)
    },
    afterData: {
      description: updated.description,
      status: updated.status,
      originalAmount: String(updated.originalAmount)
    },
    justification: data.justification ?? null,
    retroactive,
    request
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const transaction = await prisma.transaction.findFirst({
    where: { id: params.id, companyId: session.companyId, deletedAt: null }
  });
  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (transaction.reconciliationStatus === ReconciliationStatus.reconciled) {
    return NextResponse.json({ error: 'Lancamento conciliado. Desconcilie antes de excluir.' }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body.justification || body.justification.length < 5) {
    return NextResponse.json({ error: 'Justificativa obrigatoria (minimo 5 caracteres)' }, { status: 422 });
  }

  await prisma.transaction.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), status: TransactionStatus.cancelled }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'delete',
    entityType: 'transaction',
    entityId: params.id,
    beforeData: {
      description: transaction.description,
      status: transaction.status
    },
    justification: body.justification,
    request
  });

  return NextResponse.json({ deleted: true });
}
