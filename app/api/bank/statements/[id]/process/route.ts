import {
  BankMoveSource,
  FileFormat,
  ImportAmountConvention,
  ReconciliationStatus,
  StatementSource
} from '@prisma/client';
import { addDays, subDays } from 'date-fns';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { type ImportMappingConfig, parseCSVContent, parseXLSX } from '@/lib/parsers/csv-xlsx';
import { parseOFX } from '@/lib/parsers/ofx';
import type { ParsedMove } from '@/lib/parsers/types';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/lib/utils/audit';

export const runtime = 'nodejs';

const STATEMENTS_BUCKET = 'cashflowai-statements';

const inlineMappingSchema = z.object({
  dateColumn: z.string().min(1),
  descriptionColumn: z.string().min(1),
  amountColumn: z.string().optional().nullable(),
  debitColumn: z.string().optional().nullable(),
  creditColumn: z.string().optional().nullable(),
  referenceColumn: z.string().optional().nullable(),
  dateFormat: z.string().default('dd/MM/yyyy'),
  decimalSeparator: z.string().length(1).default('.'),
  thousandSeparator: z.string().length(1).optional().nullable(),
  amountSignConvention: z.enum(['signed_single', 'separate_columns', 'debit_negative']),
  saveMapping: z.boolean().default(false),
  mappingName: z.string().optional().nullable()
});

const processSchema = z.object({
  exchangeRate: z.coerce.number().positive().optional().default(1),
  exchangeRateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  importMappingId: z.string().uuid().optional().nullable(),
  inlineMapping: inlineMappingSchema.optional().nullable()
});

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function toDateRange(date: Date, days: number) {
  return {
    gte: subDays(date, days),
    lte: addDays(date, days)
  };
}

function getFileFormat(filename: string | null): FileFormat {
  return filename?.toLowerCase().endsWith('.csv') ? FileFormat.csv : FileFormat.xlsx;
}

