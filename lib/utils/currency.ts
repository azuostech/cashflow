export function formatCurrency(
  value: number,
  currency: string = 'BRL',
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options
  }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

export function parseBrazilianNumber(value: string): number {
  return parseFloat(value.replace(/\./g, '').replace(',', '.'));
}
