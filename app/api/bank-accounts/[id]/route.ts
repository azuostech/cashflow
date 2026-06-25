import { BankAccountType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { updateBankAccountSchema } from '@/lib/validations/settings.schema';

function getAccount(id: string, companyId: string) {
  return prisma.bankAccount.findFirst({
    where: { id, companyId },
    include: { bankProvider: { select: { id: true, name: true, supportedFormats: true } } }
  });
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const account = await getAccount(params.id, session.companyId);
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(account);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const account = await getAccount(params.id, session.companyId);
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const parsed = updateBankAccountSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  const updated = await prisma.bankAccount.update({
    where: { id: params.id },
    data: {
      ...data,
      type: data.type ? (data.type as BankAccountType) : undefined,
      initialBalanceDate: data.initialBalanceDate ? new Date(data.initialBalanceDate) : undefined
    }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'update',
    entityType: 'bank_account',
    entityId: params.id,
    beforeData: account as unknown as Record<string, unknown>,
    afterData: updated as unknown as Record<string, unknown>,
    request
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  if (!['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const account = await getAccount(params.id, session.companyId);
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const linkedMoves = await prisma.bankMove.count({ where: { bankAccountId: params.id } });
  const linkedTransactions = await prisma.transaction.count({
    where: {
      deletedAt: null,
      OR: [{ bankAccountId: params.id }, { destBankAccountId: params.id }]
    }
  });

  const updated = await prisma.bankAccount.update({
    where: { id: params.id },
    data: { active: false }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'delete',
    entityType: 'bank_account',
    entityId: params.id,
    beforeData: account as unknown as Record<string, unknown>,
    afterData: updated as unknown as Record<string, unknown>,
    request
  });

  return NextResponse.json({
    deactivated: true,
    reason: linkedMoves > 0 || linkedTransactions > 0 ? 'has_linked_data' : 'soft_delete'
  });
}
