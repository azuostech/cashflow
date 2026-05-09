'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const schema = z.object({
  email: z.string().email('Informe um email valido.'),
  password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.'),
  remember: z.boolean().optional()
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
      remember: true
    }
  });

  async function onSubmit(values: LoginForm) {
    setLoading(true);
    setError(null);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? 'Nao foi possivel realizar login.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <section className="w-full rounded-2xl border border-app-border bg-white p-6 shadow-card">
        <h1 className="text-2xl font-bold">Entrar</h1>
        <p className="mb-6 text-sm text-app-subtle">Acesse sua conta para analisar o fluxo de caixa.</p>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email ? <p className="mt-1 text-xs text-danger">{errors.email.message}</p> : null}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Senha
            </label>
            <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
            {errors.password ? <p className="mt-1 text-xs text-danger">{errors.password.message}</p> : null}
          </div>

          <label className="flex items-center gap-2 text-sm text-app-subtle">
            <input type="checkbox" {...register('remember')} />
            Lembrar-me
          </label>

          {error ? <p className="rounded-lg bg-red-50 p-2 text-sm text-danger">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-app-subtle">Nao tem conta?</span>
          <Link href="/cadastro" className="font-semibold text-primary">
            Criar conta
          </Link>
        </div>
      </section>
    </main>
  );
}
