'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { SUPABASE_BROWSER_CONFIG_ERROR, createClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { loginSchema, type LoginInput } from '@/lib/validations/auth.schema';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange'
  });

  async function onSubmit(data: LoginInput) {
    setLoading(true);
    setServerError('');

    if (!isSupabaseBrowserConfigured()) {
      setServerError(SUPABASE_BROWSER_CONFIG_ERROR);
      setLoading(false);
      return;
    }

    let error;

    try {
      const supabase = createClient();
      const result = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });
      error = result.error;
    } catch {
      setServerError(SUPABASE_BROWSER_CONFIG_ERROR);
      setLoading(false);
      return;
    }

    if (error) {
      setServerError(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos'
          : 'Erro ao fazer login. Tente novamente.'
      );
      setLoading(false);
      return;
    }

    const redirectTo = new URLSearchParams(window.location.search).get('redirect');

    if (redirectTo?.startsWith('/') && !redirectTo.startsWith('//')) {
      router.push(redirectTo);
      router.refresh();
      return;
    }

    const response = await fetch('/api/onboarding/status');

    if (!response.ok) {
      setServerError('Erro ao verificar onboarding. Tente novamente.');
      setLoading(false);
      return;
    }

    const status: { hasCompany?: boolean; step?: number | 'complete'; homeRoute?: string } = await response.json();

    if (!status.hasCompany) {
      router.push('/onboarding');
    } else if (status.step !== 'complete') {
      router.push(`/onboarding?step=${status.step}`);
    } else {
      router.push(status.homeRoute ?? '/dashboard');
    }

    router.refresh();
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-sm font-bold text-white">
          CF
        </div>
        <div>
          <h1 className="text-lg font-semibold leading-tight text-gray-900">CashFlowAI</h1>
          <p className="text-xs text-gray-500">Gestao financeira empresarial</p>
        </div>
      </div>

      <h2 className="mb-1 text-xl font-semibold text-gray-900">Entrar</h2>
      <p className="mb-6 text-sm text-gray-500">
        Novo por aqui?{' '}
        <Link href="/register" className="font-medium text-emerald-600 hover:underline">
          Criar conta
        </Link>
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField id="email" label="E-mail" error={errors.email?.message} required>
          <Input id="email" type="email" placeholder="seu@email.com" autoComplete="email" {...register('email')} />
        </FormField>

        <FormField id="password" label="Senha" error={errors.password?.message} required>
          <Input
            id="password"
            type="password"
            placeholder="********"
            autoComplete="current-password"
            {...register('password')}
          />
        </FormField>

        <div className="text-right">
          <Link href="/forgot-password" className="text-xs text-gray-500 hover:text-emerald-600">
            Esqueci a senha
          </Link>
        </div>

        {serverError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
        ) : null}

        <Button type="submit" disabled={loading || !isValid} className="w-full">
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
    </div>
  );
}
