export function normalizeDescription(raw: string): {
  normalized: string;
  merchantName: string | null;
  merchantDocument: string | null;
} {
  let text = raw.toUpperCase().trim();

  const cnpjMatch = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
  const cpfMatch = text.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  const merchantDocument = cnpjMatch?.[0] ?? cpfMatch?.[0] ?? null;

  const noiseWords = [
    'PIX',
    'TED',
    'DOC',
    'PGTO',
    'PAGAMENTO',
    'TRANSF',
    'TRANSFERENCIA',
    'TRANSFERÊNCIA',
    'ENVIADO',
    'RECEBIDO',
    'CRED',
    'DEB',
    'DEBITO',
    'CREDITO',
    'CRÉDITO',
    'COMPRA',
    'COMPRAS'
  ];

  for (const word of noiseWords) {
    text = text.replace(new RegExp(`\\b${word}\\b`, 'g'), ' ');
  }

  text = text.replace(/\b\d{2}[/-]\d{2}([/-]\d{2,4})?\b/g, ' ');
  text = text.replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, ' ');
  text = text.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, ' ');
  text = text.replace(/\b\d{2}:\d{2}(:\d{2})?\b/g, ' ');

  const normalized = text.replace(/\s+/g, ' ').trim().slice(0, 200);
  const merchantName = normalized.length > 0 ? normalized : null;

  return { normalized, merchantName, merchantDocument };
}
