import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { canManageUsers } from '@/lib/users/permissions';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  if (params.id !== session.companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: 'Permissao insuficiente' }, { status: 403 });
  }

  const roles = await prisma.userCompanyRole.findMany({
    where: {
      companyId: params.id,
      OR: [{ active: true }, { acceptedAt: null }]
    },
    include: {
      user: { select: { id: true, name: true, email: true, active: true, lastLoginAt: true, createdAt: true } },
      invitedBy: { select: { id: true, name: true, email: true } }
    },
    orderBy: [{ acceptedAt: 'asc' }, { invitedAt: 'desc' }, { createdAt: 'desc' }]
  });

  return NextResponse.json(
    roles.map((role) => ({
      id: role.id,
      userId: role.userId,
      email: role.inviteEmail ?? role.user.email,
      name: role.user.name,
      role: role.role,
      active: role.active,
      status: role.acceptedAt ? (role.active ? 'active' : 'inactive') : 'pending',
      invitedAt: role.invitedAt,
      inviteAcceptedAt: role.acceptedAt,
      acceptedAt: role.acceptedAt,
      lastLoginAt: role.user.lastLoginAt,
      createdAt: role.createdAt,
      invitedBy: role.invitedBy
        ? {
            id: role.invitedBy.id,
            name: role.invitedBy.name,
            email: role.invitedBy.email
          }
        : null
    }))
  );
}
