import { FileFormat, StatementSource } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeFileHash, detectColumns } from '@/lib/parsers/csv-xlsx';
import { getSessionContext, isSessionError } from '@/lib/session';
import { STATEMENTS_BUCKET } from '@/lib/supabase/buckets';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const MAX_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTS = ['.ofx', '.csv', '.xlsx', '.xls'];

function getExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? `.${ext}` : '';
}

function getSource(ext: string): StatementSource {
  if (ext === '.ofx') return StatementSource.file_ofx;
  if (ext === '.csv') return StatementSource.file_csv;
  return StatementSource.file_xlsx;
}

function getFileFormat(ext: string): FileFormat {
  return ext === '.csv' ? FileFormat.csv : FileFormat.xlsx;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const bankAccountId = formData.get('bankAccountId') as string | null;

  if (!file || !bankAccountId) {
    return NextResponse.json({ error: 'file e bankAccountId sao obrigatorios' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Arquivo excede 50 MB' }, { status: 413 });
  }

  const ext = getExtension(file.name);
  if (!ALLOWED_EXTS.includes(ext)) {
    return NextResponse.json({ error: `Formato nao suportado: ${ext || 'desconhecido'}` }, { status: 415 });
  }

  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, companyId: session.companyId, active: true },
    include: { bankProvider: true }
  });

  if (!account) return NextResponse.json({ error: 'Conta nao encontrada' }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = computeFileHash(buffer);
  const existing = await prisma.bankStatement.findFirst({
    where: { bankAccountId, fileHash }
  });

  const retryStorageError = existing?.status === 'storage_error' ? existing : null;

  if (existing && !retryStorageError) {
    return NextResponse.json(
      {
        error: 'duplicate',
        message: 'Este arquivo ja foi importado anteriormente.',
        importedAt: existing.importedAt,
        statementId: existing.id
      },
      { status: 409 }
    );
  }

  const source = getSource(ext);
  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { baseCurrency: true }
  });

  const importMapping =
    source === StatementSource.file_ofx
      ? null
      : await prisma.importMapping.findFirst({
          where: {
            active: true,
            fileFormat: getFileFormat(ext),
            OR: [
              { companyId: session.companyId, bankProviderId: account.bankProviderId ?? undefined },
              { companyId: session.companyId, bankProviderId: null },
              { isGlobal: true, bankProviderId: account.bankProviderId ?? undefined },
              { isGlobal: true, bankProviderId: null }
            ]
          },
          orderBy: [{ isGlobal: 'asc' }, { bankProviderId: 'desc' }, { name: 'asc' }]
        });

  const storagePath = `${session.companyId}/statements/${bankAccountId}/${Date.now()}-${sanitizeFilename(file.name)}`;
  const supabase = createClient();
  const { error: uploadError } = await supabase.storage.from(STATEMENTS_BUCKET).upload(storagePath, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false
  });

  const statementData = {
    companyId: session.companyId,
    bankAccountId,
    source,
    bankProviderId: account.bankProviderId ?? null,
    importMappingId: importMapping?.id ?? null,
    filename: file.name,
    fileHash,
    rawFileUrl: storagePath,
    currency: account.currency,
    periodStart: new Date(),
    periodEnd: new Date(),
    totalMoves: 0,
    totalDuplicates: 0,
    totalErrors: 0,
    status: uploadError ? 'storage_error' : 'pending',
    errorMessage: uploadError?.message ?? null,
    importedById: session.userId
  };

  const statement = retryStorageError
    ? await prisma.bankStatement.update({
        where: { id: retryStorageError.id },
        data: { ...statementData, importedAt: new Date() }
      })
    : await prisma.bankStatement.create({
        data: statementData
      });

  let detectedColumns: string[] = [];
  if (source !== StatementSource.file_ofx) {
    try {
      detectedColumns = detectColumns(buffer, ext === '.csv' ? 'csv' : 'xlsx');
    } catch {
      detectedColumns = [];
    }
  }

  return NextResponse.json(
    {
      statementId: statement.id,
      source,
      filename: file.name,
      fileHash,
      bankAccountId,
      bankProvider: account.bankProvider?.name ?? account.bankName ?? null,
      importMapping: importMapping
        ? {
            id: importMapping.id,
            name: importMapping.name,
            dateColumn: importMapping.dateColumn,
            amountColumn: importMapping.amountColumn,
            debitColumn: importMapping.debitColumn,
            creditColumn: importMapping.creditColumn,
            descriptionColumn: importMapping.descriptionColumn,
            amountSignConvention: importMapping.amountSignConvention,
            dateFormat: importMapping.dateFormat,
            decimalSeparator: importMapping.decimalSeparator
          }
        : null,
      detectedColumns,
      needsMapping: source !== StatementSource.file_ofx && !importMapping,
      needsExchangeRate: account.currency !== (company?.baseCurrency ?? 'BRL'),
      accountCurrency: account.currency,
      storageWarning: uploadError?.message ?? null
    },
    { status: 201 }
  );
}
