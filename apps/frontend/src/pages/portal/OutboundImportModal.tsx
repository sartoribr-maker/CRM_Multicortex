import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Icon } from '../../components/Icon';
import { sdrPortalApi } from '../../lib/sdrPortalApi';
import type {
  OutboundImportResult,
  OutboundImportRow,
  OutboundImportUser,
} from '../../types/sdrPortal';

interface OutboundImportModalProps {
  onClose: () => void;
  onImported: (result: OutboundImportResult) => void;
}

const BADGE = 'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase';

/** Sem empresa, sem contato ou repetidas no arquivo nunca são importadas. */
function isValid(row: OutboundImportRow): boolean {
  return row.key !== null && !row.duplicate && !row.invalidReason;
}

function RowStatus({ row }: { row: OutboundImportRow }) {
  if (row.invalidReason) {
    return <span className={`${BADGE} bg-red-50 text-red-600`}>{row.invalidReason}</span>;
  }
  if (row.duplicate) {
    return <span className={`${BADGE} bg-amber-50 text-amber-700`}>Repetido no arquivo</span>;
  }
  if (row.blacklisted) {
    return <span className={`${BADGE} bg-slate-100 text-slate-600`}>Na blacklist</span>;
  }
  return <span className={`${BADGE} bg-emerald-50 text-emerald-700`}>Novo</span>;
}

function OwnerSelect({
  users,
  value,
  onChange,
  placeholder,
  label,
}: {
  users: OutboundImportUser[];
  value: string;
  onChange: (userId: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <select
      className="form-control !py-1.5 text-sm"
      value={value}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.name} ({user.email})
        </option>
      ))}
    </select>
  );
}

/**
 * Importação de leads Outbound por planilha: lista os registros para o SDR
 * desmarcar o que não deve virar oportunidade. O responsável vem do e-mail da
 * coluna "SDR responsável"; os não encontrados são resolvidos numa lista à
 * parte (escolher um SDR ou retirar da importação). Na confirmação, todos os
 * registros listados (marcados ou não) vão para a blacklist.
 */
