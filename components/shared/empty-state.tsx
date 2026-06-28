import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon ? <div className="mb-4 text-gray-300">{icon}</div> : null}
      <h3 className="mb-1 text-base font-semibold text-gray-700">{title}</h3>
      <p className="max-w-xs text-sm text-gray-400">{description}</p>
      {action ? (
        <Button type="button" onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
