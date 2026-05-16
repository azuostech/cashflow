import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export interface SessionContext {
  userId: string;
  companyId: string | null;
  homeCompanyId: string | null;
  email: string;
  fullName: string | null;
  role: UserRole;
  accessibleCompanyIds: string[];
  canAccessMultipleCompanies: boolean;
}

export interface AccessibleCompany {
  id: string;
  name: string;
  cnpj: string;
}

export type UserRole = 'admin' | 'consultor' | 'cliente';

export const ACTIVE_COMPANY_COOKIE = 'cf_active_company';

function normalizeRole(value: string | null | undefined): UserRole {
  if (value === 'admin' || value === 'consultor' || value === 'cliente') return value;
  return 'cliente';
}

function normalizeCompanyIds(ids: (string | null | undefined)[]): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

async function getAccessibleCompanyIds(params: {
  userId: string;
  role: UserRole;
  homeCompanyId: string | null;
}): Promise<string[]> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return normalizeCompanyIds([params.homeCompanyId]);
  }
  const { userId, role, homeCompanyId } = params;

  if (role === 'admin') {
    const { data: companies } = await admin.from('companies').select('id').order('name', { ascending: true });
    return normalizeCompanyIds((companies ?? []).map((company) => company.id));
  }

  if (role === 'consultor') {
    const { data: links } = await admin.from('user_company_access').select('company_id').eq('user_id', userId);
    return normalizeCompanyIds([homeCompanyId, ...(links ?? []).map((link) => link.company_id)]);
  }

  return normalizeCompanyIds([homeCompanyId]);
}

function resolveActiveCompanyId(params: {
  role: UserRole;
  homeCompanyId: string | null;
  accessibleCompanyIds: string[];
  cookieCompanyId: string | null;
}): string | null {
  const { role, homeCompanyId, accessibleCompanyIds, cookieCompanyId } = params;

  if (role === 'cliente') {
    return homeCompanyId;
  }

  if (cookieCompanyId && accessibleCompanyIds.includes(cookieCompanyId)) {
    return cookieCompanyId;
  }

  if (homeCompanyId && accessibleCompanyIds.includes(homeCompanyId)) {
    return homeCompanyId;
  }

  return accessibleCompanyIds[0] ?? null;
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    const { data: fallbackProfile } = await supabase
      .from('users')
      .select('company_id, email, full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!fallbackProfile) return null;

    const role = normalizeRole(fallbackProfile.role);
    const accessibleCompanyIds = normalizeCompanyIds([fallbackProfile.company_id]);

    return {
      userId: user.id,
      companyId: fallbackProfile.company_id,
      homeCompanyId: fallbackProfile.company_id,
      email: fallbackProfile.email,
      fullName: fallbackProfile.full_name,
      role,
      accessibleCompanyIds,
      canAccessMultipleCompanies: false
    };
  }

  const { data: profile, error } = await admin
    .from('users')
    .select('company_id, email, full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) return null;

  const role = normalizeRole(profile.role);
  const accessibleCompanyIds = await getAccessibleCompanyIds({
    userId: user.id,
    role,
    homeCompanyId: profile.company_id
  });
  const cookieCompanyId = cookies().get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
  const activeCompanyId = resolveActiveCompanyId({
    role,
    homeCompanyId: profile.company_id,
    accessibleCompanyIds,
    cookieCompanyId
  });

  return {
    userId: user.id,
    companyId: activeCompanyId,
    homeCompanyId: profile.company_id,
    email: profile.email,
    fullName: profile.full_name,
    role,
    accessibleCompanyIds,
    canAccessMultipleCompanies: role !== 'cliente'
  };
}

export async function getAccessibleCompanies(session: SessionContext): Promise<AccessibleCompany[]> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  if (session.role === 'admin') {
    const { data } = await admin.from('companies').select('id, name, cnpj').order('name', { ascending: true });
    return data ?? [];
  }

  if (!session.accessibleCompanyIds.length) return [];

  const { data } = await admin
    .from('companies')
    .select('id, name, cnpj')
    .in('id', session.accessibleCompanyIds)
    .order('name', { ascending: true });

  return data ?? [];
}
