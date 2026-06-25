import { createHash } from 'crypto';
import { isValid, parse as parseDate } from 'date-fns';
import * as XLSX from 'xlsx';
import { normalizeDescription } from '@/lib/utils/normalize';
import type { ParsedMove } from './types';

export interface ImportMappingConfig {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn?: string | null;
  debitColumn?: string | null;
  creditColumn?: string | null;
  dateFormat: string;
  decimalSeparator: string;
  thousandSeparator?: string | null;
  headerRow: number;
  skipRowsStart: number;
  skipRowsEnd: number;
  amountSignConvention: 'signed_single' | 'separate_columns' | 'debit_negative';
  referenceColumn?: string | null;
  defaultCurrency: string;
}

function detectDelimiter(line: string): ',' | ';' | '\t' {
  const comma = (line.match(/,/g) ?? []).length;
  const semicolon = (line.match(/;/g) ?? []).length;
  const tab = (line.match(/\t/g) ?? []).length;

  if (tab > comma && tab > semicolon) return '\t';
  return semicolon > comma ? ';' : ',';
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function rowFromCells(headers: string[], cells: string[]): Record<string, string> {
  const normalizedCells = [...cells];

  if (normalizedCells.length > headers.length && headers.length > 0) {
    const fixed = normalizedCells.slice(0, headers.length - 1);
    fixed.push(normalizedCells.slice(headers.length - 1).join(','));
    normalizedCells.splice(0, normalizedCells.length, ...fixed);
  }

  const row: Record<string, string> = {};
  headers.forEach((header, index) => {
    if (header) row[header] = normalizedCells[index] ?? '';
  });
  return row;
}

function parseSignedAmount(raw: string, decimalSep: string, thousandSep?: string | null): number {
  let cleaned = raw.trim();
  const negative = cleaned.startsWith('(') && cleaned.endsWith(')');

  cleaned = cleaned.replace(/[^\d,.-]/g, '');
  if (thousandSep) cleaned = cleaned.split(thousandSep).join('');
  if (decimalSep === ',') cleaned = cleaned.replace(',', '.');
  if (negative) cleaned = `-${cleaned}`;

  return Number(cleaned) || 0;
}

function parseAmountCSV(raw: string, decimalSep: string, thousandSep?: string | null): number {
  return Math.abs(parseSignedAmount(raw, decimalSep, thousandSep));
}

function parseDateCSV(raw: string, format: string): Date {
  const parsed = parseDate(raw.trim(), format, new Date());
  if (isValid(parsed)) return parsed;

  const iso = new Date(raw.trim());
  if (isValid(iso)) return iso;

  throw new Error(`Data invalida: "${raw}" com formato "${format}"`);
}

function sheetToRows(
  buffer: Buffer,
  headerRow: number,
  skipStart: number,
  skipEnd: number
): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const allRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false }) as string[][];
  const headerIndex = headerRow - 1;
  const headers = (allRows[headerIndex] ?? []).map((header) => String(header ?? '').trim());
  const dataRows = allRows.slice(headerIndex + 1 + skipStart, skipEnd > 0 ? -skipEnd : undefined);

  return {
    headers,
    rows: dataRows
      .filter((row) => row.some((cell) => cell !== '' && cell !== null && cell !== undefined))
      .map((row) => rowFromCells(headers, row.map((cell) => String(cell ?? '').trim())))
  };
}

export function parseCSVContent(content: string, mapping: ImportMappingConfig): ParsedMove[] {
  const lines = content.split(/\r?\n/);
  const headerIndex = mapping.headerRow - 1;
  const delimiter = detectDelimiter(lines[headerIndex] ?? '');
  const headers = parseDelimitedLine(lines[headerIndex] ?? '', delimiter).map((header) => header.trim());
  const dataLines = lines
    .slice(headerIndex + 1 + mapping.skipRowsStart, mapping.skipRowsEnd > 0 ? lines.length - mapping.skipRowsEnd : undefined)
    .filter((line) => line.trim());
  const rows = dataLines.map((line) => rowFromCells(headers, parseDelimitedLine(line, delimiter)));

  return rowsToParsedMoves(rows, mapping);
}

function rowsToParsedMoves(rows: Record<string, string>[], mapping: ImportMappingConfig): ParsedMove[] {
  const moves: ParsedMove[] = [];

  for (const row of rows) {
    try {
      const rawDate = row[mapping.dateColumn];
      const rawDescription = row[mapping.descriptionColumn] ?? '';

      if (!rawDate || !rawDescription) continue;

      const postedDate = parseDateCSV(rawDate, mapping.dateFormat);
      let amount = 0;
      let type: 'credit' | 'debit' = 'debit';

      if (mapping.amountSignConvention === 'separate_columns') {
        const debitRaw = mapping.debitColumn ? row[mapping.debitColumn] ?? '' : '';
        const creditRaw = mapping.creditColumn ? row[mapping.creditColumn] ?? '' : '';
        const debit = debitRaw ? parseAmountCSV(debitRaw, mapping.decimalSeparator, mapping.thousandSeparator) : 0;
        const credit = creditRaw ? parseAmountCSV(creditRaw, mapping.decimalSeparator, mapping.thousandSeparator) : 0;

        amount = credit > 0 ? credit : debit;
        type = credit > 0 ? 'credit' : 'debit';
      } else {
        const raw = mapping.amountColumn ? row[mapping.amountColumn] ?? '0' : '0';
        const signedAmount = parseSignedAmount(raw, mapping.decimalSeparator, mapping.thousandSeparator);

        amount = Math.abs(signedAmount);
        type = signedAmount >= 0 ? 'credit' : 'debit';
      }

      if (amount === 0) continue;

      const { normalized, merchantName, merchantDocument } = normalizeDescription(rawDescription);

      moves.push({
        date: postedDate,
        postedDate,
        operationDate: null,
        amount,
        type,
        description: rawDescription,
        descriptionNormalized: normalized,
        merchantName,
        merchantDocument,
        bankRef: mapping.referenceColumn ? row[mapping.referenceColumn] ?? null : null,
        balanceAfter: null,
        rawMemo: null
      });
    } catch {
      // Invalid rows should not block the whole statement import.
    }
  }

  return moves;
}

export async function parseXLSX(buffer: Buffer, mapping: ImportMappingConfig): Promise<ParsedMove[]> {
  const { rows } = sheetToRows(buffer, mapping.headerRow, mapping.skipRowsStart, mapping.skipRowsEnd);
  return rowsToParsedMoves(rows, mapping);
}

export function detectColumns(buffer: Buffer, extension: 'csv' | 'xlsx'): string[] {
  if (extension === 'xlsx') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false }) as string[][];
    return ((rows[0] ?? []) as string[]).map((header) => String(header ?? '').trim()).filter(Boolean);
  }

  const content = buffer.toString('utf-8');
  const firstLine = content.split(/\r?\n/)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  return parseDelimitedLine(firstLine, delimiter)
    .map((header) => header.trim())
    .filter(Boolean);
}

export function computeFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
