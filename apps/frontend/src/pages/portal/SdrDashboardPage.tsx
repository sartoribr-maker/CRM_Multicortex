import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/AppShell';
import { Icon, type IconName } from '../../components/Icon';
import { DateInput } from '../../components/MaskedInputs';
import { TaskDeadline } from '../../components/TaskDeadline';
import { formatDate } from '../../lib/formatters';
import { sdrPortalApi } from '../../lib/sdrPortalApi';
import { LEAD_ACTIVITY_LABELS } from '../../types/leads';
import type { SdrAttentionLead, SdrPeriod, SdrSummary, SdrTask } from '../../types/sdrPortal';
import { ThirdPartyShell } from './ThirdPartyShell';

const PERIODS: Array<[SdrPeriod, string]> = [
  ['today', 'Hoje'],
  ['week', 'Semana'],
  ['month', 'Mês'],
  ['custom', 'Personalizado'],
];

const CREATED_COLOR = '#74529F';
const QUALIFIED_COLOR = '#42AD83';

function leadLink(leadId: string) {
  return `/terceiro/kanban?lead=${leadId}`;
}

function Metric({
  label,
  value,
  caption,
  icon,
  color,
}: {
  label: string;
  value: string;
  caption: string;
  icon: IconName;
  color: string;
}) {
  return (
    <div className="card p-5">
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
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <h2 className="font-heading font-bold text-slate-800">{title}</h2>
        {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-400">{children}</p>;
}

function EvolutionChart({ timeline }: { timeline: SdrSummary['timeline'] }) {
  const width = 640;
  const height = 200;
  const padding = { top: 12, right: 8, bottom: 28, left: 28 };
  const max = Math.max(1, ...timeline.flatMap((bucket) => [bucket.created, bucket.qualified]));
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const slot = plotWidth / Math.max(timeline.length, 1);
  const barWidth = Math.max(2, Math.min(14, slot / 2 - 2));
  const y = (value: number) => padding.top + plotHeight - (value / max) * plotHeight;
  const labelEvery = Math.ceil(timeline.length / 10);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-52 w-full"
        role="img"
        aria-label="Evolução de leads criados e qualificados no período"
      >
        {[0, 0.5, 1].map((ratio) => {
          const value = Math.round(max * ratio);
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y(value)}
                y2={y(value)}
                className="stroke-slate-200"
                strokeDasharray={ratio ? '3 3' : undefined}
              />
              <text x={padding.left - 6} y={y(value) + 3} textAnchor="end" className="fill-slate-400 text-[10px]">
                {value}
              </text>
            </g>
          );
        })}
        {timeline.map((bucket, index) => {
          const center = padding.left + slot * index + slot / 2;
          return (
            <g key={bucket.start}>
              <rect
                x={center - barWidth - 1}
                y={y(bucket.created)}
                width={barWidth}
                height={padding.top + plotHeight - y(bucket.created)}
                rx={2}
                fill={CREATED_COLOR}
              >
                <title>{`${bucket.label}: ${bucket.created} criado(s)`}</title>
              </rect>
              <rect
                x={center + 1}
                y={y(bucket.qualified)}
                width={barWidth}
                height={padding.top + plotHeight - y(bucket.qualified)}
                rx={2}
                fill={QUALIFIED_COLOR}
              >
                <title>{`${bucket.label}: ${bucket.qualified} qualificado(s)`}</title>
              </rect>
              {index % labelEvery === 0 && (
                <text x={center} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">
                  {bucket.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CREATED_COLOR }} />
          Criados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: QUALIFIED_COLOR }} />
          Qualificados
        </span>
      </figcaption>
    </figure>
  );
}

function AttentionList({ leads, empty }: { leads: SdrAttentionLead[]; empty: string }) {
  if (!leads.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-slate-100">
      {leads.map((lead) => (
        <li key={lead.id}>
          <Link
            to={leadLink(lead.id)}
            className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand-purple"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-700">{lead.name}</span>
              <span className="block truncate text-xs text-slate-400">
                {[lead.businessCode, lead.companyName].filter(Boolean).join(' · ') || '—'}
              </span>
            </span>
            <span className="shrink-0 text-right text-xs text-slate-500">
              {lead.priority && (
                <span className="flex items-center justify-end gap-1.5">
                  <span className="status-dot" style={{ backgroundColor: lead.priority.color }} />
                  {lead.priority.name}
                </span>
              )}
              {lead.daysInStage} dia(s) na etapa
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function TaskList({ tasks, empty }: { tasks: SdrTask[]; empty: string }) {
  if (!tasks.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-700">{task.title}</span>
            {task.lead && (
              <Link to={leadLink(task.lead.id)} className="block truncate text-xs text-brand-purple">
                {task.lead.name}
              </Link>
            )}
          </span>
          <TaskDeadline dueDate={task.dueDate} />
        </li>
      ))}
    </ul>
  );
}

export default function SdrDashboardPage() {
  const [period, setPeriod] = useState<SdrPeriod>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<SdrSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (period === 'custom' && (!from || !to)) return;
    let cancelled = false;
    setError(null);
    sdrPortalApi
      .summary(period, from, to)
      .then((summary) => !cancelled && setData(summary))
      .catch(
        (err) =>
          !cancelled &&
          setError(err instanceof Error ? err.message : 'Não foi possível carregar o dashboard.'),
      );
    return () => {
      cancelled = true;
    };
  }, [period, from, to]);

  const maxFunnel = Math.max(1, ...(data?.funnel.map((stage) => stage.count) ?? [0]));

  return (
    <ThirdPartyShell>
      <PageHeader
        eyebrow="Portal SDR"
        title="Seu desempenho em prospecção"
        description={
          data
            ? `Período de ${formatDate(data.period.start)} a ${formatDate(new Date(new Date(data.period.end).getTime() - 1))}.`
            : undefined
        }
        actions={
          <Link to="/terceiro/kanban" className="btn-primary">
            <Icon name="leads" className="h-4 w-4" />
            Abrir Kanban
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-2">
        <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {PERIODS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                period === value ? 'bg-brand-purple text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <>
            <label className="text-xs font-semibold text-slate-500">
              De
              <DateInput className="form-control mt-1 !w-40" value={from} onValueChange={(value) => setFrom(value ?? '')} />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Até
              <DateInput className="form-control mt-1 !w-40" value={to} onValueChange={(value) => setTo(value ?? '')} />
            </label>
          </>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {!data ? (
        !error && (
          <div className="card flex h-72 items-center justify-center text-sm text-slate-400">
            Carregando indicadores…
          </div>
        )
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Leads criados"
              value={String(data.metrics.created)}
              caption="por você no período"
              icon="plus"
              color="bg-purple-50 text-brand-purple"
            />
            <Metric
              label="Qualificados / reuniões"
              value={String(data.metrics.qualified)}
              caption={
                data.metrics.qualificationRate === null
                  ? 'Taxa de qualificação: —'
                  : `Taxa de qualificação: ${data.metrics.qualificationRate.toFixed(1)}%`
              }
              icon="dashboard"
              color="bg-emerald-50 text-emerald-600"
            />
            <Metric
              label="Desqualificados"
              value={String(data.metrics.disqualified)}
              caption="movidos para perda no período"
              icon="x"
              color="bg-red-50 text-red-600"
            />
            <Metric
              label="Leads em prospecção"
              value={String(data.metrics.activePortfolio)}
              caption={`${data.metrics.stale} parada(s) há mais de ${data.metrics.staleDays} dias`}
              icon="leads"
              color="bg-amber-50 text-amber-600"
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
            <Section
              title="Criados × qualificados"
              description={`Evolução ${data.period.granularity === 'day' ? 'diária' : 'semanal'} no período.`}
            >
              <EvolutionChart timeline={data.timeline} />
            </Section>
            <Section title="Funil de prospecção" description="Oportunidades abertas do CRM por etapa do portal.">
              <div className="space-y-4">
                {data.funnel.map((stage) => (
                  <div key={stage.id}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-semibold text-slate-600">
                        <span className="status-dot" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </span>
                      <span className="text-slate-400">{stage.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(stage.count ? 6 : 0, (stage.count / maxFunnel) * 100)}%`,
                          backgroundColor: stage.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
                {data.funnel.length === 0 && <Empty>Portal sem etapas configuradas.</Empty>}
              </div>
            </Section>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <Section
              title="Precisam de atenção"
              description={`Sem movimentação há mais de ${data.metrics.staleDays} dias.`}
            >
              <AttentionList leads={data.attention.stale} empty="Nenhum lead parado. Ótimo trabalho!" />
            </Section>
            <Section title="Prioridade mais alta" description="Leads abertos por prioridade.">
              <AttentionList leads={data.attention.highPriority} empty="Nenhum lead com prioridade definida." />
            </Section>
            <Section title="Tempo médio por etapa" description="Dias até sair da etapa, no período.">
              <ul className="space-y-2 text-sm">
                {data.averageDaysPerStage.map((stage) => (
                  <li key={stage.id} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="status-dot" style={{ backgroundColor: stage.color }} />
                      {stage.name}
                    </span>
                    <span className="font-semibold text-slate-700">
                      {stage.averageDays === null ? '—' : `${stage.averageDays.toFixed(1)} dias`}
                    </span>
                  </li>
                ))}
              </ul>
              <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">
                Principais motivos de perda
              </h3>
              {data.lossReasons.length ? (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {data.lossReasons.map((item) => (
                    <li key={item.reason} className="flex justify-between gap-3">
                      <span className="truncate text-slate-600">{item.reason}</span>
                      <span className="font-semibold text-slate-700">{item.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Nenhuma desqualificação no período.</Empty>
              )}
            </Section>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {data.tasks.enabled && (
              <Section title="Suas tarefas" description="Atrasadas e com vencimento nos próximos 7 dias.">
                <h3 className="text-xs font-bold uppercase tracking-wide text-red-500">Atrasadas</h3>
                <TaskList tasks={data.tasks.overdue} empty="Nenhuma tarefa atrasada." />
                <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                  Próximos 7 dias
                </h3>
                <TaskList tasks={data.tasks.upcoming} empty="Nenhuma tarefa na semana." />
              </Section>
            )}
            <Section title="Suas últimas ações" description="Movimentações e comentários que você registrou.">
              {data.recentActivities.length ? (
                <ul className="divide-y divide-slate-100">
                  {data.recentActivities.map((activity) => (
                    <li key={activity.id} className="py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <Link to={leadLink(activity.lead.id)} className="truncate font-semibold text-slate-700 hover:text-brand-purple">
                          {activity.lead.name}
                        </Link>
                        <span className="shrink-0 text-xs text-slate-400">{formatDate(activity.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-slate-500">
                        <span className="font-semibold text-brand-purple">
                          {LEAD_ACTIVITY_LABELS[activity.type]}:
                        </span>{' '}
                        {activity.message}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Nenhuma atividade ainda.</Empty>
              )}
            </Section>
          </div>
        </>
      )}
    </ThirdPartyShell>
  );
}
