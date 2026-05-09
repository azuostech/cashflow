'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { currentMonth } from '@/lib/utils/date';

export default function RelatoriosPage() {
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState<'pdf' | 'excel' | null>(null);

  async function download(type: 'pdf' | 'excel') {
    setLoading(type);

    const endpoint = type === 'pdf' ? '/api/reports/export-pdf' : '/api/reports/export-excel';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month })
    });

    if (!response.ok) {
      setLoading(null);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `relatorio-${month}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
    anchor.click();
    URL.revokeObjectURL(url);

    setLoading(null);
  }

  return (
    <section>
      <Header title="Relatorios" subtitle="Exporte dados de fluxo de caixa em PDF e Excel." />

      <Card className="max-w-2xl">
        <label className="mb-2 block text-sm font-medium">Mes de referencia</label>
        <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />

        <div className="mt-4 flex gap-3">
          <Button type="button" onClick={() => download('pdf')} disabled={loading !== null}>
            {loading === 'pdf' ? 'Gerando PDF...' : 'Exportar PDF'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => download('excel')} disabled={loading !== null}>
            {loading === 'excel' ? 'Gerando Excel...' : 'Exportar Excel'}
          </Button>
        </div>
      </Card>
    </section>
  );
}
