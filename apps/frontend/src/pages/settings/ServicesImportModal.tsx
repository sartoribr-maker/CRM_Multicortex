import { useRef, useState, type ChangeEvent } from 'react';
import { Icon } from '../../components/Icon';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { servicesApi } from '../../lib/settingsApi';
import type { PricingImportPreview, PricingImportRow } from '../../types/settings';
import { PricingParameters } from './PricingParameters';

interface ServicesImportModalProps {
  onClose: () => void;
  onImported: (message: string) => void;
}

const BADGE = 'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase';

function RowStatus({ row }: { row: PricingImportRow }) {
  if (row.invalidReason) {
    return <span className={`${BADGE} bg-red-50 text-red-600`}>{row.invalidReason}</span>;
  }
  if (row.archived) {
    return <span className={`${BADGE} bg-amber-50 text-amber-700`}>Restaura arquivado</span>;
  }
  if (row.existingId) {
    return <span className={`${BADGE} bg-blue-50 text-brand-blue`}>Atualiza</span>;
  }
  return <span className={`${BADGE} bg-emerald-50 text-emerald-700`}>Novo</span>;
}

const money = (value: number | null) => (value === null ? '—' : formatCurrency(value));

/**
 * Importação da planilha de precificação: um serviço por máquina, com a
 * mensalidade como valor e licença, setups e PoC como cobranças únicas.
 * Serviços de mesmo nome são atualizados.
 */
export function ServicesImportModal({ onClose, onImported }: ServicesImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PricingImportPreview | null>(null);
  const [productName, setProductName] = useState('');
  const [projectTypeId, setProjectTypeId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  async function load(chosen: File, product?: string) {
    setIsLoading(true);
    setError(null);
    try {
      const result = await servicesApi.previewImport(chosen, { productName: product });
      setFile(chosen);
      setPreview(result);
      if (product === undefined) setActiveTab(0);
      setProductName(result.productName ?? '');
      if (product === undefined) setProjectTypeId(result.suggestedProjectTypeId ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler a planilha.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (chosen) load(chosen);
  }

  async function handleImport() {
    if (!file) return;
    setIsImporting(true);
    setError(null);
    try {
      const result = await servicesApi.import(file, {
        productName: productName.trim() || undefined,
        projectTypeId: projectTypeId || undefined,
      });
      const projectType = preview?.projectTypes.find((type) => type.id === projectTypeId);
      onImported(
        `${result.created} serviço(s) criado(s) e ${result.updated} atualizado(s)${
          projectType ? `, relacionados ao tipo de produto "${projectType.name}"` : ''
        }.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível importar a planilha.');
      setIsImporting(false);
    }
  }

  const validCount = preview?.rows.filter((row) => !row.invalidReason).length ?? 0;
  const tab = preview?.tabs[activeTab];

  return (
    <div className="mobile-modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="services-import-title"
        className="mobile-modal-panel flex max-h-[92vh] w-full max-w-7xl flex-col rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-6">
          <div>
            <h2
              id="services-import-title"
              className="font-heading text-xl font-bold text-slate-900"
            >
              Importar planilha de precificação
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {preview && file
                ? `${file.name} · ${preview.rows.length} item(ns)${
                    preview.referenceDate
                      ? ` · referência ${formatDate(preview.referenceDate)}`
                      : ''
                  }${preview.taxRate !== null ? ` · imposto ${Math.round(preview.taxRate * 100)}%` : ''}`
                : 'Um serviço por máquina: o preço final é a mensalidade; licença, setups e PoC são cobranças únicas.'}
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

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={handleFile}
        />

        {!preview ? (
          <div className="space-y-3 p-6">
            <button
              type="button"
              className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-10 text-sm text-slate-500 transition hover:border-brand-purple hover:text-brand-purple"
              onClick={() => inputRef.current?.click()}
              disabled={isLoading}
            >
              <Icon name="upload" className="h-8 w-8" />
              {isLoading ? 'Lendo a planilha…' : 'Clique para escolher a planilha'}
            </button>
            <p className="text-center text-xs text-slate-400">
              Use o mesmo formato da planilha de precificação.{' '}
              <button
                type="button"
                className="font-semibold text-brand-purple hover:underline"
                onClick={() => servicesApi.downloadTemplate().catch((err) => setError(err.message))}
              >
                Baixar modelo
              </button>
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 border-b border-slate-100 px-6 py-4 md:grid-cols-2">
              <div>
                <label className="form-label">Produto (prefixo dos nomes)</label>
                <input
                  className="form-control"
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  onBlur={() =>
                    file &&
                    productName.trim() !== (preview.productName ?? '') &&
                    load(file, productName.trim())
                  }
                  placeholder="Ex.: DevCore"
                />
              </div>
              <div>
                <label className="form-label">Relacionar ao tipo de produto</label>
                <select
                  className="form-control"
                  value={projectTypeId}
                  onChange={(event) => setProjectTypeId(event.target.value)}
                >
                  <option value="">Não relacionar</option>
                  {preview.projectTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {preview.tabs.length > 1 && (
              <div role="tablist" className="flex gap-1 border-b border-slate-100 px-6">
                {preview.tabs.map((tab, index) => (
                  <button
                    key={tab.name}
                    type="button"
                    role="tab"
                    aria-selected={index === activeTab}
                    onClick={() => setActiveTab(index)}
                    className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
                      index === activeTab
                        ? 'border-brand-purple text-brand-purple'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Aba “{tab.name}”
                  </button>
                ))}
              </div>
            )}
            {tab && (
              <div className="min-h-0 flex-1 space-y-4 overflow-auto px-6 py-4">
                {tab.title && <p className="text-sm font-semibold text-slate-600">{tab.title}</p>}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="data-table min-w-[900px]">
                    <thead>
                      <tr>
                        <th>Serviço</th>
                        <th>Linha</th>
                        <th>Máquina / VRAM</th>
                        {tab.columns.map((column) => (
                          <th key={column.field}>{column.header}</th>
                        ))}
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={row.name} className={row.invalidReason ? 'opacity-60' : ''}>
                          <td className="font-semibold text-slate-700">{row.name}</td>
                          <td>{row.tier ?? '—'}</td>
                          <td className="whitespace-nowrap">{row.hardwareSpec}</td>
                          {tab.columns.map((column) => (
                            <td key={column.field} className="whitespace-nowrap">
                              {money(row[column.field])}
                            </td>
                          ))}
                          <td className="whitespace-nowrap">
                            <RowStatus row={row} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PricingParameters parameters={tab.parameters} notes={tab.notes} />
              </div>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-6">
          <p className="text-xs text-slate-400">
            {preview
              ? `${preview.tabs.length} aba(s) lida(s); os valores de todas as abas são reunidos por máquina. Serviços com o mesmo nome são atualizados.`
              : 'Colunas esperadas: Linha, Máquina / VRAM, Preço final com imposto, Custo do hardware, Licença, Setups, PoC…'}
          </p>
          <div className="flex gap-2">
            {preview && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => inputRef.current?.click()}
                disabled={isLoading || isImporting}
              >
                Trocar arquivo
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isImporting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleImport}
              disabled={!preview || !validCount || isLoading || isImporting}
            >
              {isImporting ? 'Importando…' : `Importar (${validCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