function mapRecordToConfig(
  mapping: {
    dateColumn: string;
    descriptionColumn: string;
    amountColumn: string | null;
    debitColumn: string | null;
    creditColumn: string | null;
    dateFormat: string;
    decimalSeparator: string;
    thousandSeparator: string | null;
    headerRow: number;
    skipRowsStart: number;
    skipRowsEnd: number;
    amountSignConvention: ImportAmountConvention;
    referenceColumn: string | null;
    defaultCurrency: string;
  }
): ImportMappingConfig {
  return {
    dateColumn: mapping.dateColumn,
    descriptionColumn: mapping.descriptionColumn,
    amountColumn: mapping.amountColumn,
    debitColumn: mapping.debitColumn,
    creditColumn: mapping.creditColumn,
    dateFormat: mapping.dateFormat,
    decimalSeparator: mapping.decimalSeparator,
    thousandSeparator: mapping.thousandSeparator,
    headerRow: mapping.headerRow,
    skipRowsStart: mapping.skipRowsStart,
    skipRowsEnd: mapping.skipRowsEnd,
    amountSignConvention: mapping.amountSignConvention,
    referenceColumn: mapping.referenceColumn,
    defaultCurrency: mapping.defaultCurrency
  };
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const statement = await prisma.bankStatement.findFirst({
    where: { id: params.id, companyId: session.companyId },
    include: {
      bankAccount: { include: { bankProvider: true } },
      importMapping: true
    }
  });

  if (!statement) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (statement.status === 'completed') {
    return NextResponse.json({ error: 'Extrato ja foi processado' }, { status: 409 });
  }

  const body = await request.json();
  const parsed = processSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { baseCurrency: true }
  });
  const baseCurrency = company?.baseCurrency ?? 'BRL';

  const supabase = createClient();
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(STATEMENTS_BUCKET)
    .download(statement.rawFileUrl ?? '');

  if (downloadError || !fileData) {
    return NextResponse.json({ error: 'Nao foi possivel recuperar o arquivo do storage' }, { status: 500 });
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const ext = statement.filename?.split('.').pop()?.toLowerCase() ?? 'ofx';
  let moves: ParsedMove[] = [];
  let warnings: string[] = [];
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;
  let mappingIdToPersist: string | null = statement.importMappingId ?? null;

  await prisma.bankStatement.update({
    where: { id: statement.id },
    data: { status: 'processing', errorMessage: null }
  });

  try {
    if (statement.source === StatementSource.file_ofx || ext === 'ofx') {
      const result = parseOFX(buffer, {
        expectedBankId: statement.bankAccount.bankCode,
        expectedAccountId: statement.bankAccount.accountNumber
      });
      moves = result.moves;
      warnings = result.warnings;
      periodStart = result.periodStart;
      periodEnd = result.periodEnd;
    } else {
      let mappingRecord = statement.importMapping;
      const { importMappingId, inlineMapping } = parsed.data;

      if (importMappingId) {
        mappingRecord = await prisma.importMapping.findFirst({
          where: {
            id: importMappingId,
            active: true,
            OR: [{ isGlobal: true }, { companyId: session.companyId }]
          }
        });
      }

      let mappingConfig: ImportMappingConfig | null = mappingRecord ? mapRecordToConfig(mappingRecord) : null;

      if (!mappingConfig && inlineMapping) {
        mappingConfig = {
          dateColumn: inlineMapping.dateColumn,
          descriptionColumn: inlineMapping.descriptionColumn,
          amountColumn: inlineMapping.amountColumn ?? null,
          debitColumn: inlineMapping.debitColumn ?? null,
          creditColumn: inlineMapping.creditColumn ?? null,
          referenceColumn: inlineMapping.referenceColumn ?? null,
          dateFormat: inlineMapping.dateFormat,
          decimalSeparator: inlineMapping.decimalSeparator,
          thousandSeparator: inlineMapping.thousandSeparator ?? null,
          headerRow: 1,
          skipRowsStart: 0,
          skipRowsEnd: 0,
          amountSignConvention: inlineMapping.amountSignConvention,
          defaultCurrency: statement.currency
        };

        if (inlineMapping.saveMapping && inlineMapping.mappingName) {
          const savedMapping = await prisma.importMapping.create({
            data: {
              companyId: session.companyId,
              bankProviderId: statement.bankProviderId,
              name: inlineMapping.mappingName,
              fileFormat: getFileFormat(statement.filename),
              dateColumn: inlineMapping.dateColumn,
              descriptionColumn: inlineMapping.descriptionColumn,
              amountColumn: inlineMapping.amountColumn ?? null,
              debitColumn: inlineMapping.debitColumn ?? null,
              creditColumn: inlineMapping.creditColumn ?? null,
              referenceColumn: inlineMapping.referenceColumn ?? null,
              dateFormat: inlineMapping.dateFormat,
              decimalSeparator: inlineMapping.decimalSeparator,
              thousandSeparator: inlineMapping.thousandSeparator ?? null,
              headerRow: 1,
              skipRowsStart: 0,
              skipRowsEnd: 0,
              amountSignConvention: inlineMapping.amountSignConvention,
              defaultCurrency: statement.currency,
              isGlobal: false,
              active: true,
              createdById: session.userId
            }
          });
          mappingIdToPersist = savedMapping.id;
        }
      }

      if (!mappingConfig) {
        return NextResponse.json({ error: 'Mapeamento de colunas obrigatorio para CSV/XLSX' }, { status: 422 });
      }

      moves = ext === 'csv' ? parseCSVContent(buffer.toString('utf-8'), mappingConfig) : await parseXLSX(buffer, mappingConfig);
      for (const move of moves) {
        if (!periodStart || move.date < periodStart) periodStart = move.date;
        if (!periodEnd || move.date > periodEnd) periodEnd = move.date;
      }
    }

    if (moves.length === 0) {
      await prisma.bankStatement.update({
        where: { id: statement.id },
        data: {
          status: 'completed',
          totalMoves: 0,
          totalDuplicates: 0,
          totalErrors: 0,
          importMappingId: mappingIdToPersist
        }
      });
      return NextResponse.json({ imported: 0, duplicates: 0, errors: 0, warnings, statementId: statement.id });
    }

    const effectiveRate = statement.currency !== baseCurrency ? parsed.data.exchangeRate : 1;
    let importedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const move of moves) {
      try {
        if (move.bankRef) {
          const existing = await prisma.bankMove.findFirst({
            where: { bankAccountId: statement.bankAccountId, bankRef: move.bankRef }
          });
          if (existing) {
            duplicateCount += 1;
            continue;
          }
        }

        const softMatch = await prisma.bankMove.findFirst({
          where: {
            bankAccountId: statement.bankAccountId,
            originalAmount: move.amount,
            date: toDateRange(move.date, 3),
            description: move.description
          }
        });

        if (softMatch) {
          await prisma.bankMove.update({
            where: { id: softMatch.id },
            data: { isPossibleDuplicate: true }
          });
          duplicateCount += 1;
          continue;
        }

        await prisma.bankMove.create({
          data: {
            companyId: session.companyId,
            bankStatementId: statement.id,
            bankAccountId: statement.bankAccountId,
            source: BankMoveSource.file_import,
            date: move.date,
            postedDate: move.postedDate,
            operationDate: move.operationDate ?? null,
            type: move.type,
            originalAmount: move.amount,
            originalCurrency: statement.currency,
            convertedAmount: Math.round(move.amount * effectiveRate * 100) / 100,
            companyCurrency: baseCurrency,
            exchangeRate: effectiveRate,
            exchangeRateDate: parsed.data.exchangeRateDate ? parseDateOnly(parsed.data.exchangeRateDate) : null,
            description: move.description,
            descriptionNormalized: move.descriptionNormalized,
            rawDescription: move.description,
            merchantName: move.merchantName,
            merchantDocument: move.merchantDocument,
            bankRef: move.bankRef,
            balanceAfter: move.balanceAfter,
            reconciliationStatus: ReconciliationStatus.unreconciled,
            isPossibleDuplicate: false
          }
        });
        importedCount += 1;
      } catch (error) {
        console.error('BankMove insert error:', error);
        errorCount += 1;
      }
    }

    await prisma.bankStatement.update({
      where: { id: statement.id },
      data: {
        status: 'completed',
        totalMoves: importedCount,
        totalDuplicates: duplicateCount,
        totalErrors: errorCount,
        periodStart: periodStart ?? new Date(),
        periodEnd: periodEnd ?? new Date(),
        importMappingId: mappingIdToPersist
      }
    });

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'import',
      entityType: 'bank_statement',
      entityId: statement.id,
      afterData: {
        filename: statement.filename,
        imported: importedCount,
        duplicates: duplicateCount,
        errors: errorCount
      },
      request
    });

    return NextResponse.json({
      imported: importedCount,
      duplicates: duplicateCount,
      errors: errorCount,
      warnings,
      statementId: statement.id
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro no processamento';
    await prisma.bankStatement.update({
      where: { id: statement.id },
      data: { status: 'error', errorMessage: message }
    });
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
