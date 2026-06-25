export function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;

  const calc = (digits: string, weights: number[]) =>
    digits.split('').reduce((sum, digit, index) => sum + parseInt(digit, 10) * weights[index], 0);

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const firstRest = calc(cleaned.slice(0, 12), firstWeights) % 11;
  const firstDigit = firstRest < 2 ? 0 : 11 - firstRest;
  if (firstDigit !== parseInt(cleaned[12], 10)) return false;

  const secondRest = calc(cleaned.slice(0, 13), secondWeights) % 11;
  const secondDigit = secondRest < 2 ? 0 : 11 - secondRest;
  return secondDigit === parseInt(cleaned[13], 10);
}

export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '').slice(0, 14);
  return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}
