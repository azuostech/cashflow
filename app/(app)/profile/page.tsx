'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Bell, Building2, CheckCircle2, KeyRound, Shield, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/form-field';
import { useFetch } from '@/hooks/use-fetch';
import { DEFAULT_NOTIFICATION_PREFS, NotificationPrefs, PROFILE_TIMEZONES, normalizeNotificationPrefs } from '@/lib/users/profile';
import { AppUserRole, ROLE_LABELS } from '@/lib/users/permissions';
import { cn } from '@/lib/utils/cn';

interface ProfileResponse {
  id: string;
  email: string;
  name: string;
  locale: 'pt-BR' | 'en-US';
  timezone: string;
  notificationPrefs: NotificationPrefs;
  activeRole: AppUserRole;
  companies: Array<{
    id: string;
    name: string;
    role: AppUserRole;
    currency: string;
    isActive: boolean;
  }>;
}

const ROLE_STYLES: Record<AppUserRole, string> = {
  owner: 'bg-emerald-50 text-emerald-700',
  admin: 'bg-blue-50 text-blue-700',
  financial: 'bg-amber-50 text-amber-700',
  accountant: 'bg-purple-50 text-purple-700',
  viewer: 'bg-gray-100 text-gray-600'
};

function readApiError(payload: unknown, fallback: string) {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return fallback;

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const fieldErrors = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat()[0] : null;
    if (firstFieldError) return firstFieldError;
  }

  return fallback;
}

export default function ProfilePage() {
  const { data: me, loading, error, refetch } = useFetch<ProfileResponse>('/api/users/me');
  const [initialized, setInitialized] = useState(false);
  const [name, setName] = useState('');
  const [locale, setLocale] = useState<'pt-BR' | 'en-US'>('pt-BR');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (!me || initialized) return;
    setName(me.name ?? '');
    setLocale(me.locale ?? 'pt-BR');
    setTimezone(me.timezone ?? 'America/Sao_Paulo');
    setNotificationPrefs(normalizeNotificationPrefs(me.notificationPrefs));
    setInitialized(true);
  }, [initialized, me]);

  function setNotificationPref(key: keyof NotificationPrefs, value: boolean) {
    setNotificationPrefs((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage('');
    setSaveError('');

    const response = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, locale, timezone, notificationPrefs })
    });

    setSaving(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setSaveError(readApiError(payload, 'Erro ao salvar perfil.'));
      return;
    }

    setSaveMessage('Perfil atualizado com sucesso.');
    await refetch();
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess(false);

    const response = await fetch('/api/users/me/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword, confirmPassword })
    });

    setPasswordLoading(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setPasswordError(readApiError(payload, 'Erro ao trocar senha.'));
      return;
    }

    setPasswordSuccess(true);
    setNewPassword('');
    setConfirmPassword('');
  }

  if (loading && !me) {
    return <div className="h-96 animate-pulse rounded-lg bg-white" />;
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Meu perfil</h1>
        <p className="mt-1 text-sm text-gray-500">Informacoes pessoais e configuracoes da conta.</p>
      </div>

      {error ? <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={(event) => void handleSave(event)} className="mb-5 rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-lg font-semibold text-white">
            {(name || me?.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-900">{name || me?.email}</p>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">{me?.email}</p>
            {me?.activeRole ? (
              <span className={cn('mt-2 inline-flex rounded px-2 py-0.5 text-xs font-medium', ROLE_STYLES[me.activeRole])}>
                {ROLE_LABELS[me.activeRole]}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="profile-name" label="Nome completo" required>
            <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" />
          </FormField>
          <FormField id="profile-email" label="Email">
            <Input id="profile-email" value={me?.email ?? ''} disabled className="bg-gray-50 text-gray-400" />
          </FormField>
          <FormField id="profile-locale" label="Idioma">
            <Select id="profile-locale" value={locale} onChange={(event) => setLocale(event.target.value as 'pt-BR' | 'en-US')}>
              <option value="pt-BR">Portugues (Brasil)</option>
              <option value="en-US">English (US)</option>
            </Select>
          </FormField>
          <FormField id="profile-timezone" label="Fuso horario">
            <Select id="profile-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
              {PROFILE_TIMEZONES.map((option) => (
                <option key={option} value={option}>
                  {option.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="mt-5 border-t border-gray-100 pt-5">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-800">Notificacoes</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['overduePayables', 'Contas a pagar vencidas'],
              ['overdueReceivables', 'Contas a receber vencidas'],
              ['periodsReminder', 'Lembrete de fechamento mensal'],
              ['reconciliationReminder', 'Lembrete de conciliacao bancaria']
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={notificationPrefs[key as keyof NotificationPrefs]}
                  onChange={(event) => setNotificationPref(key as keyof NotificationPrefs, event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {saveError ? <p className="mt-4 text-sm font-medium text-red-600">{saveError}</p> : null}
        {saveMessage ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {saveMessage}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={saving || name.trim().length < 2}>
            {saving ? 'Salvando...' : 'Salvar alteracoes'}
          </Button>
        </div>
      </form>

      {me?.companies?.length ? (
        <div className="mb-5 rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-800">Empresas</h2>
          </div>
          <div className="space-y-2">
            {me.companies.map((company) => (
              <div
                key={company.id}
                className={cn(
                  'flex items-center justify-between rounded-md px-3 py-2',
                  company.isActive ? 'border border-emerald-200 bg-emerald-50' : 'bg-gray-50'
                )}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{company.name}</p>
                  <p className="text-xs text-gray-500">{company.currency}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('rounded px-2 py-0.5 text-xs font-medium', ROLE_STYLES[company.role])}>
                    {ROLE_LABELS[company.role]}
                  </span>
                  {company.isActive ? <span className="text-xs font-medium text-emerald-700">Ativa</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <form onSubmit={(event) => void handleChangePassword(event)} className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-800">Seguranca</h2>
        </div>
        <div className="space-y-4">
          <FormField id="new-password" label="Nova senha">
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Minimo 8 caracteres, 1 maiuscula, 1 numero"
            />
          </FormField>
          <FormField id="confirm-password" label="Confirmar nova senha">
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repita a nova senha"
            />
          </FormField>
        </div>

        {passwordError ? <p className="mt-4 text-sm font-medium text-red-600">{passwordError}</p> : null}
        {passwordSuccess ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <Shield className="h-4 w-4" />
            Senha alterada com sucesso.
          </p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <Button type="submit" variant="outline" disabled={passwordLoading || !newPassword}>
            {passwordLoading ? 'Alterando...' : 'Alterar senha'}
          </Button>
        </div>
      </form>
    </div>
  );
}
