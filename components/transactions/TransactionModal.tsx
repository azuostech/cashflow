'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TransactionModalProps {
  transactionId: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function TransactionModal({ transactionId, onClose, onSaved }: TransactionModalProps) {
  const [notes, setNotes] = useState('');
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!transactionId) return;

    fetch(`/api/transactions/${transactionId}`)
      .then((response) => response.json())
      .then((data) => {
        setNotes(data.notes ?? '');
        setHidden(Boolean(data.is_hidden));
      })
      .catch(() => {
        setNotes('');
      });
  }, [transactionId]);

  if (!transactionId) return null;

  async function save() {
    setLoading(true);

    await fetch(`/api/transactions/${transactionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, is_hidden: hidden })
    });

    setLoading(false);
    onSaved?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5">
        <h3 className="mb-4 text-lg font-semibold">Editar transacao</h3>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Observacoes</label>
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />
            Ocultar transacao nos relatorios
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
