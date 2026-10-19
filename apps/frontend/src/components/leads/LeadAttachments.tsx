import { ChangeEvent, useEffect, useState } from 'react';
import { leadsApi } from '../../lib/leadsApi';
import { formatDate } from '../../lib/formatters';
import type { LeadAttachment } from '../../types/leads';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeadAttachments({
  leadId,
  canUpload,
  canRemove,
  onUploaded,
}: {
  leadId: string;
  canUpload: boolean;
  canRemove: boolean;
  onUploaded?: () => void;
}) {
  const [attachments, setAttachments] = useState<LeadAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function refresh() {
    leadsApi.listAttachments(leadId).then(setAttachments);
  }

  useEffect(refresh, [leadId]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      await leadsApi.uploadAttachment(leadId, file);
      refresh();
      onUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar arquivo.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }

  async function handleRemove(attachmentId: string) {
    if (!window.confirm('Remover este anexo?')) return;
    await leadsApi.removeAttachment(leadId, attachmentId);
    refresh();
  }

  async function handleDownload(attachment: LeadAttachment) {
    await leadsApi.downloadAttachment(leadId, attachment.id, attachment.fileName);
  }

  return (
    <div>
      {canUpload && (
        <div className="mb-4">
          <label className="inline-block cursor-pointer rounded-card bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark">
            {isUploading ? 'Enviando…' : '+ Adicionar anexo'}
            <input
              type="file"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>
          <p className="mt-1 text-xs text-ink/50">
            Máximo 15MB. Imagens, PDF, Office, texto ou zip.
          </p>
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <ul className="flex flex-col gap-2">
        {attachments.map((attachment) => (
          <li
            key={attachment.id}
            className="flex items-center justify-between rounded-card border border-surface-muted p-3 text-sm"
          >
            <div>
              <p className="font-medium text-ink">{attachment.fileName}</p>
              <p className="text-xs text-ink/50">
                {formatBytes(attachment.sizeBytes)} · {formatDate(attachment.createdAt)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleDownload(attachment)}
                className="text-sm text-brand-blue hover:text-brand-blue-dark"
              >
                Baixar
              </button>
              {canRemove && (
                <button
                  onClick={() => handleRemove(attachment.id)}
                  className="text-sm text-danger hover:text-danger/80"
                >
                  Remover
                </button>
              )}
            </div>
          </li>
        ))}
        {attachments.length === 0 && <p className="text-sm text-ink/50">Nenhum anexo ainda.</p>}
      </ul>
    </div>
  );
}
