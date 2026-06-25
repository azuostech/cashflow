import { CashflowGroup, TransactionType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { createCategorySchema } from '@/lib/validations/settings.schema';

const bulkCreateSchema = createCategorySchema.array().min(1);

export async function POST(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const body = await request.json();

  const payload = Array.isArray(body) ? body : body.items ? body.items : null;

  if (payload) {
    const parsed = bulkCreateSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const dreNodeIds = Array.from(new Set(parsed.data.map((item) => item.dreNodeId)));
    const validNodes = await prisma.dRENode.findMany({
      where: {
        id: { in: dreNodeIds },
        OR: [{ isGlobal: true }, { companyId: session.companyId }]
      }
    });

    if (validNodes.length !== dreNodeIds.length) {
      return NextResponse.json({ error: 'DRENode invalido' }, { status: 422 });
    }

    const created = await prisma.$transaction(
      parsed.data.map((item) =>
        prisma.category.create({
          data: {
            companyId: session.companyId,
            name: item.name,
            type: item.type as TransactionType,
            dreNodeId: item.dreNodeId,
            cashflowGroup: item.cashflowGroup as CashflowGroup,
            parentId: item.parentId ?? null,
            color: item.color ?? null,
            icon: item.icon ?? null,
            active: true
          }
        })
      )
    );

    await Promise.all(
      created.map((category) =>
        createAuditLog({
          companyId: session.companyId,
          userId: session.userId,
          action: 'create',
          entityType: 'category',
          entityId: category.id,
          afterData: category as unknown as Record<string, unknown>,
          request
        })
      )
    );

    return NextResponse.json(created, { status: 201 });
  }

  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const category = await prisma.category.create({
    data: {
      companyId: session.companyId,
      name: parsed.data.name,
      type: parsed.data.type as TransactionType,
      dreNodeId: parsed.data.dreNodeId,
      cashflowGroup: parsed.data.cashflowGroup as CashflowGroup,
      parentId: parsed.data.parentId ?? null,
      color: parsed.data.color ?? null,
      icon: parsed.data.icon ?? null,
      active: true
    }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'create',
    entityType: 'category',
    entityId: category.id,
    afterData: category as unknown as Record<string, unknown>,
    request
  });

  return NextResponse.json(category, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const includeDeprecated = searchParams.get('includeDeprecated') === 'true';

  const categories = await prisma.category.findMany({
    where: {
      companyId: session.companyId,
      active: true,
      ...(includeDeprecated ? {} : { deprecatedAt: null }),
      ...(type ? { type: type as TransactionType } : {})
    },
    include: { dreNode: { select: { id: true, name: true, code: true, sign: true, type: true } } },
    orderBy: [{ type: 'asc' }, { name: 'asc' }]
  });

  return NextResponse.json(categories);
}
