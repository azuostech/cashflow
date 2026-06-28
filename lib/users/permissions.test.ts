import { describe, expect, it } from 'vitest';
import { canChangeRole, canInviteUser, canManageUsers, canRemoveUser, isUserRole } from './permissions';

describe('user permissions', () => {
  it('allows only owners and admins to manage users', () => {
    expect(canManageUsers('owner')).toBe(true);
    expect(canManageUsers('admin')).toBe(true);
    expect(canManageUsers('financial')).toBe(false);
    expect(canManageUsers('accountant')).toBe(false);
    expect(canManageUsers('viewer')).toBe(false);
  });

  it('keeps admins away from privileged roles', () => {
    expect(canInviteUser('admin', 'financial')).toBe(true);
    expect(canInviteUser('admin', 'owner')).toBe(false);
    expect(canInviteUser('admin', 'admin')).toBe(false);

    expect(canChangeRole('admin', 'financial', 'viewer')).toBe(true);
    expect(canChangeRole('admin', 'financial', 'admin')).toBe(false);
    expect(canChangeRole('admin', 'owner', 'viewer')).toBe(false);
    expect(canChangeRole('viewer', 'viewer', 'viewer')).toBe(false);
  });

  it('protects the last owner', () => {
    expect(canChangeRole('owner', 'owner', 'admin', { isLastOwner: true })).toBe(false);
    expect(canRemoveUser('owner', 'owner', { isLastOwner: true })).toBe(false);
  });

  it('validates known roles', () => {
    expect(isUserRole('owner')).toBe(true);
    expect(isUserRole('unknown')).toBe(false);
    expect(isUserRole(null)).toBe(false);
  });
});
