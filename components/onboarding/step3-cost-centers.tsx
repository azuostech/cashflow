'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

const SUGGESTIONS = ['Comercial', 'Operacional', 'Administrativo', 'Marketing', 'TI / Produto', 'Financeiro', 'RH', 'Logistica'];

interface OnboardingStep3CostCentersProps {
  companyId: string | null;
  onComplete: () => void;
  onBack: () => void;
}

export function OnboardingStep3CostCenters({ onComplete, onBack }: OnboardingStep3CostCentersProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(['Comercial', 'Administrativo']));
  const [custom, setCustom] = useState('');
  const [extras, setExtras] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggle(name: string) {
    setSelected((previous) => {
      const next = new Set(previous);

      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }

      return next;
    });
  }

  function addCustom() {
    const name = custom.trim();

    if (!name) return;

    setExtras((previous) => (previous.includes(name) ? previous : [...previous, name]));
    setSelected((previous) => new Set(Array.from(previous).concat(name)));
    setCustom('');
  }

  async function onNext() {
    const items = Array.from(selected).map((name) => ({ name }));

    if (items.length === 0) {
      setError('Adicione ao menos 1 centro de custo.');
      return;
    }

    setLoading(true);
    setError('');

    const response = await fetch('/api/cost-centers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });

    if (!response.ok) {
      setError('Erro ao salvar centros de custo.');
      setLoading(false);
      return;
    }

    onComplete();
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Centros de custo</h2>
      <p className="mb-6 text-sm text-gray-500">Centros de custo permitem analisar receitas e despesas por area da empresa.</p>

      <div className="mb-5 grid gap-2 sm:grid-cols-2">
        {[...SUGGESTIONS, ...extras].map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => toggle(name)}
            className={cn(
              'flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors',
              selected.has(name)
                ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded border text-[10px]',
                selected.has(name) ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300'
              )}
            >
              {selected.has(name) ? 'OK' : ''}
            </span>
            {name}
          </button>
        ))}
      </div>

      <div className="mb-2 flex gap-2">
        <Input
          placeholder="Personalizado..."
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addCustom();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addCustom} disabled={!custom.trim()} aria-label="Adicionar centro de custo">
          +
        </Button>
      </div>

      <p className="mb-5 text-xs text-gray-400">
        {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
      </p>

      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="mt-4 flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack} className="text-gray-500">
          Voltar
        </Button>
        <Button type="button" onClick={onNext} disabled={loading || selected.size === 0} className="px-8">
          {loading ? 'Salvando...' : 'Proximo'}
        </Button>
      </div>
    </div>
  );
}
