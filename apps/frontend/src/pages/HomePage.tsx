import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../components/AppShell';
import { Icon, type IconName } from '../components/Icon';
import { dashboardApi } from '../lib/dashboardApi';
import { formatCurrency, formatDate } from '../lib/formatters';
import { avatarUrl } from '../lib/usersApi';
import { useAuthStore } from '../store/useAuthStore';
import { TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS } from '../types/tasks';
import type { DashboardSummary, DashboardTask } from '../types/dashboard';
const currency = (v: number) => formatCurrency(v);
function Metric({
  label,
  value,
  caption,
  icon,
  color,
  onClick,
}: {
  label: string;
  value: string;
  caption: string;
  icon: IconName;
  color: string;
  onClick?: () => void;
}) {
  const content = (
    <div
      className={`card p-5 ${onClick ? 'transition hover:-translate-y-0.5 hover:shadow-lg' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400">{label}</p>
          <p className="mt-2 font-heading text-2xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-[11px] text-slate-400">{caption}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
  return onClick ? (
    <button type="button" className="w-full text-left" onClick={onClick}>
      {content}
    </button>
  ) : (
    content
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-slate-400">{children}</p>;
}
export default function HomePage() {
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    dashboardApi
      .summary()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar indicadores.'));
  }, []);
  if (error)
    return (
      <AppShell>
        <p className="rounded-xl bg-red-50 p-4 text-red-600">{error}</p>
      </AppShell>
    );
  if (!data)
    return (
      <AppShell>
        <div className="card flex h-72 items-center justify-center text-sm text-slate-400">
          Carregando indicadores…
        </div>
      </AppShell>
    );
  const userInitials = user?.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const maxFunnel = Math.max(...data.funnel.map((s) => s.count), 1);
  const TaskRow = ({ task, late }: { task: DashboardTask; late?: boolean }) => (
    <button
      onClick={() => nav(`/tasks/${task.id}`)}
      className="flex w-full items-center gap-3 border-b border-slate-100 px-5 py-3.5 text-left last:border-0 hover:bg-slate-50"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${late ? 'bg-red-500' : 'bg-brand-blue'}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-700">{task.title}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {task.assignee.name} · {formatDate(task.dueDate)}
        </p>
      </div>
      <span
        className={`rounded-lg px-2 py-1 text-[10px] font-bold ${TASK_PRIORITY_COLORS[task.priority]}`}
      >
        {TASK_PRIORITY_LABELS[task.priority]}
      </span>
    </button>
  );
  return (
    <AppShell>
      <PageHeader
        eyebrow={data.scope === 'TEAM' ? 'Visão executiva da equipe' : 'Minha visão comercial'}
        title={
          <span className="flex items-center gap-3">
            {user?.avatarUrl ? (
              <img
                src={avatarUrl(user.id, user.avatarUrl)}
                alt={`Foto de ${user.name}`}
                className="h-[72px] w-[72px] shrink-0 rounded-full border-2 border-white object-cover shadow-md ring-1 ring-slate-200"
              />
            ) : (
              <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-brand-purple text-lg font-bold text-white shadow-md">
                {userInitials}
              </span>
            )}
            <span>Olá, {user?.name.split(' ')[0]} 👋</span>
          </span>
        }
        description="Acompanhe os principais números da operação e priorize as próximas ações."
        actions={
          <>
            <button className="btn-secondary" onClick={() => nav('/leads/kanban')}>
              <Icon name="dashboard" className="h-4 w-4" />
              Abrir Kanban
            </button>
            <button className="btn-primary" onClick={() => nav('/leads/novo')}>
              <Icon name="plus" className="h-4 w-4" />
              Nova oportunidade
            </button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Pipeline aberto"
          value={currency(data.metrics.pipelineValue)}
          caption={`${data.metrics.openLeads} oportunidades em aberto`}
          icon="leads"
          color="bg-purple-50 text-brand-purple"
        />
        <Metric
          label="Receita conquistada"
          value={currency(data.metrics.wonValue)}
          caption={`${data.metrics.wonLeads} negócios ganhos`}
          icon="dashboard"
          color="bg-emerald-50 text-emerald-600"
        />
        <Metric
          label="Taxa de conversão"
          value={`${data.metrics.conversionRate.toFixed(1)}%`}
          caption={`${data.metrics.lostLeads} oportunidades perdidas`}
          icon="sort"
          color="bg-blue-50 text-brand-blue"
        />
        <Metric
          label="Tarefas atrasadas"
          value={String(data.metrics.overdueTasks)}
          caption="Exigem atenção da equipe"
          icon="file"
          color="bg-red-50 text-red-600"
          onClick={() => nav('/tasks?overdue=true')}
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section className="card p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-bold text-slate-800">Distribuição do funil</h2>
              <p className="mt-1 text-xs text-slate-400">Oportunidades e valores por etapa.</p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              Ticket médio {currency(data.metrics.averageTicket)}
            </span>
          </div>
          <div className="mt-6 space-y-4">
            {data.funnel.map((stage) => (
              <button
                type="button"
                key={stage.id}
                className="block w-full rounded-lg p-1 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple"
                onClick={() => nav(`/leads?stageId=${stage.id}`)}
                title={`Ver oportunidades da etapa ${stage.name}`}
              >
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="status-dot" style={{ backgroundColor: stage.color }} />
                    <span className="font-semibold text-slate-600">{stage.name}</span>
                    <span className="text-slate-400">{stage.count}</span>
                  </div>
                  <span className="font-semibold text-slate-500">{currency(stage.value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(stage.count ? 6 : 0, (stage.count / maxFunnel) * 100)}%`,
                      backgroundColor: stage.color,
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-heading font-bold text-slate-800">Atenção imediata</h2>
            <p className="mt-1 text-xs text-slate-400">Oportunidades com prioridade Mandatória.</p>
          </div>
          {data.mandatoryLeads.length ? (
            data.mandatoryLeads.map((lead) => (
              <button
                key={lead.id}
                onClick={() => nav(`/leads/${lead.id}`)}
                className="flex w-full items-center gap-3 border-b border-red-100 bg-red-50/50 px-5 py-3.5 text-left last:border-0 hover:bg-red-50"
              >
                <span className="h-9 w-1 rounded-full bg-red-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-red-700">{lead.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-red-400">
                    {lead.companyName || 'Sem empresa'} · {lead.owner.name}
                  </p>
                </div>
                <span className="rounded-lg bg-red-100 px-2 py-1 text-[10px] font-bold text-red-600">
                  {lead.stage.name}
                </span>
              </button>
            ))
          ) : (
            <Empty>Nenhuma oportunidade com prioridade Mandatória.</Empty>
          )}
          <button
            className="w-full border-t border-slate-100 py-3 text-xs font-bold text-brand-purple hover:bg-purple-50"
            onClick={() =>
              nav(
                data.mandatoryPriorityId
                  ? `/leads?priorityId=${data.mandatoryPriorityId}`
                  : '/leads',
              )
            }
          >
            Ver oportunidades mandatórias
          </button>
        </section>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="font-heading font-bold text-slate-800">Oportunidades recentes</h2>
              <p className="mt-1 text-xs text-slate-400">Últimas movimentações no pipeline.</p>
            </div>
            <button className="text-xs font-bold text-brand-purple" onClick={() => nav('/leads')}>
              Ver lista
            </button>
          </div>
          {data.recentLeads.length ? (
            data.recentLeads.map((l) => (
              <button
                key={l.id}
                onClick={() => nav(`/leads/${l.id}`)}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-5 py-3.5 text-left last:border-0 hover:bg-slate-50"
              >
                <span className="h-9 w-1 rounded-full" style={{ backgroundColor: l.stage.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-700">{l.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {l.companyName || 'Sem empresa'} · {l.owner.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-600">
                    {currency(Number(l.estimatedValue ?? 0))}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{l.stage.name}</p>
                </div>
              </button>
            ))
          ) : (
            <Empty>Nenhuma oportunidade disponível.</Empty>
          )}
        </section>
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-heading font-bold text-slate-800">Próximas atividades</h2>
            <p className="mt-1 text-xs text-slate-400">Agenda prevista para os próximos 7 dias.</p>
          </div>
          {data.upcomingTasks.length ? (
            data.upcomingTasks.map((t) => <TaskRow key={t.id} task={t} />)
          ) : (
            <Empty>Nenhuma atividade para os próximos dias.</Empty>
          )}
        </section>
      </div>
      {data.ownerPerformance.length > 0 && (
        <section className="card mt-5 overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-heading font-bold text-slate-800">Desempenho comercial</h2>
            <p className="mt-1 text-xs text-slate-400">Resultados consolidados por responsável.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Responsável</th>
                  <th>Em aberto</th>
                  <th>Ganhos</th>
                  <th>Pipeline</th>
                  <th>Receita conquistada</th>
                </tr>
              </thead>
              <tbody>
                {data.ownerPerformance.map((o) => (
                  <tr key={o.id}>
                    <td className="font-semibold text-slate-800">{o.name}</td>
                    <td>{o.openCount}</td>
                    <td>{o.wonCount}</td>
                    <td className="font-semibold">{currency(o.pipelineValue)}</td>
                    <td className="font-semibold text-emerald-600">{currency(o.wonValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}
