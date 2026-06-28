import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createAuditLog } from '@/lib/utils/audit';
import { canInviteUser, isUserRole } from '@/lib/users/permissions';

const schema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'financial', 'accountant', 'viewer'])
});

function displayNameFromEmail(email: string) {
  return email.split('@')[0] || 'Usuario convidado';
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

  const invitedRole = parsed.data.role;
  if (!isUserRole(session.role) || !canInviteUser(session.role, invitedRole)) {
    return NextResponse.json({ error: 'Permissao insuficiente para este papel' }, { status: 403 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const company = await prisma.company.findUnique({ where: { id: params.id } });
  if (!company) return NextResponse.json({ error: 'Empresa nao encontrada' }, { status: 404 });

  const now = new Date();
  const invitedUser =
    (await prisma.user.findUnique({ where: { email } })) ??
    (await prisma.user.create({
      data: {
        id: randomUUID(),
        email,
        name: displayNameFromEmail(email),
        active: false
      }
    }));

  const existingRole = await prisma.userCompanyRole.findUnique({
    where: {
      userId_companyId: {
        userId: invitedUser.id,
        companyId: params.id
      }
    }
  });

  if (existingRole?.active) {
    return NextResponse.json({ error: 'Usuario ja possui acesso ativo a esta empresa' }, { status: 409 });
  }

  const invite = existingRole
    ? await prisma.userCompanyRole.update({
        where: { id: existingRole.id },
        data: {
          role: invitedRole,
          active: false,
          invitedAt: now,
          acceptedAt: null,
          invitedById: session.userId,
          inviteEmail: email
        }
      })
    : await prisma.userCompanyRole.create({
        data: {
          userId: invitedUser.id,
          companyId: params.id,
          role: invitedRole,
          active: false,
          invitedAt: now,
          acceptedAt: null,
          invitedById: session.userId,
          inviteEmail: email
        }
      });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const inviteUrl = `${appUrl}/invite/${invite.id}`;
  const redirectTo = `${appUrl}/auth/callback?next=/invite/${invite.id}`;
  const supabaseAdmin = createSupabaseAdminClient();
  let deliveryStatus: 'sent' | 'not_configured' | 'email_failed' = 'not_configured';
  let deliveryError: string | null = null;

  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error) {
      deliveryStatus = 'email_failed';
      deliveryError = error.message;
    } else {
      deliveryStatus = 'sent';
    }
  }

  await createAuditLog({
    companyId: params.id,
    userId: session.userId,
    action: 'create',
    entityType: 'user_company_role',
    entityId: invite.id,
    afterData: {
      email,
      role: invite.role,
      invitedAt: invite.invitedAt,
      deliveryStatus
    },
    request
  });

  return NextResponse.json(
    {
      id: invite.id,
      companyId: params.id,
      companyName: company.name,
      email,
      role: invite.role,
      invitedAt: invite.invitedAt,
      inviteUrl,
      deliveryStatus,
      deliveryError
    },
    { status: 201 }
  );
}
