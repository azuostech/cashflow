import { FileFormat, ImportAmountConvention } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';

const createMappingSchema = z.object({
  bankProviderId: z.string().uuid().optional().nullable(),
  name: z.string().min(2).max(100),
  fileFormat: z.nativeEnum(FileFormat),
  dateColumn: z.string().min(1).max(50),
  descriptionColumn: z.string().min(1).max(50),
  amountColumn: z.string().max(50).optional().nullable(),
  debitColumn: z.string().max(50).optional().nullable(),
  creditColumn: z.string().max(50).optional().nullable(),
  referenceColumn: z.string().max(50).optional().nullable(),
  dateFormat: z.string().default('dd/MM/yyyy'),
  decimalSeparator: z.string().length(1).default('.'),
  thousandSeparator: z.string().length(1).optional().nullable(),
  headerRow: z.coerce.number().int().min(1).default(1),
  skipRowsStart: z.coerce.number().int().min(0).default(0),
  skipRowsEnd: z.coerce.number().int().min(0).default(0),
  amountSignConvention: z.nativeEnum(ImportAmountConvention),
  defaultCurrency: z.string().length(3).default('BRL')
});

export async function GET() {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const mappings = await prisma.importMapping.findMany({
    where: {
      active: true,
      OR: [{ companyId: session.companyId }, { isGlobal: true }]
    },
    include: { bankProvider: { select: { id: true, name: true } } },
    orderBy: [{ isGlobal: 'asc' }, { name: 'asc' }]
  });

  return NextResponse.json(mappings);
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const body = await request.json();
  const parsed = createMappingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const mapping = await prisma.importMapping.create({
    data: {
      ...parsed.data,
      companyId: session.companyId,
      isGlobal: false,
      active: true,
      createdById: session.userId
    }
  });

  return NextResponse.json(mapping, { status: 201 });
}
