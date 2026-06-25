import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { deleteFromStorage } from '@/lib/supabase/storage';
import { createAuditLog } from '@/lib/utils/audit';

export const runtime = 'nodejs';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const attachment = await prisma.attachment.findFirst({
    where: { id: params.id, companyId: session.companyId, active: true }
  });

  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.attachment.update({
    where: { id: params.id },
    data: { active: false }
  });

  try {
    await deleteFromStorage(attachment.storagePath);
  } catch (error) {
    console.error(`Failed to delete storage object: ${attachment.storagePath}`, error);
  }

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'delete',
    entityType: 'attachment',
    entityId: params.id,
    beforeData: { filename: attachment.filename, entityId: attachment.entityId },
    request
  });

  return NextResponse.json({ deleted: true });
}
