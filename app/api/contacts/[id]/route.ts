import { ContactType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { updateContactSchema } from '@/lib/validations/settings.schema';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const contact = await prisma.contact.findFirst({
    where: { id: params.id, companyId: session.companyId }
  });

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const parsed = updateContactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  const updated = await prisma.contact.update({
    where: { id: params.id },
    data: {
      ...data,
      type: data.type ? (data.type as ContactType) : undefined,
      email: data.email || null,
      document: data.document !== undefined ? (data.document ? data.document.replace(/\D/g, '') || null : null) : undefined
    }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'update',
    entityType: 'contact',
    entityId: params.id,
    beforeData: contact as unknown as Record<string, unknown>,
    afterData: updated as unknown as Record<string, unknown>,
    request
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const contact = await prisma.contact.findFirst({
    where: { id: params.id, companyId: session.companyId }
  });

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const linkedTransactions = await prisma.transaction.count({
    where: { contactId: params.id, deletedAt: null }
  });

  const updated = await prisma.contact.update({
    where: { id: params.id },
    data: { active: false }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'delete',
    entityType: 'contact',
    entityId: params.id,
    beforeData: contact as unknown as Record<string, unknown>,
    afterData: updated as unknown as Record<string, unknown>,
    request
  });

  return NextResponse.json({
    deactivated: true,
    reason: linkedTransactions > 0 ? 'has_linked_transactions' : 'soft_delete'
  });
}
