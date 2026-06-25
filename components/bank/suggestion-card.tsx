'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';

interface SuggestionCardProps {
  suggestion: {
    transactionId: string | null;
    installmentId: string | null;
    description: string;
    amount: number | string;
    currency: string;
    dueDate: string;
    status: string;
    categoryName: string | null;
    contactName: string | null;
    confidence: 'high' | 'medium' | 'low';
    reasons: string[];
  };
  onReconcile: () => void;
  disabled?: boolean;
}

const confidenceConfig = {
  high: { label: 'Alta confianca', className: 'bg-emerald-50 text-emerald-700' },
  medium: { label: 'Media confianca', className: 'bg-blue-50 text-blue-700' },
  low: { label: 'Baixa confianca', className: 'bg-gray-100 text-gray-500' }
};

export function SuggestionCard({ suggestion, onReconcile, disabled }: SuggestionCardProps) {
  const confidence = confidenceConfig[suggestion.confidence];

  return (
    <div className={cn('mb-3 rounded-lg border border-gray-200 bg-white p-4', suggestion.confidence === 'low' ? 'opacity-70' : '')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={cn('rounded px-2 py-0.5 text-xs font-medium', confidence.className)}>{confidence.label}</span>
        <span className="text-xs text-gray-400">{suggestion.installmentId ? 'Parcela' : 'Lancamento'}</span>
      </div>

      <div className="mb-3 rounded-md bg-gray-50 p-3">
        <p className="mb-1 truncate text-sm font-medium text-gray-900" title={suggestion.description}>
          {suggestion.description}
        </p>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5 text-xs text-gray-500">
            <p>
              Venc: {formatDate(suggestion.dueDate)} | {suggestion.status}
            </p>
            {suggestion.categoryName ? <p>Categoria: {suggestion.categoryName}</p> : null}
            {suggestion.contactName ? <p>Contato: {suggestion.contactName}</p> : null}
          </div>
          <p className="flex-shrink-0 text-sm font-semibold text-gray-800">
            {formatCurrency(Number(suggestion.amount), suggestion.currency)}
          </p>
        </div>
      </div>

      {suggestion.reasons.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1">
          {suggestion.reasons.map((reason) => (
            <span key={reason} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {reason}
            </span>
          ))}
        </div>
      ) : null}

      <Button type="button" onClick={onReconcile} disabled={disabled} className="h-9 w-full gap-2">
        <Check className="h-4 w-4" />
        Conciliar
      </Button>
    </div>
  );
}
