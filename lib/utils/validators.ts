export function cleanOnlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCNPJ(value: string): string {
  const cnpj = cleanOnlyDigits(value).slice(0, 14);
  return cnpj
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function validateCNPJ(cnpj: string): boolean {
  const digits = cleanOnlyDigits(cnpj);

  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  let sum = 0;
  let pos = 5;

  for (let i = 0; i < 12; i += 1) {
    sum += Number(digits.charAt(i)) * pos;
    pos = pos === 2 ? 9 : pos - 1;
  }

  let expected = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (Number(digits.charAt(12)) !== expected) return false;

  sum = 0;
  pos = 6;

  for (let i = 0; i < 13; i += 1) {
    sum += Number(digits.charAt(i)) * pos;
    pos = pos === 2 ? 9 : pos - 1;
  }

  expected = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return Number(digits.charAt(13)) === expected;
}
