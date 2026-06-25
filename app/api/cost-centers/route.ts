import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { createCostCenterSchema } from '@/lib/validations/settings.schema';

const bulkCreateSchema = createCostCenterSchema.array().min(1);

export async function POST(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const body = await request.json();

  if (body.items) {
    const parsed = bulkCreateSchema.safeParse(body.items);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const created = await prisma.$transaction(
      parsed.data.map((item) =>
        prisma.costCenter.create({
          data: {
            companyId: session.companyId,
            name: item.name,
            code: item.code ?? null,
            parentId: item.parentId ?? null,
            active: true
          }
        })
      )
    );

    return NextResponse.json(created, { status: 201 });
  }

  const parsed = createCostCenterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const costCenter = await prisma.costCenter.create({
    data: {
      companyId: session.companyId,
      name: parsed.data.name,
      code: parsed.data.code ?? null,
      parentId: parsed.data.parentId ?? null,
      active: true
    }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'create',
    entityType: 'cost_center',
    entityId: costCenter.id,
    afterData: { name: costCenter.name },
    request
  });

  return NextResponse.json(costCenter, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const activeParam = searchParams.get('active');

  const costCenters = await prisma.costCenter.findMany({
    where: {
      companyId: session.companyId,
      ...(activeParam === 'all' ? {} : { active: true })
    },
    orderBy: [{ parentId: 'asc' }, { name: 'asc' }]
  });

  const txCounts = await prisma.transaction.groupBy({
    by: ['costCenterId'],
    where: {
      companyId: session.companyId,
      deletedAt: null,
      costCenterId: { in: costCenters.map((costCenter) => costCenter.id) }
    },
    _count: true
  });

  const countMap = Object.fromEntries(txCounts.map((item) => [item.costCenterId, item._count]));

  return NextResponse.json(
    costCenters.map((costCenter) => ({
      ...costCenter,
      transactionCount: countMap[costCenter.id] ?? 0
    }))
  );
}
