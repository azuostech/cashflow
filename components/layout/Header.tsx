'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SessionControls } from '@/components/layout/SessionControls';

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-app-border pb-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-app-subtle">{subtitle}</p> : null}
      </div>
      <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:items-end">
        <SessionControls />
        <Button variant="outline" onClick={logout}>
          Sair
        </Button>
      </div>
    </header>
  );
}
