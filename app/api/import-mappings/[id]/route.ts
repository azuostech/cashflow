import { FileFormat, ImportAmountConvention } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';

const updateMappingSchema = z.object({
  bankProviderId: z.string().uuid().optional().nullable(),
  name: z.string().min(2).max(100).optional(),
  fileFormat: z.nativeEnum(FileFormat).optional(),
  dateColumn: z.string().min(1).max(50).optional(),
  descriptionColumn: z.string().min(1).max(50).optional(),
  amountColumn: z.string().max(50).optional().nullable(),
  debitColumn: z.string().max(50).optional().nullable(),
  creditColumn: z.string().max(50).optional().nullable(),
  referenceColumn: z.string().max(50).optional().nullable(),
  dateFormat: z.string().optional(),
  decimalSeparator: z.string().length(1).optional(),
  thousandSeparator: z.string().length(1).optional().nullable(),
  headerRow: z.coerce.number().int().min(1).optional(),
  skipRowsStart: z.coerce.number().int().min(0).optional(),
  skipRowsEnd: z.coerce.number().int().min(0).optional(),
  amountSignConvention: z.nativeEnum(ImportAmountConvention).optional(),
  defaultCurrency: z.string().length(3).optional(),
  active: z.boolean().optional()
});

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const mapping = await prisma.importMapping.findFirst({
    where: {
      id: params.id,
      OR: [{ companyId: session.companyId }, { isGlobal: true }]
    },
    include: { bankProvider: { select: { id: true, name: true } } }
  });

  if (!mapping) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(mapping);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const current = await prisma.importMapping.findFirst({
    where: { id: params.id, companyId: session.companyId, isGlobal: false }
  });

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const parsed = updateMappingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const mapping = await prisma.importMapping.update({
    where: { id: params.id },
    data: parsed.data
  });

  return NextResponse.json(mapping);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const current = await prisma.importMapping.findFirst({
    where: { id: params.id, companyId: session.companyId, isGlobal: false }
  });

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.importMapping.update({
    where: { id: params.id },
    data: { active: false }
  });

  return NextResponse.json({ deleted: true });
}
