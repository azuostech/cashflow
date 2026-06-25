import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { updateCategorySchema } from '@/lib/validations/settings.schema';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const category = await prisma.category.findFirst({
    where: { id: params.id, companyId: session.companyId },
    include: { dreNode: true, children: { where: { active: true } } }
  });

  if (!category) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(category);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const category = await prisma.category.findFirst({
    where: { id: params.id, companyId: session.companyId }
  });

  if (!category) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (category.deprecatedAt) {
    return NextResponse.json({ error: 'Categoria depreciada nao pode ser editada' }, { status: 409 });
  }

  const body = await request.json();
  const parsed = updateCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const updated = await prisma.category.update({
    where: { id: params.id },
    data: parsed.data
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'update',
    entityType: 'category',
    entityId: params.id,
    beforeData: category as unknown as Record<string, unknown>,
    afterData: updated as unknown as Record<string, unknown>,
    request
  });

  return NextResponse.json(updated);
}
