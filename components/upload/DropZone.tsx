'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function DropZone({ onFileSelected, disabled = false }: DropZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/ofx': ['.ofx'],
      'application/x-ofx': ['.ofx'],
      'text/ofx': ['.ofx'],
      'text/plain': ['.ofx']
    },
    maxFiles: 1,
    disabled
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'cursor-pointer rounded-xl border-2 border-dashed border-app-border bg-white p-8 text-center transition',
        isDragActive && 'border-primary bg-green-50',
        disabled && 'cursor-not-allowed opacity-60'
      )}
      aria-label="Area de upload do extrato"
    >
      <input {...getInputProps()} aria-label="Selecionar extrato em OFX" />
      <UploadCloud className="mx-auto mb-3 h-8 w-8 text-primary" />
      <p className="font-semibold">Arraste o OFX aqui ou clique para selecionar</p>
      <p className="text-sm text-app-subtle">Formato aceito: extrato bancario (.ofx)</p>
    </div>
  );
}
