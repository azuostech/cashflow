import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { canChangeRole, isUserRole } from '@/lib/users/permissions';

const schema = z.object({
  role: z.enum(['owner', 'admin', 'financial', 'accountant', 'viewer'])
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string; userId: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  if (params.id !== session.companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
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

  if (!isUserRole(session.role) || !canChangeRole(session.role, target.role, parsed.data.role, { isLastOwner })) {
    return NextResponse.json({ error: 'Permissao insuficiente para alterar este papel' }, { status: 403 });
  }

  const before = {
    userId: target.userId,
    email: target.inviteEmail ?? target.user.email,
    role: target.role,
    active: target.active
  };

  const updated = await prisma.userCompanyRole.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
    include: { user: { select: { id: true, name: true, email: true } } }
  });

  await createAuditLog({
    companyId: params.id,
    userId: session.userId,
    action: 'update',
    entityType: 'user_company_role',
    entityId: target.id,
    beforeData: before,
    afterData: {
      userId: updated.userId,
      email: updated.inviteEmail ?? updated.user.email,
      role: updated.role,
      active: updated.active
    },
    request
  });

  return NextResponse.json({
    id: updated.id,
    userId: updated.userId,
    email: updated.inviteEmail ?? updated.user.email,
    name: updated.user.name,
    role: updated.role,
    active: updated.active,
    status: updated.acceptedAt ? (updated.active ? 'active' : 'inactive') : 'pending',
    invitedAt: updated.invitedAt,
    inviteAcceptedAt: updated.acceptedAt,
    acceptedAt: updated.acceptedAt
  });
}
