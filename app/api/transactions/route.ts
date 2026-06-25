import {
  Prisma,
  ReconciliationStatus,
  TransactionStatus,
  TransactionType
} from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import {
  createTransactionSchema,
  RECURRENCE_FREQUENCIES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  type CreateTransactionInput
} from '@/lib/validations/transaction.schema';
import { createAuditLog } from '@/lib/utils/audit';
import {
  calcConvertedAmount,
  createInstallments,
  generateRecurrenceOccurrences,
  guardPeriod
} from '@/lib/transactions/domain';

const SORT_FIELDS = new Set([
  'competenceDate',
  'dueDate',
  'paymentDate',
  'createdAt',
  'updatedAt',
  'description',
  'originalAmount',
  'convertedAmount',
  'status',
  'type'
]);

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function readInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function enumValue<T extends Record<string, string>>(enumObject: T, value: string | null): T[keyof T] | null {
  if (!value) return null;
  return Object.values(enumObject).includes(value) ? (value as T[keyof T]) : null;
}

async function validateCategory(
  companyId: string,
  categoryId: string,
  transactionType: CreateTransactionInput['type']
): Promise<string | null> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, companyId, active: true, deprecatedAt: null }
  });

  if (!category) return 'Categoria invalida ou depreciada';

  const typeMatches =
    (transactionType === 'revenue' && category.type === TransactionType.revenue) ||
    (transactionType !== 'revenue' && category.type !== TransactionType.revenue);

  return typeMatches ? null : 'Tipo da categoria incompativel com o tipo do lancamento';
}

