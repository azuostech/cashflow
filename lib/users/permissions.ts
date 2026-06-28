export const USER_ROLES = ['owner', 'admin', 'financial', 'accountant', 'viewer'] as const;

export type AppUserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<AppUserRole, string> = {
  owner: 'Proprietario',
  admin: 'Administrador',
  financial: 'Financeiro',
  accountant: 'Contador',
  viewer: 'Visualizador'
};

const ADMIN_MANAGED_ROLES: AppUserRole[] = ['financial', 'accountant', 'viewer'];

export function isUserRole(value: unknown): value is AppUserRole {
  return typeof value === 'string' && USER_ROLES.includes(value as AppUserRole);
}

export function canManageUsers(actorRole: AppUserRole): boolean {
  return actorRole === 'owner' || actorRole === 'admin';
}

export function canInviteUser(actorRole: AppUserRole, invitedRole: AppUserRole): boolean {
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') return ADMIN_MANAGED_ROLES.includes(invitedRole);
  return false;
}

export function canChangeRole(
  actorRole: AppUserRole,
  targetRole: AppUserRole,
  newRole: AppUserRole,
  options: { isLastOwner?: boolean } = {}
): boolean {
  if (!canManageUsers(actorRole)) return false;
  if (options.isLastOwner && targetRole === 'owner' && newRole !== 'owner') return false;
  if (targetRole === newRole) return true;
  if (actorRole === 'owner') return true;

  if (actorRole === 'admin') {
    return ADMIN_MANAGED_ROLES.includes(targetRole) && ADMIN_MANAGED_ROLES.includes(newRole);
  }

  return false;
}

export function canRemoveUser(
  actorRole: AppUserRole,
  targetRole: AppUserRole,
  options: { isLastOwner?: boolean } = {}
): boolean {
  if (options.isLastOwner && targetRole === 'owner') return false;
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') return ADMIN_MANAGED_ROLES.includes(targetRole);
  return false;
}
