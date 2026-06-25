import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CashFlowAI',
  description: 'SaaS financeiro B2B multiempresa'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
