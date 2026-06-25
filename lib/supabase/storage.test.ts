import { describe, expect, it } from 'vitest';
import {
  buildAttachmentPath,
  createAttachmentChecksum,
  MAX_ATTACHMENT_SIZE_BYTES,
  sanitizeAttachmentFilename
} from './storage';

describe('attachment storage helpers', () => {
  it('gera checksum sha256 do arquivo', () => {
    const checksum = createAttachmentChecksum(Buffer.from('cashflowai'));

    expect(checksum).toHaveLength(64);
    expect(checksum).toBe('157acf5e45f6344639d3e8510ab96ac09db73cf2ddd4a3f28706f52a6306c2a6');
  });

  it('normaliza nomes inseguros antes de montar o path', () => {
    expect(sanitizeAttachmentFilename('nota fiscal 01?.pdf')).toBe('nota_fiscal_01_.pdf');
  });

  it('monta path tenant-aware no bucket privado', () => {
    const path = buildAttachmentPath('company-1', 'transaction', 'tx-1', 'nota fiscal.pdf', 1710000000000);

    expect(path).toBe('company-1/transaction/tx-1/1710000000000-nota_fiscal.pdf');
  });

  it('limita anexos a 10MB', () => {
    expect(MAX_ATTACHMENT_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});
