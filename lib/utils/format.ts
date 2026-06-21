export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function parseBrazilianAmount(input: string): number {
  return Number(input.replace(/\./g, '').replace(',', '.'));
}

export function formatDateBR(value: string | null | undefined): string {
  if (!value) return '-';

  const datePart = value.slice(0, 10);
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  return new Date(value).toLocaleDateString('pt-BR');
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}
