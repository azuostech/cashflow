import pdfParse from 'pdf-parse';
import { parseBrazilianAmount } from '@/lib/utils/format';

export interface ParsedTransaction {
  date: string;
  description: string;
  documentNumber: string;
  type: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
}

export interface ParsedStatement {
  periodStart: string;
  periodEnd: string;
  initialBalance: number;
  finalBalance: number;
  transactions: ParsedTransaction[];
}

const dateRegex = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;
const amountRegex = /\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g;
const amountWithTypeRegex = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*([CD])\b/i;

function extractAmounts(text: string): number[] {
  const matches = text.match(amountRegex) ?? [];
  return matches.map((value) => parseBrazilianAmount(value));
}

function normalizeDescription(text: string): string {
  return text
    .replace(dateRegex, ' ')
    .replace(/\b\d{1,3}(?:\.\d{3})*,\d{2}\s*[CD]?\b/gi, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferType(text: string): 'credit' | 'debit' {
  if (/\bREM:|CREDITO|RECEBIMENTO|ENTRADA\b/i.test(text)) return 'credit';
  if (/\bDES:|DEBITO|PAGAMENTO|TARIFA|SAQUE|SAIDA\b/i.test(text)) return 'debit';
  return 'debit';
}

export async function parseBradescoPDF(pdfBuffer: Buffer): Promise<ParsedStatement> {
  const data = await pdfParse(pdfBuffer);
  const lines = data.text
    .split('\n')
    .map((line: string) => line.trim())
    .filter(Boolean);

  const transactions: ParsedTransaction[] = [];
  let initialBalance = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/SALDO ANTERIOR/i.test(line)) {
      const currentAmounts = extractAmounts(line);
      const nextAmounts = extractAmounts(lines[i + 1] ?? '');
      const candidate = currentAmounts.at(-1) ?? nextAmounts.at(-1) ?? 0;
      if (candidate > 0) initialBalance = candidate;
    }
  }

  let previousBalance: number | null = initialBalance > 0 ? initialBalance : null;

  for (let i = 0; i < lines.length; i += 1) {
    const dateMatch = lines[i].match(dateRegex);
    if (!dateMatch) continue;

    const blockLines = [lines[i]];

    for (let j = i + 1; j < lines.length && j < i + 5; j += 1) {
      if (dateRegex.test(lines[j])) break;
      blockLines.push(lines[j]);
    }

    const blockText = blockLines.join(' ');

    if (/SALDO (ANTERIOR|DO DIA|FINAL)/i.test(blockText) && !/(PIX|TRANSFERENCIA|DOC|TED|BOLETO|PAGAMENTO|TARIFA)/i.test(blockText)) {
      continue;
    }

    const [, day, month, year] = dateMatch;
    const date = `${year}-${month}-${day}`;

    const rawDescription = normalizeDescription(blockText);
    const description = rawDescription || blockLines[0].replace(dateRegex, '').trim();

    if (!description) continue;

    const documentNumber = blockText.match(/\b(\d{6,})\b/)?.[1] ?? '';

    const typedAmountMatch = blockText.match(amountWithTypeRegex);
    let type: 'credit' | 'debit' = typedAmountMatch
      ? typedAmountMatch[2].toUpperCase() === 'C'
        ? 'credit'
        : 'debit'
      : inferType(blockText);

    const amounts = extractAmounts(blockText);
    let balanceAfter = amounts.at(-1) ?? 0;
    let amount = 0;

    if (typedAmountMatch?.[1]) {
      amount = parseBrazilianAmount(typedAmountMatch[1]);
    } else if (amounts.length >= 2) {
      amount = amounts[amounts.length - 2];
    }

    if (previousBalance !== null && balanceAfter > 0) {
      const diff = balanceAfter - previousBalance;
      const inferredAmount = Math.abs(diff);
      if (inferredAmount > 0) {
        amount = inferredAmount;
        type = diff >= 0 ? 'credit' : 'debit';
      }
    }

    if (amount <= 0 || balanceAfter <= 0) {
      continue;
    }

    if (!firstDate) firstDate = date;
    lastDate = date;

    transactions.push({
      date,
      description,
      documentNumber,
      type,
      amount,
      balanceAfter
    });

    previousBalance = balanceAfter;
  }

  if (!firstDate || !lastDate || transactions.length === 0) {
    throw new Error('Nao foi possivel identificar transacoes validas no extrato PDF.');
  }

  return {
    periodStart: firstDate,
    periodEnd: lastDate,
    initialBalance,
    finalBalance: transactions.at(-1)?.balanceAfter ?? initialBalance,
    transactions
  };
}
