import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { leadsApi, type LeadListFilters } from '../../lib/leadsApi';
import { stagesApi, prioritiesApi, dealSizesApi, sourcesApi, projectTypesApi } from '../../lib/settingsApi';
import { usersApi, type UserOption } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
import type { LeadListItem } from '../../types/leads';
import type { DealSize, Priority, ProjectType, Source, Stage } from '../../types/settings';

const selectClass =
  'rounded-card border border-surface-muted bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple';

function formatCurrency(value: string | number | null): string {
  if (value === null) return '—';
  const num = typeof value === 'string' ? Number(value) : value;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function daysSince(dateString: string): number {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
}

export default function LeadsListPage() {
  const user = useAuthStore((s) => s.user);
  const canViewAll = user?.permissions.includes('leads.view.all') ?? false;
  const canCreate = user?.permissions.includes('leads.create') ?? false;
  const navigate = useNavigate();

  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LeadListFilters>({ page: 1, pageSize: 20 });

  const [stages, setStages] = useState<Stage[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [dealSizes, setDealSizes] = useState<DealSize[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    stagesApi.list().then(setStages);
    prioritiesApi.list().then(setPriorities);
    dealSizesApi.list().then(setDealSizes);
    sourcesApi.list().then(setSources);
    projectTypesApi.list().then(setProjectTypes);
    if (canViewAll) usersApi.list().then(setUsers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setIsLoading(true);
    leadsApi
      .list(filters)
      .then((res) => {
        setLeads(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar leads.'))
      .finally(() => setIsLoading(false));
  }, [filters]);

  function updateFilter(patch: Partial<LeadListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="flex items-center justify-between bg-brand-purple-dark px-6 py-4 text-white">
        <img src={logo} alt="Multicortex" className="h-8" />
        <Link
          to="/"
          className="rounded-card border border-white/30 px-3 py-1.5 text-sm transition hover:bg-white/10"
        >
          Voltar
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-brand-purple-dark">Leads</h1>
            <p className="mt-1 text-sm text-ink/70">{total} lead(s) encontrado(s).</p>
          </div>
          {canCreate && (
            <button
              onClick={() => navigate('/leads/novo')}
              className="rounded-card bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark"
            >
              + Novo Lead
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            placeholder="Buscar por nome, empresa ou contato…"
            className={`${selectClass} min-w-[240px] flex-1`}
            onChange={(e) => updateFilter({ search: e.target.value || undefined })}
          />
          <select className={selectClass} onChange={(e) => updateFilter({ stageId: e.target.value || undefined })}>
            <option value="">Etapa</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            onChange={(e) => updateFilter({ priorityId: e.target.value || undefined })}
          >
            <option value="">Prioridade</option>
            {priorities.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            onChange={(e) => updateFilter({ dealSizeId: e.target.value || undefined })}
          >
            <option value="">Porte</option>
            {dealSizes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select className={selectClass} onChange={(e) => updateFilter({ sourceId: e.target.value || undefined })}>
            <option value="">Origem</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            onChange={(e) => updateFilter({ projectTypeId: e.target.value || undefined })}
          >
            <option value="">Tipo de Projeto</option>
            {projectTypes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {canViewAll && (
            <select className={selectClass} onChange={(e) => updateFilter({ ownerId: e.target.value || undefined })}>
              <option value="">Responsável</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="mt-4 overflow-x-auto rounded-card bg-surface shadow-sm">
          {isLoading ? (
            <p className="p-6 text-sm text-ink/60">Carregando…</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-surface-muted text-xs uppercase text-ink/50">
                <tr>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Etapa</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Dias na etapa</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="cursor-pointer border-b border-surface-muted last:border-0 hover:bg-surface-muted"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{lead.name}</p>
                      {lead.companyName && <p className="text-xs text-ink/60">{lead.companyName}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: lead.stage.color }}
                      >
                        {lead.stage.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.priority && (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: lead.priority.color }}
                          />
                          {lead.priority.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink/80">{formatCurrency(lead.estimatedValue)}</td>
                    <td className="px-4 py-3 text-ink/80">{lead.owner.name}</td>
                    <td className="px-4 py-3 text-ink/60">{daysSince(lead.stageEnteredAt)}</td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-ink/50">
                      Nenhum lead encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
