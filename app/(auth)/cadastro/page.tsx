'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCNPJ } from '@/lib/utils/validators';

const schema = z
  .object({
    companyName: z.string().min(2, 'Informe o nome da empresa.'),
    cnpj: z.string().min(14, 'Informe um CNPJ valido.'),
    email: z.string().email('Informe um email valido.'),
    password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.'),
    confirmPassword: z.string().min(6, 'Confirme sua senha.')
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas nao coincidem.'
  });

type FormValues = z.infer<typeof schema>;

export default function CadastroPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: '',
      cnpj: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    setError(null);

    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? 'Nao foi possivel concluir o cadastro.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-8">
      <section className="w-full rounded-2xl border border-app-border bg-white p-6 shadow-card">
        <h1 className="text-2xl font-bold">Criar conta</h1>
        <p className="mb-6 text-sm text-app-subtle">Cadastre sua empresa e comece a analisar seu fluxo de caixa.</p>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="companyName" className="mb-1 block text-sm font-medium">
              Nome da empresa
            </label>
            <Input id="companyName" {...register('companyName')} />
            {errors.companyName ? <p className="mt-1 text-xs text-danger">{errors.companyName.message}</p> : null}
          </div>

          <div>
            <label htmlFor="cnpj" className="mb-1 block text-sm font-medium">
              CNPJ
            </label>
            <Input
              id="cnpj"
              {...register('cnpj')}
              onChange={(event) => setValue('cnpj', formatCNPJ(event.target.value), { shouldValidate: true })}
            />
            {errors.cnpj ? <p className="mt-1 text-xs text-danger">{errors.cnpj.message}</p> : null}
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email ? <p className="mt-1 text-xs text-danger">{errors.email.message}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium">
                Senha
              </label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password ? <p className="mt-1 text-xs text-danger">{errors.password.message}</p> : null}
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium">
                Confirmar senha
              </label>
              <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
              {errors.confirmPassword ? <p className="mt-1 text-xs text-danger">{errors.confirmPassword.message}</p> : null}
            </div>
          </div>

          {error ? <p className="rounded-lg bg-red-50 p-2 text-sm text-danger">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-app-subtle">Ja possui conta?</span>
          <Link href="/login" className="font-semibold text-primary">
            Fazer login
          </Link>
        </div>
      </section>
    </main>
  );
}
