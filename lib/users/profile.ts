import { z } from 'zod';

export const PROFILE_TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Maceio',
  'America/Bahia',
  'America/Cuiaba',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Rio_Branco',
  'America/Noronha',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/Lisbon',
  'UTC'
] as const;

export const DEFAULT_NOTIFICATION_PREFS = {
  overduePayables: true,
  overdueReceivables: true,
  periodsReminder: true,
  reconciliationReminder: true
};

export type NotificationPrefs = typeof DEFAULT_NOTIFICATION_PREFS;

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  locale: z.enum(['pt-BR', 'en-US']).optional(),
  timezone: z.string().max(50).refine((value) => PROFILE_TIMEZONES.includes(value as (typeof PROFILE_TIMEZONES)[number]), 'Fuso invalido').optional(),
  notificationPrefs: z
    .object({
      overduePayables: z.boolean().optional(),
      overdueReceivables: z.boolean().optional(),
      periodsReminder: z.boolean().optional(),
      reconciliationReminder: z.boolean().optional()
    })
    .optional()
});

export const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Minimo 8 caracteres')
      .regex(/[A-Z]/, 'Deve conter ao menos uma letra maiuscula')
      .regex(/[0-9]/, 'Deve conter ao menos um numero'),
    confirmPassword: z.string()
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Senhas nao coincidem',
    path: ['confirmPassword']
  });

export function validatePasswordRules(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Minimo 8 caracteres');
  if (!/[A-Z]/.test(password)) errors.push('Deve conter ao menos uma letra maiuscula');
  if (!/[0-9]/.test(password)) errors.push('Deve conter ao menos um numero');
  return errors;
}

export function normalizeNotificationPrefs(value: unknown): NotificationPrefs {
  if (!value || typeof value !== 'object') return DEFAULT_NOTIFICATION_PREFS;
  const prefs = value as Partial<NotificationPrefs>;

  return {
    overduePayables: prefs.overduePayables ?? DEFAULT_NOTIFICATION_PREFS.overduePayables,
    overdueReceivables: prefs.overdueReceivables ?? DEFAULT_NOTIFICATION_PREFS.overdueReceivables,
    periodsReminder: prefs.periodsReminder ?? DEFAULT_NOTIFICATION_PREFS.periodsReminder,
    reconciliationReminder: prefs.reconciliationReminder ?? DEFAULT_NOTIFICATION_PREFS.reconciliationReminder
  };
}

export function sidebarBadgeColor(count: number, type: 'payable' | 'receivable' | 'recon'): string {
  if (count === 0) return 'hidden';
  if (type === 'payable') return 'bg-red-500';
  if (type === 'receivable') return 'bg-amber-400';
  return 'bg-blue-500';
}
