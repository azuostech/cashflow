import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getHomeRoute } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/lib/utils/audit';

const schema = z.object({ token: z.string().uuid() });

function userNameFromAuth(user: { email?: string | null; user_metadata?: { name?: unknown } }) {
  if (typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim().length > 0) {
    return user.user_metadata.name.trim();
  }

  return user.email?.split('@')[0] ?? 'Usuario';
}

function setSessionCookies(response: NextResponse, companyId: string, homeRoute: string) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  };

  response.cookies.set('cf_active_company', companyId, cookieOptions);
  response.cookies.set('cf_home_route', homeRoute, cookieOptions);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Token invalido' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const invite = await prisma.userCompanyRole.findUnique({
    where: { id: parsed.data.token },
    include: { company: true, user: true }
  });

  if (!invite || invite.acceptedAt) {
    return NextResponse.json({ error: 'Convite nao encontrado ou ja aceito' }, { status: 404 });
  }

  const authEmail = user.email?.trim().toLowerCase() ?? invite.inviteEmail ?? invite.user.email;
  if (invite.inviteEmail && authEmail !== invite.inviteEmail.toLowerCase()) {
    return NextResponse.json({ error: 'Entre com o email que recebeu o convite' }, { status: 403 });
  }

  const existingAuthUser = await prisma.user.findUnique({ where: { id: user.id } });

  if (!existingAuthUser) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: authEmail } });

    if (existingByEmail && existingByEmail.id !== user.id) {
      if (existingByEmail.id !== invite.userId || existingByEmail.active) {
        return NextResponse.json({ error: 'Este email ja esta vinculado a outro usuario' }, { status: 409 });
      }

      await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { email: `placeholder-${existingByEmail.id}@cashflowai.local` }
      });
    }
  }

  await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: authEmail,
      active: true,
      lastLoginAt: new Date()
    },
    create: {
      id: user.id,
      email: authEmail,
      name: userNameFromAuth(user),
      active: true,
      lastLoginAt: new Date()
    }
  });

  const acceptedAt = new Date();

  let acceptedRole;
  try {
    acceptedRole = await prisma.$transaction(async (tx) => {
      const existingForAuthUser = await tx.userCompanyRole.findUnique({
        where: {
          userId_companyId: {
            userId: user.id,
            companyId: invite.companyId
          }
        }
      });

      if (existingForAuthUser && existingForAuthUser.id !== invite.id) {
        if (existingForAuthUser.active) {
          throw new Error('ALREADY_MEMBER');
        }

        const updatedExisting = await tx.userCompanyRole.update({
          where: { id: existingForAuthUser.id },
          data: {
            role: invite.role,
            active: true,
            invitedAt: invite.invitedAt,
            acceptedAt,
            invitedById: invite.invitedById,
            inviteEmail: invite.inviteEmail ?? authEmail
          }
        });

        await tx.userCompanyRole.delete({ where: { id: invite.id } });
        return updatedExisting;
      }

      return tx.userCompanyRole.update({
        where: { id: invite.id },
        data: {
          userId: user.id,
          active: true,
          acceptedAt,
          inviteEmail: invite.inviteEmail ?? authEmail
        }
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ALREADY_MEMBER') {
      return NextResponse.json({ error: 'Usuario ja possui acesso ativo a esta empresa' }, { status: 409 });
    }

    throw error;
  }

  await createAuditLog({
    companyId: invite.companyId,
    userId: user.id,
    action: 'update',
    entityType: 'user_company_role',
    entityId: acceptedRole.id,
    beforeData: {
      email: invite.inviteEmail ?? invite.user.email,
      role: invite.role,
      active: invite.active,
      acceptedAt: invite.acceptedAt
    },
    afterData: {
      email: authEmail,
      role: acceptedRole.role,
      active: acceptedRole.active,
      acceptedAt: acceptedRole.acceptedAt
    },
    request
  });

  const homeRoute = getHomeRoute(acceptedRole.role);
  const response = NextResponse.json({
    companyId: invite.companyId,
    companyName: invite.company.name,
    role: acceptedRole.role,
    redirectTo: homeRoute
  });

  setSessionCookies(response, invite.companyId, homeRoute);
  return response;
}
