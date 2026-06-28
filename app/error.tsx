'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-700">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Algo deu errado</h1>
        <p className="mb-2 text-sm text-gray-500">
          Ocorreu um erro inesperado. Se o problema persistir, entre em contato com o suporte.
        </p>
        {error.digest ? <p className="mb-6 font-mono text-xs text-gray-300">Codigo: {error.digest}</p> : null}
        <div className="flex justify-center gap-3">
          <Button type="button" variant="outline" onClick={() => window.location.assign('/dashboard')}>
            Ir ao Dashboard
          </Button>
          <Button type="button" onClick={reset}>
            Tentar novamente
          </Button>
        </div>
      </div>
    </div>
  );
}
