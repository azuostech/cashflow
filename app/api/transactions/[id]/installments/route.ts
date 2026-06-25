import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const transaction = await prisma.transaction.findFirst({
    where: { id: params.id, companyId: session.companyId, deletedAt: null }
  });

  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const installments = await prisma.installment.findMany({
    where: { transactionId: params.id, companyId: session.companyId },
    include: {
      bankAccount: { select: { id: true, name: true, currency: true } },
      category: { select: { id: true, name: true, color: true, type: true } },
      costCenter: { select: { id: true, name: true } }
    },
    orderBy: { number: 'asc' }
  });

  return NextResponse.json(installments);
}
