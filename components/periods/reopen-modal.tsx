'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, UnlockKeyhole } from 'lucide-react';
import { Modal } from '@/components/shared/modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ReopenModalProps {
  year: number;
  month: number;
  label: string;
  open: boolean;
  mode: 'reopen' | 'unlock';
  onClose: () => void;
  onConfirm: (justification: string) => Promise<void> | void;
}

export function ReopenModal({ label, open, mode, onClose, onConfirm }: ReopenModalProps) {
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setJustification('');
    setError('');
  }, [open]);

  async function handleConfirm() {
    if (justification.trim().length < 20) {
      setError('Justificativa minima de 20 caracteres.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onConfirm(justification.trim());
    } finally {
      setLoading(false);
    }
  }

  const isUnlock = mode === 'unlock';

  return (
    <Modal open={open} onClose={onClose} title={`${isUnlock ? 'Desbloquear' : 'Reabrir'} ${label}`} size="sm">
      <div className="space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {isUnlock
            ? 'O periodo voltara ao status fechado e podera ser reaberto depois com justificativa.'
            : 'O periodo voltara ao status aberto. Esta acao fica registrada no log de auditoria.'}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500" htmlFor="period-reopen-justification">
            Justificativa <span className="text-red-500">*</span>
          </label>
          <Textarea
            id="period-reopen-justification"
            className="min-h-24 resize-none"
            value={justification}
            onChange={(event) => {
              setJustification(event.target.value);
              setError('');
            }}
            placeholder="Ex: Ajuste solicitado apos revisao do fechamento mensal."
          />
          {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
        </div>

        <div className="flex justify-between">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={loading || justification.trim().length < 20}
            onClick={() => void handleConfirm()}
            className={isUnlock ? 'gap-2' : 'gap-2 bg-amber-600 hover:bg-amber-700'}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : isUnlock ? (
              <UnlockKeyhole className="h-4 w-4" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {loading ? 'Processando...' : isUnlock ? 'Desbloquear periodo' : 'Reabrir periodo'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
