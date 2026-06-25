'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SUPABASE_BROWSER_CONFIG_ERROR, createClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

type InviteStatus = 'loading' | 'needs_login' | 'accepting' | 'error' | 'success';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<InviteStatus>('loading');
  const [companyName, setCompanyName] = useState('');
  const [roleName, setRoleName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const acceptInvite = useCallback(async () => {
    setStatus('accepting');

    const response = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      setStatus('error');
      return;
    }

    const data: { companyName: string; role: string } = await response.json();
    setCompanyName(data.companyName);
    setRoleName(data.role);
    setStatus('success');
  }, [token]);

  useEffect(() => {
    if (!isSupabaseBrowserConfigured()) {
      setErrorMessage(SUPABASE_BROWSER_CONFIG_ERROR);
      setStatus('error');
      return;
    }

    let supabase;

    try {
      supabase = createClient();
    } catch {
      setErrorMessage(SUPABASE_BROWSER_CONFIG_ERROR);
      setStatus('error');
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        setStatus('needs_login');
        return;
      }

      void acceptInvite();
    });
  }, [acceptInvite]);

  if (status === 'loading' || status === 'accepting') {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600" />
        <p className="text-sm text-gray-500">Processando convite...</p>
      </div>
    );
  }

  if (status === 'needs_login') {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h2 className="mb-2 text-xl font-semibold text-gray-900">Convite recebido</h2>
        <p className="mb-6 text-sm text-gray-500">Faca login ou crie uma conta para aceitar o convite.</p>
        <div className="flex justify-center gap-3">
          <Button type="button" variant="outline" onClick={() => router.push(`/login?redirect=/invite/${token}`)}>
            Entrar
          </Button>
          <Button type="button" onClick={() => router.push(`/register?redirect=/invite/${token}`)}>
            Criar conta
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h2 className="mb-2 text-xl font-semibold text-gray-900">Convite invalido</h2>
        <p className="mb-4 text-sm text-gray-500">{errorMessage || 'Este convite nao foi encontrado ou ja foi aceito.'}</p>
        <Button type="button" onClick={() => router.push('/dashboard')}>
          Ir ao dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">
        OK
      </div>
      <h2 className="mb-2 text-xl font-semibold text-gray-900">Convite aceito</h2>
      <p className="mb-6 text-sm text-gray-500">
        Voce agora tem acesso a empresa <strong>{companyName}</strong> como <strong>{roleName}</strong>.
      </p>
      <Button type="button" onClick={() => router.push('/dashboard')}>
        Ir ao dashboard
      </Button>
    </div>
  );
}