async function validateRelatedEntities(data: CreateTransactionInput, companyId: string): Promise<string | null> {
  if (data.type !== 'transfer') {
    if (!data.categoryId) return 'categoryId obrigatorio';
    if (!data.costCenterId) return 'costCenterId obrigatorio';

    const categoryError = await validateCategory(companyId, data.categoryId, data.type);
    if (categoryError) return categoryError;

    const costCenter = await prisma.costCenter.findFirst({
      where: { id: data.costCenterId, companyId, active: true }
    });
    if (!costCenter) return 'Centro de custo invalido';
  } else {
    if (!data.bankAccountId || !data.destBankAccountId) {
      return 'Contas de origem e destino obrigatorias para transferencia';
    }
    if (data.bankAccountId === data.destBankAccountId) {
      return 'Conta de origem e destino nao podem ser iguais';
    }
  }

  if (data.bankAccountId) {
    const account = await prisma.bankAccount.findFirst({
      where: { id: data.bankAccountId, companyId, active: true }
    });
    if (!account) return 'Conta bancaria invalida';
  }

  if (data.destBankAccountId) {
    const account = await prisma.bankAccount.findFirst({
      where: { id: data.destBankAccountId, companyId, active: true }
    });
    if (!account) return 'Conta bancaria de destino invalida';
  }

  if (data.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: data.contactId, companyId, active: true }
    });
    if (!contact) return 'Contato invalido';
  }

  return null;
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const type = enumValue(TransactionType, searchParams.get('type'));
  const status = enumValue(TransactionStatus, searchParams.get('status'));
  const reconciliation = enumValue(ReconciliationStatus, searchParams.get('reconciliation'));
  const categoryId = searchParams.get('categoryId');
  const costCenterId = searchParams.get('costCenterId');
  const bankAccountId = searchParams.get('bankAccountId');
  const contactId = searchParams.get('contactId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const search = searchParams.get('search');
  const page = readInt(searchParams.get('page'), 1, 1, Number.MAX_SAFE_INTEGER);
  const limit = readInt(searchParams.get('limit'), 50, 1, 100);
  const requestedSortBy = searchParams.get('sortBy') ?? 'competenceDate';
  const sortBy = SORT_FIELDS.has(requestedSortBy) ? requestedSortBy : 'competenceDate';
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';

  if (searchParams.get('type') && !TRANSACTION_TYPES.includes(searchParams.get('type') as any)) {
    return NextResponse.json({ error: 'type invalido' }, { status: 422 });
  }
  if (searchParams.get('status') && !TRANSACTION_STATUSES.includes(searchParams.get('status') as any)) {
    return NextResponse.json({ error: 'status invalido' }, { status: 422 });
  }
  if (searchParams.get('reconciliation') && !reconciliation) {
    return NextResponse.json({ error: 'reconciliation invalido' }, { status: 422 });
  }

  const where: Prisma.TransactionWhereInput = {
    companyId: session.companyId,
    deletedAt: null,
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(costCenterId ? { costCenterId } : {}),
    ...(bankAccountId ? { bankAccountId } : {}),
    ...(contactId ? { contactId } : {}),
    ...(reconciliation ? { reconciliationStatus: reconciliation } : {}),
    ...(search ? { description: { contains: search, mode: 'insensitive' } } : {})
  };

  if (startDate || endDate) {
    where.competenceDate = {
      ...(startDate ? { gte: parseDateOnly(startDate) } : {}),
      ...(endDate ? { lte: parseDateOnly(endDate) } : {})
    };
  }

  const [transactions, total, totals] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, color: true, type: true } },
        costCenter: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true, type: true } },
        bankAccount: { select: { id: true, name: true, currency: true } },
        destBankAccount: { select: { id: true, name: true, currency: true } },
        _count: { select: { installments: true } }
      },
      orderBy: { [sortBy]: sortDir } as Prisma.TransactionOrderByWithRelationInput,
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({
      by: ['type'],
      where: {
        ...where,
        type: { in: [TransactionType.revenue, TransactionType.expense] }
      },
      _sum: { convertedAmount: true }
    })
  ]);

  const revenueTotal = totals.find((item) => item.type === TransactionType.revenue)?._sum.convertedAmount ?? 0;
  const expenseTotal = totals.find((item) => item.type === TransactionType.expense)?._sum.convertedAmount ?? 0;

  return NextResponse.json({
    data: transactions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    summary: {
      revenue: Number(revenueTotal),
      expense: Number(expenseTotal),
      result: Number(revenueTotal) - Number(expenseTotal)
    }
  });
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const body = await request.json();
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const data = parsed.data;

  if (data.isInstallment && !data.installmentCount) {
    return NextResponse.json({ error: 'installmentCount obrigatorio para parcelamento' }, { status: 422 });
  }

  if (data.recurrence && !RECURRENCE_FREQUENCIES.includes(data.recurrence.frequency)) {
    return NextResponse.json({ error: 'Frequencia de recorrencia invalida' }, { status: 422 });
  }

  const relationError = await validateRelatedEntities(data, session.companyId);
  if (relationError) return NextResponse.json({ error: relationError }, { status: 422 });

  if (data.status === 'paid' || data.status === 'received') {
    if (!data.paymentDate) return NextResponse.json({ error: 'Data de pagamento obrigatoria' }, { status: 422 });
    if (!data.bankAccountId) return NextResponse.json({ error: 'Conta bancaria obrigatoria' }, { status: 422 });
    if (parseDateOnly(data.paymentDate) > new Date()) {
      return NextResponse.json({ error: 'Data de pagamento nao pode ser futura' }, { status: 422 });
    }
  }

  const company = await prisma.company.findUnique({ where: { id: session.companyId } });
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

  let convertedAmount: number;
  try {
    convertedAmount = calcConvertedAmount(
      data.originalAmount,
      data.originalCurrency,
      company.baseCurrency,
      data.exchangeRate ?? null
    );
  } catch (error) {
    const exception = error as Error & { status?: number };
    return NextResponse.json({ error: exception.message }, { status: exception.status ?? 422 });
  }

  let retroactive = false;
  try {
    const guard = await guardPeriod(
      session.companyId,
      parseDateOnly(data.competenceDate),
      session.role,
      data.justification
    );
    retroactive = guard.retroactive;
  } catch (error) {
    const exception = error as Error & { status?: number };
    return NextResponse.json({ error: exception.message }, { status: exception.status ?? 403 });
  }

  const transaction = await prisma.$transaction(async (database) => {
    let recurrenceRuleId: string | null = null;

    if (data.recurrence) {
      const rule = await database.recurrenceRule.create({
        data: {
          companyId: session.companyId,
          frequency: data.recurrence.frequency,
          interval: data.recurrence.interval,
          startDate: parseDateOnly(data.recurrence.startDate),
          endDate: data.recurrence.endDate ? parseDateOnly(data.recurrence.endDate) : null,
          occurrencesLimit: data.recurrence.occurrencesLimit ?? null,
          dayOfMonth: data.recurrence.dayOfMonth ?? null,
          active: true
        }
      });
      recurrenceRuleId = rule.id;
    }

    return database.transaction.create({
      data: {
        companyId: session.companyId,
        type: data.type as TransactionType,
        description: data.description,
        notes: data.notes ?? null,
        originalAmount: data.originalAmount,
        originalCurrency: data.originalCurrency,
        convertedAmount,
        companyCurrency: company.baseCurrency,
        exchangeRate: data.exchangeRate ?? 1,
        exchangeRateDate: data.exchangeRateDate ? parseDateOnly(data.exchangeRateDate) : null,
        competenceDate: parseDateOnly(data.competenceDate),
        dueDate: parseDateOnly(data.dueDate),
        paymentDate: data.paymentDate ? parseDateOnly(data.paymentDate) : null,
        status: data.status as TransactionStatus,
        categoryId: data.categoryId ?? null,
        costCenterId: data.costCenterId ?? null,
        bankAccountId: data.bankAccountId ?? null,
        destBankAccountId: data.destBankAccountId ?? null,
        contactId: data.contactId ?? null,
        isInstallment: data.isInstallment,
        installmentCount: data.installmentCount ?? null,
        recurrenceRuleId,
        origin: 'manual',
        reconciliationStatus: ReconciliationStatus.unreconciled,
        isReversal: false,
        hasCostCenterSplit: false,
        requiresApproval: false,
        approvalStatus: 'not_required',
        aiSuggested: false,
        createdById: session.userId,
        sourceDocumentNumber: data.sourceDocumentNumber ?? null,
        externalReference: data.externalReference ?? null
      }
    });
  });

  if (data.isInstallment && data.installmentCount && data.installmentCount >= 2) {
    await createInstallments(
      transaction.id,
      session.companyId,
      data.originalAmount,
      data.originalCurrency,
      convertedAmount,
      company.baseCurrency,
      data.exchangeRate ?? 1,
      parseDateOnly(data.competenceDate),
      parseDateOnly(data.dueDate),
      data.installmentCount,
      data.categoryId ?? null,
      data.costCenterId ?? null
    );
  }

  if (data.recurrence && transaction.recurrenceRuleId) {
    await generateRecurrenceOccurrences(
      transaction.recurrenceRuleId,
      transaction.id,
      transaction as unknown as Record<string, unknown>,
      {
        frequency: data.recurrence.frequency,
        interval: data.recurrence.interval,
        startDate: parseDateOnly(data.recurrence.startDate),
        endDate: data.recurrence.endDate ? parseDateOnly(data.recurrence.endDate) : null,
        occurrencesLimit: data.recurrence.occurrencesLimit ?? null,
        dayOfMonth: data.recurrence.dayOfMonth ?? null
      },
      session.userId
    );
  }

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'create',
    entityType: 'transaction',
    entityId: transaction.id,
    afterData: {
      description: transaction.description,
      type: transaction.type,
      originalAmount: String(transaction.originalAmount)
    },
    retroactive,
    request
  });

  return NextResponse.json(transaction, { status: 201 });
}
