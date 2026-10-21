import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { formatDate } from '../../lib/formatters';
import { sdrPortalApi } from '../../lib/sdrPortalApi';
import type { OutboundImportBatch } from '../../types/sdrPortal';

interface OutboundImportsDeleteModalProps {
  onClose: () => void;
  onDeleted: (fileName: string, deletedLeads: number) => void;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Exclusão de uma importação Outbound: o usuário escolhe o arquivo importado
 * e o backend apaga as oportunidades criadas por ele e seus registros na
 * blacklist (que voltam a vir marcados numa nova importação).
 */
export function OutboundImportsDeleteModal({ onClose, onDeleted }: OutboundImportsDeleteModalProps) {
  const [imports, setImports] = useState<OutboundImportBatch[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sdrPortalApi
      .listOutboundImports()
      .then(setImports)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Não foi possível carregar as importações.'),
      );
  }, []);

  const selected = imports?.find((item) => item.id === selectedId) ?? null;

  async function handleDelete() {
    if (!selected) return;
    setIsDeleting(true);
    setError(null);
    try {
      const result = await sdrPortalApi.removeOutboundImport(selected.id);
      onDeleted(selected.fileName, result.deletedLeads);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a importação.');
      setIsConfirming(false);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mobile-modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="outbound-imports-delete-title"
        className="mobile-modal-panel flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-6">
          <div>
            <h2
              id="outbound-imports-delete-title"
              className="font-heading text-xl font-bold text-slate-900"
            >
              Excluir importação Outbound
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Escolha o arquivo importado. Serão excluídas apenas as oportunidades criadas por ele.
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {!imports && !error && <p className="p-6 text-sm text-slate-500">Carregando…</p>}
          {imports?.length === 0 && (
            <p className="p-6 text-sm text-slate-500">Nenhum arquivo importado.</p>
          )}
          {imports && imports.length > 0 && (
            <table className="data-table">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="w-10" />
                  <th>Arquivo</th>
                  <th>Importado em</th>
                  <th>Por</th>
                  <th className="text-right">Oportunidades</th>
                  <th className="text-right">Registros</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedId(item.id);
                      setIsConfirming(false);
                    }}
                  >
                    <td>
                      <input
                        type="radio"
                        name="outbound-import"
                        aria-label={`Selecionar ${item.fileName}`}
                        checked={item.id === selectedId}
                        onChange={() => {
                          setSelectedId(item.id);
                          setIsConfirming(false);
                        }}
                      />
                    </td>
                    <td className="font-semibold text-slate-700">{item.fileName}</td>
                    <td className="text-sm text-slate-500">
                      {formatDate(item.createdAt)} {formatTime(item.createdAt)}
                    </td>
                    <td className="text-sm text-slate-500">{item.createdByName ?? '—'}</td>
                    <td className="text-right">{item.leadCount}</td>
                    <td className="text-right text-slate-500">{item.recordCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected && isConfirming && (
          <div className="border-t border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">
            Excluir definitivamente <strong>{selected.leadCount}</strong> oportunidade(s) do arquivo{' '}
            <strong>{selected.fileName}</strong>? Os {selected.recordCount} registro(s) saem da
            blacklist e poderão ser importados de novo. Esta ação não pode ser desfeita.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-6">
          <p className="text-xs text-slate-400">
            Empresas e contatos cadastrados na importação são mantidos.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isDeleting}>
              Cancelar
            </button>
            {isConfirming ? (
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Excluindo…' : 'Confirmar exclusão'}
              </button>
            ) : (
              <button
                type="button"
                className="btn-danger"
                onClick={() => setIsConfirming(true)}
                disabled={!selected}
              >
                <Icon name="trash" className="h-4 w-4" />
                Excluir importação
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