export function OutboundImportModal({ onClose, onImported }: OutboundImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<OutboundImportRow[] | null>(null);
  const [sdrUsers, setSdrUsers] = useState<OutboundImportUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Responsável escolhido para registros sem SDR encontrado (chave → usuário). */
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'all' | 'unassigned'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usersById = useMemo(() => new Map(sdrUsers.map((user) => [user.id, user])), [sdrUsers]);
  const visibleRows = useMemo(
    () => (rows ?? []).filter((row) => !row.key || !excluded.has(row.key)),
    [rows, excluded],
  );
  const ownerOf = (row: OutboundImportRow) =>
    row.ownerId ?? (row.key ? (overrides[row.key] ?? null) : null);
  const isSelectable = (row: OutboundImportRow) => isValid(row) && ownerOf(row) !== null;

  const selectableKeys = visibleRows.filter(isSelectable).map((row) => row.key!);
  const selectedCount = selectableKeys.filter((key) => selected.has(key)).length;
  const allSelected = selectableKeys.length > 0 && selectedCount === selectableKeys.length;
  /** Registros válidos cujo SDR não foi encontrado: a lista de resolução. */
  const unassignedRows = visibleRows.filter((row) => isValid(row) && !row.ownerId);
  const pendingCount = unassignedRows.filter((row) => !overrides[row.key!]).length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = selectedCount > 0 && !allSelected;
    }
  }, [selectedCount, allSelected]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    setIsLoading(true);
    setError(null);
    try {
      const preview = await sdrPortalApi.previewOutboundImport(chosen);
      setFile(chosen);
      setRows(preview.rows);
      setSdrUsers(preview.sdrUsers);
      setSelected(new Set(preview.rows.filter((row) => row.selected).map((row) => row.key!)));
      setOverrides({});
      setExcluded(new Set());
      setView('all');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler a planilha.');
    } finally {
      setIsLoading(false);
    }
  }

  function toggleRow(key: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  /** Ao receber um responsável, o registro é marcado, salvo se estiver na blacklist. */
  function assignOwner(targets: OutboundImportRow[], userId: string) {
    setOverrides((current) => {
      const next = { ...current };
      for (const row of targets) {
        if (userId) next[row.key!] = userId;
        else delete next[row.key!];
      }
      return next;
    });
    setSelected((current) => {
      const next = new Set(current);
      for (const row of targets) {
        if (userId && !row.blacklisted) next.add(row.key!);
        if (!userId) next.delete(row.key!);
      }
      return next;
    });
  }

  function excludeRow(row: OutboundImportRow) {
    setExcluded((current) => new Set(current).add(row.key!));
    toggleRow(row.key!, false);
  }

  async function handleImport() {
    if (!file || !rows) return;
    setIsImporting(true);
    setError(null);
    try {
      onImported(
        await sdrPortalApi.importOutbound(file, {
          selectedKeys: selectableKeys.filter((key) => selected.has(key)),
          ownerOverrides: Object.fromEntries(
            unassignedRows.flatMap((row) =>
              overrides[row.key!] ? [[row.key!, overrides[row.key!]]] : [],
            ),
          ),
          excludedKeys: [...excluded],
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível importar os leads.');
      setIsImporting(false);
    }
  }

  const blacklistedCount = visibleRows.filter((row) => row.blacklisted).length;

  return (
    <div className="mobile-modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="outbound-import-title"
        className="mobile-modal-panel flex max-h-[92vh] w-full max-w-7xl flex-col rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-6">
          <div>
            <h2 id="outbound-import-title" className="font-heading text-xl font-bold text-slate-900">
              {view === 'unassigned' ? 'Registros sem responsável' : 'Importar leads Outbound'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {view === 'unassigned'
                ? 'O e-mail da coluna "SDR responsável" não corresponde a nenhum usuário. Escolha um SDR ou exclua o registro da importação; os que ficarem sem responsável não serão importados.'
                : rows && file
                  ? `${file.name} · ${visibleRows.length} registro(s) · ${selectedCount} marcado(s) para importar${
                      blacklistedCount ? ` · ${blacklistedCount} já na blacklist (desmarcados)` : ''
                    }`
                  : 'Selecione a planilha .xlsx com os contatos prospectados.'}
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

        {!rows && (
          <div className="p-6">
            <button
              type="button"
              className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-10 text-sm text-slate-500 transition hover:border-brand-purple hover:text-brand-purple"
              onClick={() => inputRef.current?.click()}
              disabled={isLoading}
            >
              <Icon name="upload" className="h-8 w-8" />
              {isLoading ? 'Lendo a planilha…' : 'Clique para escolher a planilha'}
            </button>
          </div>
        )}

        {rows && view === 'all' && (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="data-table min-w-[1100px]">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="w-10">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      aria-label="Marcar ou desmarcar todos"
                      checked={allSelected}
                      disabled={selectableKeys.length === 0}
                      onChange={(event) =>
                        setSelected(event.target.checked ? new Set(selectableKeys) : new Set())
                      }
                    />
                  </th>
                  <th>Linha</th>
                  <th>Contato</th>
                  <th>Empresa</th>
                  <th>Responsável</th>
                  <th>Aderência</th>
                  <th>Porte</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const selectable = isSelectable(row);
                  const checked = selectable && selected.has(row.key!);
                  const ownerId = ownerOf(row);
                  return (
                    <tr
                      key={row.rowNumber}
                      className={checked ? '' : 'opacity-60'}
                      onClick={() => selectable && toggleRow(row.key!, !checked)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Importar ${row.contactName ?? 'registro'}`}
                          checked={checked}
                          disabled={!selectable}
                          title={
                            isValid(row) && !ownerId
                              ? 'Sem responsável: defina um SDR para importar'
                              : undefined
                          }
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => toggleRow(row.key!, event.target.checked)}
                        />
                      </td>
                      <td className="text-xs text-slate-400">{row.rowNumber}</td>
                      <td>
                        <span className="block font-semibold text-slate-700">
                          {row.contactName ?? '—'}
                        </span>
                        <span
                          className="block max-w-xs truncate text-xs text-slate-400"
                          title={row.contactPosition ?? undefined}
                        >
                          {row.contactPosition ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span className="block font-semibold text-slate-700">
                          {row.companyName ?? '—'}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {row.companyLocation ?? '—'}
                        </span>
                      </td>
                      <td>
                        {row.ownerName ? (
                          row.ownerName
                        ) : ownerId ? (
                          <>
                            <span className="block">{usersById.get(ownerId)?.name}</span>
                            <span className="block text-xs text-slate-400">definido na importação</span>
                          </>
                        ) : (
                          <>
                            <span className="block font-semibold text-red-600">Sem responsável</span>
                            <span className="block text-xs text-slate-400">
                              Planilha: {row.sdrName ?? 'não informado'}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {row.adherence ?? '—'}
                        {row.successProbability !== null && (
                          <span className="ml-1 text-xs text-slate-400">
                            ({row.successProbability}%)
                          </span>
                        )}
                      </td>
                      <td className="text-xs">{row.companySizeEstimate ?? '—'}</td>
                      <td className="whitespace-nowrap">
                        <RowStatus row={row} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {rows && view === 'unassigned' && (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-6 py-3">
              <span className="text-sm font-semibold text-slate-600">Aplicar a todos sem responsável:</span>
              <div className="w-80">
                <OwnerSelect
                  users={sdrUsers}
                  value=""
                  label="Responsável para todos os registros pendentes"
                  placeholder="Escolha um SDR…"
                  onChange={(userId) =>
                    userId &&
                    assignOwner(
                      unassignedRows.filter((row) => !overrides[row.key!]),
                      userId,
                    )
                  }
                />
              </div>
              {sdrUsers.length === 0 && (
                <span className="text-xs text-red-600">Nenhum usuário ativo com perfil SDR.</span>
              )}
            </div>
            {unassignedRows.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">Todos os registros têm responsável.</p>
            ) : (
              <table className="data-table min-w-[900px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th>Linha</th>
                    <th>Contato</th>
                    <th>Empresa</th>
                    <th>SDR na planilha</th>
                    <th className="w-80">Responsável</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {unassignedRows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="text-xs text-slate-400">{row.rowNumber}</td>
                      <td>
                        <span className="block font-semibold text-slate-700">{row.contactName}</span>
                        <span className="block max-w-xs truncate text-xs text-slate-400">
                          {row.contactPosition ?? '—'}
                        </span>
                      </td>
                      <td className="font-semibold text-slate-700">{row.companyName}</td>
                      <td className="text-xs text-slate-500">{row.sdrName ?? 'não informado'}</td>
                      <td>
                        <OwnerSelect
                          users={sdrUsers}
                          value={overrides[row.key!] ?? ''}
                          label={`Responsável por ${row.contactName}`}
                          placeholder="Sem responsável (não importa)"
                          onChange={(userId) => assignOwner([row], userId)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary !px-3 !py-1.5 text-xs text-red-600"
                          onClick={() => excludeRow(row)}
                        >
                          <Icon name="trash" className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {rows && pendingCount > 0 && view === 'all' && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-100 bg-amber-50 px-6 py-3 text-sm text-amber-800">
            <span>
              <strong>{pendingCount}</strong> registro(s) sem responsável relacionado. Eles não
              serão importados até que um SDR seja definido.
            </span>
            <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => setView('unassigned')}>
              Definir responsáveis
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-6">
          <p className="text-xs text-slate-400">
            {view === 'unassigned'
              ? `${pendingCount} pendente(s) · ${excluded.size} excluído(s) da importação (não vão para a blacklist).`
              : rows
                ? 'Os marcados entram na etapa "Leads" e cada responsável recebe um e-mail. Todos os registros listados (marcados ou não) vão para a blacklist e virão desmarcados nas próximas importações.'
                : 'Colunas esperadas: SDR responsável (e-mail), Nome, Cargo, Empresa, Localização, Aderência ao cargo-alvo…'}
          </p>
          <div className="flex gap-2">
            {view === 'unassigned' ? (
              <button type="button" className="btn-primary" onClick={() => setView('all')}>
                Voltar à lista
              </button>
            ) : (
              <>
                {rows && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => inputRef.current?.click()}
                    disabled={isLoading || isImporting}
                  >
                    Trocar arquivo
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={onClose} disabled={isImporting}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleImport}
                  disabled={!rows || isLoading || isImporting}
                >
                  {isImporting ? 'Importando…' : `Importar (${selectedCount})`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
