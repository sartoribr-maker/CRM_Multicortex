import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { partnersApi } from '../../lib/partnersApi';
import { formatCurrency, formatPhone } from '../../lib/formatters';
import { useAuthStore } from '../../store/useAuthStore';
import {
  PARTNER_STATUS_LABELS,
  PARTNER_TYPE_LABELS,
  type PartnerDetail,
} from '../../types/partners';

export default function PartnerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canEdit = user?.permissions.includes('partners.edit') ?? false;
  const canDelete = user?.permissions.includes('partners.delete') ?? false;
  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (id)
      partnersApi
        .get(id)
        .then(setPartner)
        .catch((err) =>
          setError(err instanceof Error ? err.message : 'Erro ao carregar parceiro.'),
        );
  }, [id]);
  async function toggleStatus() {
    if (
      !partner ||
      !window.confirm(`${partner.status === 'ACTIVE' ? 'Inativar' : 'Reativar'} este parceiro?`)
    )
      return;
    const updated =
      partner.status === 'ACTIVE'
        ? await partnersApi.deactivate(partner.id)
        : await partnersApi.reactivate(partner.id);
    setPartner({ ...partner, ...updated });
  }
  if (error)
    return (
      <AppShell>
        <p className="rounded-xl bg-red-50 p-4 text-red-600">{error}</p>
      </AppShell>
    );
  if (!partner)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Carregando…
      </div>
    );
  const Info = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-700">{value || '—'}</dd>
    </div>
  );
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Rede de parceiros"
          title={partner.name}
          description={partner.legalName ?? PARTNER_TYPE_LABELS[partner.type]}
          actions={
            <>
              <button className="btn-secondary" onClick={() => navigate('/partners')}>
                <Icon name="arrow-left" className="h-4 w-4" />
                Voltar
              </button>
              {canEdit && (
                <button
                  className="btn-primary"
                  onClick={() => navigate(`/partners/${partner.id}/editar`)}
                >
                  <Icon name="edit" className="h-4 w-4" />
                  Editar
                </button>
              )}
              {canDelete && (
                <button
                  className={partner.status === 'ACTIVE' ? 'btn-danger' : 'btn-secondary'}
                  onClick={toggleStatus}
                >
                  <Icon name="archive" className="h-4 w-4" />
                  {partner.status === 'ACTIVE' ? 'Inativar' : 'Reativar'}
                </button>
              )}
            </>
          }
        />
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <section className="card p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 className="font-heading font-bold text-slate-800">Dados do parceiro</h2>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${partner.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
                >
                  <span
                    className={`status-dot ${partner.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'}`}
                  />
                  {PARTNER_STATUS_LABELS[partner.status]}
                </span>
              </div>
              <dl className="mt-5 grid gap-6 sm:grid-cols-2">
                <Info label="Tipo" value={PARTNER_TYPE_LABELS[partner.type]} />
                <Info label="Documento" value={partner.document} />
                <Info label="Contato" value={partner.contactName} />
                <Info label="E-mail" value={partner.email} />
                <Info label="Telefone" value={formatPhone(partner.phone)} />
                <Info label="Website" value={partner.website} />
                <Info
                  label="Comissão padrão"
                  value={
                    partner.commissionPercentage === null
                      ? null
                      : `${Number(partner.commissionPercentage).toLocaleString('pt-BR')}%`
                  }
                />
              </dl>
              {partner.notes && (
                <div className="mt-6 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Observações
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {partner.notes}
                  </p>
                </div>
              )}
            </section>
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div>
                  <h2 className="font-heading font-bold text-slate-800">Oportunidades indicadas</h2>
                  <p className="mt-1 text-xs text-slate-400">Leads vinculados a este parceiro.</p>
                </div>
                <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-brand-purple">
                  {partner._count.leads}
                </span>
              </div>
              {partner.leads.length ? (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Oportunidade</th>
                        <th>Etapa</th>
                        <th>Responsável</th>
                        <th className="text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partner.leads.map((lead) => (
                        <tr
                          key={lead.id}
                          className="cursor-pointer"
                          onClick={() => navigate(`/leads/${lead.id}`)}
                        >
                          <td className="font-semibold text-slate-800">{lead.name}</td>
                          <td>
                            <span className="inline-flex items-center gap-2 text-xs">
                              <span
                                className="status-dot"
                                style={{ backgroundColor: lead.stage.color }}
                              />
                              {lead.stage.name}
                            </span>
                          </td>
                          <td>{lead.owner.name}</td>
                          <td className="text-right font-semibold">
                            {formatCurrency(lead.estimatedValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-10 text-center text-sm text-slate-400">
                  Nenhuma oportunidade vinculada.
                </p>
              )}
            </section>
          </div>
          <aside className="card h-fit p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Resumo da parceria
            </p>
            <div className="mt-5 rounded-2xl bg-gradient-to-br from-brand-purple-dark to-brand-purple p-5 text-white">
              <p className="text-sm text-white/60">Oportunidades vinculadas</p>
              <p className="mt-2 text-4xl font-bold">{partner._count.leads}</p>
            </div>
            <button className="btn-secondary mt-4 w-full" onClick={() => navigate(`/leads/novo`)}>
              <Icon name="plus" className="h-4 w-4" />
              Nova oportunidade
            </button>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
