import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { canRemoveUser, isUserRole } from '@/lib/users/permissions';

export async function DELETE(request: NextRequest, { params }: { params: { id: string; userId: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  if (params.id !== session.companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (params.userId === session.userId) {
    return NextResponse.json({ error: 'Voce nao pode remover seu proprio acesso' }, { status: 400 });
  }

  const target = await prisma.userCompanyRole.findFirst({
    where: {
      companyId: params.id,
      userId: params.userId,
      OR: [{ active: true }, { acceptedAt: null }]
    },
    include: { user: { select: { id: true, name: true, email: true } } }
  });

  if (!target) {
    return NextResponse.json({ error: 'Usuario nao encontrado na empresa' }, { status: 404 });
  }

  const activeOwnerCount = await prisma.userCompanyRole.count({
    where: {
      companyId: params.id,
      role: 'owner',
      active: true,
      acceptedAt: { not: null }
    }
  });
  const isLastOwner = target.role === 'owner' && target.active && Boolean(target.acceptedAt) && activeOwnerCount <= 1;

  if (!isUserRole(session.role) || !canRemoveUser(session.role, target.role, { isLastOwner })) {
    return NextResponse.json({ error: 'Permissao insuficiente para remover este usuario' }, { status: 403 });
  }

  const before = {
    userId: target.userId,
    email: target.inviteEmail ?? target.user.email,
    role: target.role,
    active: target.active,
    acceptedAt: target.acceptedAt
  };

  if (target.acceptedAt) {
    await prisma.userCompanyRole.update({
      where: { id: target.id },
      data: { active: false }
    });
  } else {
    await prisma.userCompanyRole.delete({ where: { id: target.id } });
  }

  await createAuditLog({
    companyId: params.id,
    userId: session.userId,
    action: 'revoke',
    entityType: 'user_company_role',
    entityId: target.id,
    beforeData: before,
    afterData: {
      ...before,
      active: false,
      revoked: true
    },
    request
  });

  return NextResponse.json({ ok: true });
}
