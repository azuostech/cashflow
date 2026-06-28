import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { STATEMENTS_BUCKET } from '@/lib/supabase/buckets';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/lib/utils/audit';

class StatementHasActiveReconciliationsError extends Error {
  constructor(readonly activeReconciliations: number) {
    super('Este extrato possui movimentos conciliados. Desfaca as conciliacoes antes de excluir o arquivo.');
  }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const statement = await prisma.bankStatement.findFirst({
    where: { id: params.id, companyId: session.companyId },
    include: {
      bankAccount: {
        select: {
          id: true,
          name: true,
          currency: true,
          bankProvider: { select: { id: true, name: true } }
        }
      },
      importMapping: { select: { id: true, name: true } },
      bankMoves: {
        orderBy: { date: 'asc' },
        take: 200,
        select: {
          id: true,
          date: true,
          type: true,
          description: true,
          originalAmount: true,
          originalCurrency: true,
          reconciliationStatus: true,
          isPossibleDuplicate: true,
          merchantName: true
        }
      },
      _count: { select: { bankMoves: true } }
    }
  });

  if (!statement) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(statement);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const statement = await prisma.bankStatement.findFirst({
    where: { id: params.id, companyId: session.companyId },
    select: {
      id: true,
      filename: true,
      rawFileUrl: true,
      totalMoves: true,
      totalDuplicates: true,
      totalErrors: true,
      status: true
    }
  });

  if (!statement) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (statement.status === 'processing') {
    return NextResponse.json({ error: 'Extrato em processamento. Tente novamente em alguns instantes.' }, { status: 409 });
  }

  try {
    const deleted = await prisma.$transaction(async (database) => {
      const activeReconciliations = await database.reconciliation.count({
        where: {
          status: 'active',
          bankMove: {
            companyId: session.companyId,
            bankStatementId: statement.id
          }
        }
      });

      if (activeReconciliations > 0) {
        throw new StatementHasActiveReconciliationsError(activeReconciliations);
      }

      await database.reconciliationSuggestion.deleteMany({
        where: {
          companyId: session.companyId,
          bankMove: { bankStatementId: statement.id }
        }
      });

      await database.reconciliation.deleteMany({
        where: {
          companyId: session.companyId,
          bankMove: { bankStatementId: statement.id }
        }
      });

      const deletedMoves = await database.bankMove.deleteMany({
        where: {
          companyId: session.companyId,
          bankStatementId: statement.id
        }
      });

      await database.bankStatement.delete({
        where: { id: statement.id }
      });

      return { deletedMoves: deletedMoves.count };
    });

    if (statement.rawFileUrl) {
      const supabase = createClient();
      const { error } = await supabase.storage.from(STATEMENTS_BUCKET).remove([statement.rawFileUrl]);
      if (error) {
        console.error(`Failed to delete bank statement storage object: ${statement.rawFileUrl}`, error);
      }
    }

    await createAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: 'delete',
      entityType: 'bank_statement',
      entityId: statement.id,
      beforeData: {
        filename: statement.filename,
        status: statement.status,
        totalMoves: statement.totalMoves,
        totalDuplicates: statement.totalDuplicates,
        totalErrors: statement.totalErrors,
        deletedMoves: deleted.deletedMoves
      },
      request
    });

    return NextResponse.json({ deleted: true, deletedMoves: deleted.deletedMoves });
  } catch (error) {
    if (error instanceof StatementHasActiveReconciliationsError) {
      return NextResponse.json(
        {
          error: error.message,
          activeReconciliations: error.activeReconciliations
        },
        { status: 409 }
      );
    }

    console.error('BankStatement delete error:', error);
    return NextResponse.json({ error: 'Nao foi possivel excluir o extrato.' }, { status: 500 });
  }
}
