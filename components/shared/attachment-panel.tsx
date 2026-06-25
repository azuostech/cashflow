'use client';

import { useRef, useState } from 'react';
import { FileArchive, FileImage, FileSpreadsheet, FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { cn } from '@/lib/utils/cn';

interface Attachment {
  id: string;
  filename: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
}

interface AttachmentPanelProps {
  entityType: string;
  entityId: string;
  readOnly?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <FileImage className="h-4 w-4 text-blue-500" />;
  if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
  }
  return <FileArchive className="h-4 w-4 text-gray-400" />;
}

export function AttachmentPanel({ entityType, entityId, readOnly = false }: AttachmentPanelProps) {
  const { data: attachments, refetch } = useFetch<Attachment[]>(
    entityId ? `/api/attachments?entityType=${entityType}&entityId=${entityId}` : null
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const list = attachments ?? [];

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;

    setUploading(true);
    setError('');

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name}: excede 10 MB`);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);

      const response = await fetch('/api/attachments', { method: 'POST', body: formData });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? 'Erro no upload');
      }
    }

    if (inputRef.current) inputRef.current.value = '';
    await refetch();
    setUploading(false);
  }

  async function handleDelete(id: string, filename: string) {
    if (!window.confirm(`Excluir anexo "${filename}"?`)) return;

    const response = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Erro ao excluir anexo');
      return;
    }

    await refetch();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          <Paperclip className="h-4 w-4" />
          Anexos {list.length > 0 ? `(${list.length})` : ''}
        </span>
        {!readOnly ? (
          <button
            type="button"
            disabled={uploading}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Enviando...' : 'Adicionar'}
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xlsx,.xls,.txt"
        className="hidden"
        onChange={(event) => void handleUpload(event.target.files)}
      />

      {!readOnly && list.length === 0 ? (
        <button
          type="button"
          className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-white p-5 text-center text-xs text-gray-400 transition hover:border-emerald-300 hover:text-emerald-600"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleUpload(event.dataTransfer.files);
          }}
        >
          <Upload className="mb-2 h-5 w-5" />
          Arraste arquivos ou clique para anexar
          <span className="mt-1 text-gray-300">PDF, imagens, planilhas e texto, max. 10 MB</span>
        </button>
      ) : null}

      {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}

      {list.length > 0 ? (
        <ul className="space-y-2">
          {list.map((attachment) => (
            <li key={attachment.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
              <AttachmentIcon mimeType={attachment.mimeType} />
              <div className="min-w-0 flex-1">
                <a
                  href={attachment.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs font-medium text-gray-800 hover:text-emerald-600"
                >
                  {attachment.filename}
                </a>
                <span className="text-xs text-gray-400">{formatBytes(attachment.sizeBytes)}</span>
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-500"
                  onClick={() => void handleDelete(attachment.id, attachment.filename)}
                  aria-label="Excluir anexo"
                  title="Excluir anexo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!readOnly && list.length > 0 ? (
        <button
          type="button"
          disabled={uploading}
          className={cn('mt-3 text-xs font-medium text-gray-400 hover:text-emerald-600', uploading && 'opacity-50')}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleUpload(event.dataTransfer.files);
          }}
        >
          {uploading ? 'Enviando...' : 'Adicionar mais anexos'}
        </button>
      ) : null}
    </div>
  );
}
