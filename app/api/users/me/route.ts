import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/lib/utils/audit';
import { DEFAULT_NOTIFICATION_PREFS, normalizeNotificationPrefs, updateProfileSchema } from '@/lib/users/profile';

export async function GET() {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const supabase = createClient();
  const {
    data: { user: authUser }
  } = await supabase.auth.getUser();

  const fallbackName =
    typeof authUser?.user_metadata?.name === 'string' && authUser.user_metadata.name.trim().length > 0
      ? authUser.user_metadata.name.trim()
      : session.email.split('@')[0] ?? 'Usuario';

  const user = await prisma.user.upsert({
    where: { id: session.userId },
    update: {
      email: session.email,
      active: true,
      lastLoginAt: new Date()
    },
    create: {
      id: session.userId,
      email: session.email,
      name: fallbackName,
      notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
      active: true,
      lastLoginAt: new Date()
    }
  });

  const roles = await prisma.userCompanyRole.findMany({
    where: { userId: session.userId, active: true, acceptedAt: { not: null } },
    include: { company: true },
    orderBy: [{ acceptedAt: 'asc' }, { createdAt: 'asc' }]
  });

  const notificationPrefs = normalizeNotificationPrefs(user.notificationPrefs);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
    timezone: user.timezone,
    notificationPrefs,
    role: session.role,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      locale: user.locale,
      timezone: user.timezone,
      notificationPrefs,
      active: user.active,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    },
    activeCompanyId: session.companyId,
    activeRole: session.role,
    companies: roles.map((role) => ({
      id: role.company.id,
      name: role.company.name,
      legalName: role.company.legalName,
      document: role.company.document,
      role: role.role,
      currency: role.company.baseCurrency,
      active: role.company.active,
      acceptedAt: role.acceptedAt,
      isActive: role.companyId === session.companyId
    }))
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const body = await request.json();
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const before = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!before) return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 });

  const data: Prisma.UserUpdateInput = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.locale !== undefined) data.locale = parsed.data.locale;
  if (parsed.data.timezone !== undefined) data.timezone = parsed.data.timezone;
  if (parsed.data.notificationPrefs !== undefined) {
    data.notificationPrefs = normalizeNotificationPrefs(parsed.data.notificationPrefs);
  }

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      locale: true,
      timezone: true,
      notificationPrefs: true,
      updatedAt: true
    }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'update',
    entityType: 'user',
    entityId: session.userId,
    beforeData: {
      name: before.name,
      locale: before.locale,
      timezone: before.timezone,
      notificationPrefs: normalizeNotificationPrefs(before.notificationPrefs)
    },
    afterData: {
      name: updated.name,
      locale: updated.locale,
      timezone: updated.timezone,
      notificationPrefs: normalizeNotificationPrefs(updated.notificationPrefs)
    },
    request
  });

  return NextResponse.json({
    ...updated,
    notificationPrefs: normalizeNotificationPrefs(updated.notificationPrefs)
  });
}
