import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { leadsApi, type LeadListFilters } from '../../lib/leadsApi';
import {
  stagesApi,
  prioritiesApi,
  dealSizesApi,
  sourcesApi,
  projectTypesApi,
} from '../../lib/settingsApi';
import { avatarUrl, usersApi, type UserOption } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
import type { LeadListItem } from '../../types/leads';
import type { DealSize, Priority, ProjectType, Source, Stage } from '../../types/settings';

type SortKey = 'name' | 'stage' | 'priority' | 'estimatedValue' | 'owner' | 'stageEnteredAt';

function formatCurrency(value: string | number | null) {
  return value === null
    ? '—'
    : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function daysSince(value: string) {
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}

export default function LeadsListPage() {
  const user = useAuthStore((s) => s.user);
  const canViewAll = user?.permissions.includes('leads.view.all') ?? false;
  const canCreate = user?.permissions.includes('leads.create') ?? false;
  const canEdit = user?.permissions.includes('leads.edit') ?? false;
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LeadListFilters>({ page: 1, pageSize: 20 });
  const [showFilters, setShowFilters] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });
  const [stages, setStages] = useState<Stage[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [dealSizes, setDealSizes] = useState<DealSize[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    Promise.all([
      stagesApi.list(),
      prioritiesApi.list(),
      dealSizesApi.list(),
      sourcesApi.list(),
      projectTypesApi.list(),
      canViewAll ? usersApi.list() : Promise.resolve([]),
    ]).then(([a, b, c, d, e, f]) => {
      setStages(a);
      setPriorities(b);
      setDealSizes(c);
      setSources(d);
      setProjectTypes(e);
      setUsers(f);
    });
  }, [canViewAll]);
  useEffect(() => {
    setIsLoading(true);
    setError(null);
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
  function toggleSort(key: SortKey) {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }
  const sortedLeads = useMemo(
    () =>
      [...leads].sort((a, b) => {
        const values: Record<SortKey, [unknown, unknown]> = {
          name: [a.name, b.name],
          stage: [a.stage.name, b.stage.name],
          priority: [a.priority?.name ?? '', b.priority?.name ?? ''],
          estimatedValue: [Number(a.estimatedValue ?? 0), Number(b.estimatedValue ?? 0)],
          owner: [
            a.assignees.map((item) => item.user.name).join(','),
            b.assignees.map((item) => item.user.name).join(','),
          ],
          stageEnteredAt: [a.stageEnteredAt, b.stageEnteredAt],
        };
        const [av, bv] = values[sort.key];
        const result =
          typeof av === 'number'
            ? av - (bv as number)
            : String(av).localeCompare(String(bv), 'pt-BR');
        return sort.direction === 'asc' ? result : -result;
      }),
    [leads, sort],
  );
  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => !['page', 'pageSize'].includes(key) && value,
  ).length;
  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1.5 hover:text-brand-purple"
    >
      {label}
      <Icon
        name="sort"
        className={`h-3.5 w-3.5 ${sort.key === field ? 'text-brand-purple' : 'text-slate-300'}`}
      />
    </button>
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="Comercial"
        title="Leads e oportunidades"
        description={`${total} registro${total === 1 ? '' : 's'} encontrado${total === 1 ? '' : 's'} no funil comercial.`}
        actions={
          <>
            <button className="btn-secondary" onClick={() => navigate('/leads/kanban')}>
              <Icon name="dashboard" className="h-4 w-4" />
              Ver Kanban
            </button>
            {canCreate && (
              <button className="btn-primary" onClick={() => navigate('/leads/novo')}>
                <Icon name="plus" className="h-4 w-4" />
                Novo lead
              </button>
            )}
          </>
        }
      />
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary">
          <Icon name="filter" className="h-4 w-4" />
          Filtros{' '}
          {activeFilters > 0 && (
            <span className="rounded-full bg-brand-purple px-2 py-0.5 text-[10px] text-white">
              {activeFilters}
            </span>
          )}
        </button>
        {activeFilters > 0 && (
          <button
            className="text-xs font-semibold text-brand-purple hover:underline"
            onClick={() => setFilters({ page: 1, pageSize: 20 })}
          >
            Limpar filtros
          </button>
        )}
      </div>
      {showFilters && (
        <div className="filter-panel">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="relative sm:col-span-2">
              <Icon name="search" className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                className="form-control pl-10"
                placeholder="Buscar por lead, empresa ou contato..."
                value={filters.search ?? ''}
                onChange={(e) => updateFilter({ search: e.target.value || undefined })}
              />
            </label>
            {[
              [stages, 'stageId', 'Todas as etapas'],
              [priorities, 'priorityId', 'Todas as prioridades'],
              [dealSizes, 'dealSizeId', 'Todos os portes'],
              [sources, 'sourceId', 'Todas as origens'],
              [projectTypes, 'projectTypeId', 'Todos os projetos'],
            ].map(([items, key, placeholder]) => (
              <select
                key={String(key)}
                className="form-control"
                value={(filters[key as keyof LeadListFilters] as string) ?? ''}
                onChange={(e) => updateFilter({ [key as string]: e.target.value || undefined })}
              >
                <option value="">{String(placeholder)}</option>
                {(items as Array<{ id: string; name: string }>).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ))}
            {canViewAll && (
              <select
                className="form-control"
                value={filters.ownerId ?? ''}
                onChange={(e) => updateFilter({ ownerId: e.target.value || undefined })}
              >
                <option value="">Todos os responsáveis</option>
                {users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="table-shell overflow-x-auto">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-400">Carregando oportunidades…</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <SortHeader label="Oportunidade" field="name" />
                </th>
                <th>
                  <SortHeader label="Etapa" field="stage" />
                </th>
                <th>
                  <SortHeader label="Prioridade" field="priority" />
                </th>
                <th>
                  <SortHeader label="Valor estimado" field="estimatedValue" />
                </th>
                <th>
                  <SortHeader label="Responsável" field="owner" />
                </th>
                <th>
                  <SortHeader label="Tempo na etapa" field="stageEnteredAt" />
                </th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <button onClick={() => navigate(`/leads/${lead.id}`)} className="text-left">
                      <p className="font-semibold text-slate-800 hover:text-brand-purple">
                        {lead.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {lead.companyName || 'Sem empresa informada'}
                      </p>
                    </button>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      <span className="status-dot" style={{ backgroundColor: lead.stage.color }} />
                      {lead.stage.name}
                    </span>
                  </td>
                  <td>
                    {lead.priority ? (
                      <span className="inline-flex items-center gap-2 text-xs font-medium">
                        <span
                          className="status-dot"
                          style={{ backgroundColor: lead.priority.color }}
                        />
                        {lead.priority.name}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="font-semibold text-slate-700">
                    {formatCurrency(lead.estimatedValue)}
                  </td>
                  <td>
                    <div className="flex items-center">
                      {lead.assignees.slice(0, 4).map(({ user: responsible }, index) =>
                        responsible.avatarUrl ? (
                          <img
                            key={responsible.id}
                            src={avatarUrl(responsible.id, responsible.avatarUrl)}
                            alt={responsible.name}
                            title={responsible.name}
                            className={`h-8 w-8 rounded-full border-2 border-white object-cover ${index ? '-ml-1.5' : ''}`}
                          />
                        ) : (
                          <span
                            key={responsible.id}
                            title={responsible.name}
                            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-blue/10 text-[9px] font-bold text-brand-blue ${index ? '-ml-1.5' : ''}`}
                          >
                            {responsible.name.slice(0, 2).toUpperCase()}
                          </span>
                        ),
                      )}
                      <span className="ml-2 max-w-48 truncate">
                        {lead.assignees.map((item) => item.user.name).join(', ')}
                      </span>
                    </div>
                  </td>
                  <td>{daysSince(lead.stageEnteredAt)} dias</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button
                        className="icon-button"
                        title="Visualizar"
                        onClick={() => navigate(`/leads/${lead.id}`)}
                      >
                        <Icon name="view" className="h-4 w-4" />
                      </button>
                      {canEdit && (
                        <button
                          className="icon-button"
                          title="Editar"
                          onClick={() => navigate(`/leads/${lead.id}/editar`)}
                        >
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedLeads.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="py-10 text-center">
                      <Icon name="search" className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-2 font-medium text-slate-600">Nenhum lead encontrado</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Tente ajustar os filtros da pesquisa.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {total > 20 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>Página {filters.page ?? 1}</span>
          <div className="flex gap-2">
            <button
              className="btn-secondary !h-9 !px-3"
              disabled={(filters.page ?? 1) <= 1}
              onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
            >
              <Icon name="chevron-left" className="h-4 w-4" />
              Anterior
            </button>
            <button
              className="btn-secondary !h-9 !px-3"
              disabled={(filters.page ?? 1) * 20 >= total}
              onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
            >
              Próxima
              <Icon name="chevron-right" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
