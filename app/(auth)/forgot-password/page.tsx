'use client';

import { useState } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { SUPABASE_BROWSER_CONFIG_ERROR, createClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validations/auth.schema';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onChange'
  });

  async function onSubmit(data: ForgotPasswordInput) {
    setLoading(true);
    setServerError('');

    if (!isSupabaseBrowserConfigured()) {
      setServerError(SUPABASE_BROWSER_CONFIG_ERROR);
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`
      });
    } catch {
      setServerError(SUPABASE_BROWSER_CONFIG_ERROR);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h2 className="mb-2 text-xl font-semibold text-gray-900">E-mail enviado</h2>
        <p className="mb-4 text-sm text-gray-500">
          Se este e-mail estiver cadastrado, voce recebera um link para redefinir sua senha.
        </p>
        <Link href="/login" className="text-sm text-emerald-600 hover:underline">
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="mb-1 text-xl font-semibold text-gray-900">Recuperar senha</h2>
      <p className="mb-6 text-sm text-gray-500">Informe seu e-mail e enviaremos um link de redefinicao.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField id="email" label="E-mail" error={errors.email?.message} required>
          <Input id="email" type="email" placeholder="seu@email.com" autoComplete="email" {...register('email')} />
        </FormField>

        {serverError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
        ) : null}

        <Button type="submit" disabled={loading || !isValid} className="w-full">
          {loading ? 'Enviando...' : 'Enviar link'}
        </Button>

        <div className="text-center">
          <Link href="/login" className="text-xs text-gray-500 hover:text-emerald-600">
            Voltar ao login
          </Link>
        </div>
      </form>
    </div>
  );
}
