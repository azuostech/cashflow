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
import { registerSchema, type RegisterInput } from '@/lib/validations/auth.schema';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange'
  });

  async function onSubmit(data: RegisterInput) {
    setLoading(true);
    setServerError('');

    const redirectTo = new URLSearchParams(window.location.search).get('redirect');
    const next = redirectTo?.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/onboarding';

    if (!isSupabaseBrowserConfigured()) {
      setServerError(SUPABASE_BROWSER_CONFIG_ERROR);
      setLoading(false);
      return;
    }

    let signupData;
    let error;

    try {
      const supabase = createClient();
      const result = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { name: data.name },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
        }
      });
      signupData = result.data;
      error = result.error;
    } catch {
      setServerError(SUPABASE_BROWSER_CONFIG_ERROR);
      setLoading(false);
      return;
    }

    if (error) {
      setServerError(
        error.message.includes('already registered')
          ? 'Este e-mail ja esta cadastrado.'
          : 'Erro ao criar conta. Tente novamente.'
      );
      setLoading(false);
      return;
    }

    if (signupData.session) {
      router.push(next);
      router.refresh();
      return;
    }

    setEmailSent(true);
    setLoading(false);
  }

  if (emailSent) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">
          OK
        </div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">Verifique seu e-mail</h2>
        <p className="text-sm text-gray-500">
          Enviamos um link de confirmacao. Clique nele para ativar sua conta e continuar.
        </p>
      </div>
    );
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

      <h2 className="mb-1 text-xl font-semibold text-gray-900">Criar conta</h2>
      <p className="mb-6 text-sm text-gray-500">
        Ja tem conta?{' '}
        <Link href="/login" className="font-medium text-emerald-600 hover:underline">
          Entrar
        </Link>
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField id="name" label="Nome completo" error={errors.name?.message} required>
          <Input id="name" placeholder="Seu nome" autoComplete="name" {...register('name')} />
        </FormField>

        <FormField id="email" label="E-mail" error={errors.email?.message} required>
          <Input id="email" type="email" placeholder="seu@email.com" autoComplete="email" {...register('email')} />
        </FormField>

        <FormField id="password" label="Senha" error={errors.password?.message} required>
          <Input
            id="password"
            type="password"
            placeholder="Min. 8 chars, 1 maiuscula, 1 numero"
            autoComplete="new-password"
            {...register('password')}
          />
        </FormField>

        <FormField id="confirmPassword" label="Confirmar senha" error={errors.confirmPassword?.message} required>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="********"
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
        </FormField>

        {serverError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
        ) : null}

        <Button type="submit" disabled={loading || !isValid} className="w-full">
          {loading ? 'Criando conta...' : 'Criar conta'}
        </Button>

        <p className="text-center text-xs text-gray-400">
          Ao criar uma conta, voce concorda com os termos de uso.
        </p>
      </form>
    </div>
  );
}
