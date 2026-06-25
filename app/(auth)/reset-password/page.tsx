'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { SUPABASE_BROWSER_CONFIG_ERROR, createClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validations/auth.schema';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange'
  });

  async function onSubmit(data: ResetPasswordInput) {
    setLoading(true);
    setError('');

    if (!isSupabaseBrowserConfigured()) {
      setError(SUPABASE_BROWSER_CONFIG_ERROR);
      setLoading(false);
      return;
    }

    let updateError;

    try {
      const supabase = createClient();
      const result = await supabase.auth.updateUser({ password: data.password });
      updateError = result.error;
    } catch {
      setError(SUPABASE_BROWSER_CONFIG_ERROR);
      setLoading(false);
      return;
    }

    if (updateError) {
      setError('Nao foi possivel redefinir a senha. O link pode ter expirado.');
      setLoading(false);
      return;
    }

    router.push('/login?message=password_updated');
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="mb-1 text-xl font-semibold text-gray-900">Nova senha</h2>
      <p className="mb-6 text-sm text-gray-500">Defina uma nova senha para sua conta.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField id="password" label="Nova senha" error={errors.password?.message} required>
          <Input id="password" type="password" placeholder="Min. 8 chars" autoComplete="new-password" {...register('password')} />
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

        {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <Button type="submit" disabled={loading || !isValid} className="w-full">
          {loading ? 'Salvando...' : 'Salvar nova senha'}
        </Button>
      </form>
    </div>
  );
}
