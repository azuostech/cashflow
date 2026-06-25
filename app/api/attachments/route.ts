import { AttachmentEntityType, FileType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { getSignedUrl, MAX_ATTACHMENT_SIZE_BYTES, uploadAttachment } from '@/lib/supabase/storage';
import { createAuditLog } from '@/lib/utils/audit';

export const runtime = 'nodejs';

const ALLOWED_ENTITY_TYPES = new Set<AttachmentEntityType>([
  AttachmentEntityType.transaction,
  AttachmentEntityType.installment,
  AttachmentEntityType.bank_move,
  AttachmentEntityType.bank_statement,
  AttachmentEntityType.contact,
  AttachmentEntityType.reconciliation
]);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv'
]);

const FILE_TYPE_BY_MIME: Record<string, FileType> = {
  'application/pdf': FileType.invoice,
  'image/jpeg': FileType.receipt,
  'image/png': FileType.receipt,
  'image/webp': FileType.receipt,
  'text/csv': FileType.bank_statement,
  'text/plain': FileType.other,
  'application/vnd.ms-excel': FileType.bank_statement,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileType.bank_statement
};

function isAttachmentEntityType(value: string | null): value is AttachmentEntityType {
  return !!value && Object.values(AttachmentEntityType).includes(value as AttachmentEntityType);
}

async function entityExists(entityType: AttachmentEntityType, entityId: string, companyId: string): Promise<boolean> {
  switch (entityType) {
    case AttachmentEntityType.transaction:
      return (await prisma.transaction.count({ where: { id: entityId, companyId, deletedAt: null } })) > 0;
    case AttachmentEntityType.installment:
      return (await prisma.installment.count({ where: { id: entityId, companyId } })) > 0;
    case AttachmentEntityType.bank_move:
      return (await prisma.bankMove.count({ where: { id: entityId, companyId } })) > 0;
    case AttachmentEntityType.bank_statement:
      return (await prisma.bankStatement.count({ where: { id: entityId, companyId } })) > 0;
    case AttachmentEntityType.contact:
      return (await prisma.contact.count({ where: { id: entityId, companyId, active: true } })) > 0;
    case AttachmentEntityType.reconciliation:
      return (await prisma.reconciliation.count({ where: { id: entityId, companyId } })) > 0;
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const entityType = formData.get('entityType') as string | null;
  const entityId = formData.get('entityId') as string | null;

  if (!file || !entityType || !entityId) {
    return NextResponse.json({ error: 'file, entityType e entityId sao obrigatorios' }, { status: 400 });
  }

  if (!isAttachmentEntityType(entityType) || !ALLOWED_ENTITY_TYPES.has(entityType)) {
    return NextResponse.json({ error: 'entityType invalido' }, { status: 400 });
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return NextResponse.json({ error: 'Arquivo excede o limite de 10 MB' }, { status: 413 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Tipo de arquivo nao permitido' }, { status: 422 });
  }

  const exists = await entityExists(entityType, entityId, session.companyId);
  if (!exists) return NextResponse.json({ error: 'Entidade nao encontrada' }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let uploadResult;

  try {
    uploadResult = await uploadAttachment(session.companyId, entityType, entityId, file, buffer);
  } catch (error) {
    const exception = error as Error;
    return NextResponse.json({ error: exception.message }, { status: 500 });
  }

  const attachment = await prisma.attachment.create({
    data: {
      companyId: session.companyId,
      entityType,
      entityId,
      filename: file.name,
      storagePath: uploadResult.storagePath,
      fileUrl: uploadResult.fileUrl,
      fileType: FILE_TYPE_BY_MIME[file.type] ?? FileType.other,
      mimeType: file.type,
      sizeBytes: file.size,
      checksum: uploadResult.checksum,
      aiReadable: file.type === 'application/pdf' || file.type.startsWith('image/'),
      aiProcessed: false,
      uploadedById: session.userId,
      active: true
    }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'create',
    entityType: 'attachment',
    entityId: attachment.id,
    afterData: { filename: file.name, entityType, entityId, sizeBytes: file.size },
    request
  });

  return NextResponse.json(attachment, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');

  if (!isAttachmentEntityType(entityType)) {
    return NextResponse.json({ error: 'entityType invalido' }, { status: 400 });
  }

  if (!entityId) return NextResponse.json({ error: 'entityId obrigatorio' }, { status: 400 });

  const attachments = await prisma.attachment.findMany({
    where: {
      companyId: session.companyId,
      entityType,
      entityId,
      active: true
    },
    orderBy: { uploadedAt: 'desc' }
  });

  const withSignedUrls = await Promise.all(
    attachments.map(async (attachment) => ({
      ...attachment,
      fileUrl: await getSignedUrl(attachment.storagePath).catch(() => attachment.fileUrl)
    }))
  );

  return NextResponse.json(withSignedUrls);
}
