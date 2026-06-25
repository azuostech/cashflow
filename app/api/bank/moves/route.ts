import { BankMoveType, Prisma, ReconciliationStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';

const optionalUuid = z.preprocess((value) => (value === '' ? undefined : value), z.string().uuid().optional());

const listSchema = z.object({
  bankAccountId: optionalUuid,
  reconciliationStatus: z.enum(['unreconciled', 'partial', 'reconciled', 'ignored', 'all']).default('unreconciled'),
  type: z.enum(['credit', 'debit', 'all']).default('all'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(50)
});

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const parsed = listSchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const query = parsed.data;
  const where: Prisma.BankMoveWhereInput = {
    companyId: session.companyId,
    ...(query.bankAccountId ? { bankAccountId: query.bankAccountId } : {}),
    ...(query.type !== 'all' ? { type: query.type as BankMoveType } : {}),
    ...(query.reconciliationStatus !== 'all'
      ? { reconciliationStatus: query.reconciliationStatus as ReconciliationStatus }
      : {}),
    ...(query.search
      ? {
          OR: [
            { description: { contains: query.search, mode: 'insensitive' } },
            { merchantName: { contains: query.search, mode: 'insensitive' } },
            { bankRef: { contains: query.search, mode: 'insensitive' } }
          ]
        }
      : {})
  };

  if (query.startDate || query.endDate) {
    where.date = {
      ...(query.startDate ? { gte: parseDateOnly(query.startDate) } : {}),
      ...(query.endDate ? { lte: parseDateOnly(query.endDate) } : {})
    };
  }

  const [moves, total, summary] = await Promise.all([
    prisma.bankMove.findMany({
      where,
      include: {
        bankAccount: { select: { id: true, name: true, currency: true } }
      },
      orderBy: [{ date: 'desc' }, { importedAt: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit
    }),
    prisma.bankMove.count({ where }),
    prisma.bankMove.groupBy({
      by: ['reconciliationStatus'],
      where: {
        companyId: session.companyId,
        ...(query.bankAccountId ? { bankAccountId: query.bankAccountId } : {})
      },
      _count: true
    })
  ]);

  return NextResponse.json({
    data: moves,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
    summary
  });
}
