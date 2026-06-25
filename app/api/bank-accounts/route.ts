import { BankAccountType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { createBankAccountSchema } from '@/lib/validations/bank-account.schema';

export async function POST(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const body = await request.json();
  const parsed = createBankAccountSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  const account = await prisma.bankAccount.create({
    data: {
      companyId: session.companyId,
      name: data.name,
      type: data.type as BankAccountType,
      currency: data.currency,
      bankProviderId: data.bankProviderId ?? null,
      bankName: data.bankName ?? null,
      agency: data.agency ?? null,
      accountNumber: data.accountNumber ?? null,
      initialBalance: data.initialBalance,
      initialBalanceDate: new Date(data.initialBalanceDate),
      color: data.color ?? null,
      includeInConsolidatedCashflow: data.includeInConsolidatedCashflow ?? true,
      active: true
    }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'create',
    entityType: 'bank_account',
    entityId: account.id,
    afterData: { name: account.name, type: account.type, currency: account.currency },
    request
  });

  return NextResponse.json(account, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const activeParam = searchParams.get('active');

  const accounts = await prisma.bankAccount.findMany({
    where: {
      companyId: session.companyId,
      ...(activeParam === 'all' ? {} : { active: true })
    },
    include: { bankProvider: { select: { id: true, name: true, supportedFormats: true } } },
    orderBy: { createdAt: 'asc' }
  });

  return NextResponse.json(accounts);
}
