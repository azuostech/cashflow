import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { reverseTransaction } from '@/lib/transactions/domain';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  try {
    const reversal = await reverseTransaction(params.id, session.companyId, session.userId);

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'reverse',
      entityType: 'transaction',
      entityId: params.id,
      afterData: { reversalId: reversal.id, description: reversal.description },
      request
    });

    return NextResponse.json(reversal, { status: 201 });
  } catch (error) {
    const exception = error as Error & { status?: number };
    return NextResponse.json({ error: exception.message }, { status: exception.status ?? 400 });
  }
}
