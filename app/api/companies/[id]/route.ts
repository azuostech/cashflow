import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { updateCompanySchema } from '@/lib/validations/settings.schema';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  if (params.id !== session.companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: { currency: true }
  });

  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(company);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  if (params.id !== session.companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateCompanySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const before = await prisma.company.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.company.update({
    where: { id: params.id },
    data: parsed.data
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'update',
    entityType: 'company',
    entityId: params.id,
    beforeData: before as unknown as Record<string, unknown>,
    afterData: updated as unknown as Record<string, unknown>,
    request
  });

  return NextResponse.json(updated);
}
