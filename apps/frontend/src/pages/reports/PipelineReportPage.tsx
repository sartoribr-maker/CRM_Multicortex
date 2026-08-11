import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { formatCurrency } from '../../lib/formatters';
import { leadsApi } from '../../lib/leadsApi';
import { stagesApi } from '../../lib/settingsApi';
import type { LeadListItem } from '../../types/leads';
import type { Stage } from '../../types/settings';

const numberValue = (value: string | number | null) => Number(value ?? 0);

export default function PipelineReportPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([leadsApi.list({ page: 1, pageSize: 100 }), stagesApi.list()])
      .then(async ([firstPage, stageItems]) => {
        const remainingPages = Array.from(
          { length: Math.max(0, firstPage.totalPages - 1) },
          (_, index) => leadsApi.list({ page: index + 2, pageSize: 100 }),
        );
        const remaining = await Promise.all(remainingPages);
        setLeads([firstPage, ...remaining].flatMap((page) => page.items));
        setStages(stageItems);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar relatório.'),
      )
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(
    () =>
      leads.reduce(
        (result, lead) => ({
          capex: result.capex + numberValue(lead.capexValue),
          monthlyOpex: result.monthlyOpex + numberValue(lead.opexValue),
          estimated: result.estimated + numberValue(lead.estimatedValue),
        }),
        { capex: 0, monthlyOpex: 0, estimated: 0 },
      ),
    [leads],
  );

  const pipeline = useMemo(
    () =>
      stages.map((stage) => {
        const items = leads.filter((lead) => lead.stage.id === stage.id);
        return {
          stage,
          items,
          estimated: items.reduce((sum, lead) => sum + numberValue(lead.estimatedValue), 0),
        };
      }),
    [leads, stages],
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="Visões e relatórios"
        title="Pipeline de oportunidades"
        description="Visão consolidada de todos os leads e seus valores por etapa comercial."
      />
      {error && <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="card p-12 text-center text-sm text-slate-400">Carregando pipeline…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Summary label="Oportunidades" value={String(leads.length)} />
            <Summary label="CAPEX total" value={formatCurrency(totals.capex)} />
            <Summary label="OPEX mensal" value={formatCurrency(totals.monthlyOpex)} />
            <Summary label="Valor estimado" value={formatCurrency(totals.estimated)} />
          </div>

          <section className="card mt-5 p-5 md:p-6">
            <div className="mb-5">
              <h2 className="font-heading font-bold text-slate-800">Distribuição por etapa</h2>
              <p className="mt-1 text-xs text-slate-400">Quantidade e participação no valor total do pipeline.</p>
            </div>
            <div className="space-y-5">
              {pipeline.map(({ stage, items, estimated }) => {
                const percentage = totals.estimated ? (estimated / totals.estimated) * 100 : 0;
                return (
                  <button
                    key={stage.id}
                    className="block w-full text-left"
                    onClick={() => navigate(`/leads?stageId=${stage.id}`)}
                  >
                    <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                      <span className="font-semibold text-slate-700">
                        {stage.name} <span className="ml-1 text-slate-400">{items.length}</span>
                      </span>
                      <span className="font-bold text-slate-700">{formatCurrency(estimated)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(percentage, items.length ? 1 : 0)}%`, backgroundColor: stage.color }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="table-shell mt-5 overflow-x-auto">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-heading font-bold text-slate-800">Todas as oportunidades</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Oportunidade</th><th>Etapa</th><th>Probabilidade</th><th>Parceiro</th>
                  <th className="text-right">CAPEX</th><th className="text-right">OPEX</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                    <td><p className="font-semibold text-slate-800">{lead.name}</p><p className="text-xs text-slate-400">{lead.companyName ?? 'Empresa não informada'}</p></td>
                    <td><span className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: lead.stage.color }}>{lead.stage.name}</span></td>
                    <td>{lead.successProbability === null ? '—' : `${lead.successProbability}%`}</td>
                    <td>{lead.partner?.name ?? '—'}</td>
                    <td className="text-right">{formatCurrency(lead.capexValue)}</td>
                    <td className="text-right">{formatCurrency(lead.opexValue)}</td>
                    <td className="text-right font-bold text-slate-800">{formatCurrency(lead.estimatedValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </AppShell>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="card p-5"><p className="text-xs font-semibold text-slate-400">{label}</p><p className="mt-2 text-xl font-bold text-slate-900">{value}</p></div>;
}
