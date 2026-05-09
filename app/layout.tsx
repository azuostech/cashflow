import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CashFlow Analyzer',
  description: 'Analise inteligente de fluxo de caixa empresarial.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
