import { FileText } from 'lucide-react';

export function UploadPreview({ file }: { file: File | null }) {
  if (!file) return null;

  return (
    <div className="mt-4 flex items-center gap-3 rounded-lg border border-app-border bg-app-muted p-3">
      <FileText className="h-5 w-5 text-secondary" />
      <div>
        <p className="text-sm font-medium">{file.name}</p>
        <p className="text-xs text-app-subtle">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
      </div>
    </div>
  );
}
