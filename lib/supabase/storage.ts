import { createHash } from 'crypto';
import { ATTACHMENTS_BUCKET } from '@/lib/supabase/buckets';
import { createClient } from '@/lib/supabase/server';

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

export interface UploadResult {
  storagePath: string;
  fileUrl: string;
  checksum: string;
}

export function createAttachmentChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function sanitizeAttachmentFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function buildAttachmentPath(companyId: string, entityType: string, entityId: string, filename: string, timestamp = Date.now()) {
  return `${companyId}/${entityType}/${entityId}/${timestamp}-${sanitizeAttachmentFilename(filename)}`;
}

export async function uploadAttachment(
  companyId: string,
  entityType: string,
  entityId: string,
  file: File,
  buffer: Buffer
): Promise<UploadResult> {
  const supabase = createClient();
  const checksum = createAttachmentChecksum(buffer);
  const storagePath = buildAttachmentPath(companyId, entityType, entityId, file.name);

  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false
  });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return {
    storagePath,
    fileUrl: await getSignedUrl(storagePath),
    checksum
  };
}

export async function getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(storagePath, expiresIn);

  if (error) throw new Error(`Storage signed URL failed: ${error.message}`);
  return data?.signedUrl ?? '';
}

export async function deleteFromStorage(storagePath: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);

  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
