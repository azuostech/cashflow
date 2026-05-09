import { cn } from '@/lib/utils/cn';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-xl border border-app-border bg-white p-5 shadow-card', className)}>{children}</div>;
}
