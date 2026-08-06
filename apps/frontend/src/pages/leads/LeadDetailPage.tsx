import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { leadsApi } from '../../lib/leadsApi';
import { useAuthStore } from '../../store/useAuthStore';
import {
  LEAD_ACTIVITY_LABELS,
  LEAD_PERIODICITY_LABELS,
  LEAD_STATUS_LABELS,
  type LeadActivity,
  type LeadAttachment,
  type LeadDetail,
} from '../../types/leads';

type Tab = 'overview' | 'timeline' | 'attachments';

function formatCurrency(value: string | number | null): string {
  if (value === null) return '—';
  const num = typeof value === 'string' ? Number(value) : value;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.permissions.includes('leads.edit') ?? false;
  const canDelete = user?.permissions.includes('leads.delete') ?? false;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);

  function loadLead() {
    if (!id) return;
    leadsApi
      .get(id)
      .then(setLead)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar lead.'));
  }

  useEffect(loadLead, [id]);

  async function handleArchive() {
    if (!id || !window.confirm('Arquivar este lead?')) return;
    await leadsApi.archive(id);
    navigate('/leads');
  }

  if (error) {
    return <p className="p-8 text-center text-danger">{error}</p>;
  }
  if (!lead) {
    return <p className="p-8 text-center text-ink/60">Carregando…</p>;
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="flex items-center justify-between bg-brand-purple-dark px-6 py-4 text-white">
        <img src={logo} alt="Multicortex" className="h-8" />
        <Link
          to="/leads"
          className="rounded-card border border-white/30 px-3 py-1.5 text-sm transition hover:bg-white/10"
        >
          Voltar
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span
              className="inline-block rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: lead.stage.color }}
            >
              {lead.stage.name}
            </span>
            <h1 className="mt-2 font-heading text-2xl font-bold text-brand-purple-dark">{lead.name}</h1>
            {lead.companyName && <p className="text-sm text-ink/70">{lead.companyName}</p>}
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <button
                onClick={() => navigate(`/leads/${lead.id}/editar`)}
                className="rounded-card border border-surface-muted bg-surface px-3 py-1.5 text-sm text-ink hover:bg-surface-muted"
              >
                Editar
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleArchive}
                className="rounded-card border border-danger/30 px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
              >
                Arquivar
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-1 border-b border-surface-muted">
          {(
            [
              ['overview', 'Visão Geral'],
              ['timeline', 'Linha do Tempo'],
              ['attachments', 'Anexos'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-t-card px-4 py-2 text-sm font-medium transition ${
                tab === key
                  ? 'border-b-2 border-brand-purple text-brand-purple-dark'
                  : 'text-ink/60 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-card bg-surface p-6 shadow-sm">
          {tab === 'overview' && <OverviewTab lead={lead} />}
          {tab === 'timeline' && <TimelineTab leadId={lead.id} canComment={canEdit} />}
          {tab === 'attachments' && (
            <AttachmentsTab leadId={lead.id} canEdit={canEdit} onUploaded={loadLead} />
          )}
        </div>
      </main>
    </div>
  );
}

function OverviewTab({ lead }: { lead: LeadDetail }) {
  return (
    <div className="grid grid-cols-2 gap-6 text-sm">
      <div>
        <h3 className="mb-2 font-semibold text-ink">Negócio</h3>
        <dl className="flex flex-col gap-1 text-ink/80">
          <div>
            <dt className="inline text-ink/50">Status: </dt>
            <dd className="inline">{LEAD_STATUS_LABELS[lead.status]}</dd>
          </div>
          <div>
            <dt className="inline text-ink/50">Valor estimado: </dt>
            <dd className="inline">{formatCurrency(lead.estimatedValue)}</dd>
          </div>
          <div>
            <dt className="inline text-ink/50">Probabilidade: </dt>
            <dd className="inline">{lead.successProbability ?? '—'}%</dd>
          </div>
          <div>
            <dt className="inline text-ink/50">Periodicidade: </dt>
            <dd className="inline">{LEAD_PERIODICITY_LABELS[lead.periodicity]}</dd>
          </div>
          <div>
            <dt className="inline text-ink/50">Previsão de fechamento: </dt>
            <dd className="inline">
              {lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toLocaleDateString('pt-BR') : '—'}
            </dd>
          </div>
          <div>
            <dt className="inline text-ink/50">Prioridade: </dt>
            <dd className="inline">{lead.priority?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="inline text-ink/50">Porte: </dt>
            <dd className="inline">{lead.dealSize?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="inline text-ink/50">Origem: </dt>
            <dd className="inline">{lead.source?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="inline text-ink/50">Tipo de projeto: </dt>
            <dd className="inline">{lead.projectType?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="inline text-ink/50">Responsável: </dt>
            <dd className="inline">{lead.owner.name}</dd>
          </div>
          {lead.lossReason && (
            <div>
              <dt className="inline text-ink/50">Motivo da perda: </dt>
              <dd className="inline">{lead.lossReason}</dd>
            </div>
          )}
        </dl>
      </div>

      <div>
        <h3 className="mb-2 font-semibold text-ink">Contato</h3>
        <dl className="flex flex-col gap-1 text-ink/80">
          <div>
            <dt className="inline text-ink/50">Nome: </dt>
            <dd className="inline">{lead.contactName ?? '—'}</dd>
          </div>
          <div>
            <dt className="inline text-ink/50">E-mail: </dt>
            <dd className="inline">{lead.contactEmail ?? '—'}</dd>
          </div>
          <div>
            <dt className="inline text-ink/50">Telefone: </dt>
            <dd className="inline">{lead.contactPhone ?? '—'}</dd>
          </div>
        </dl>

        {lead.description && (
          <>
            <h3 className="mb-2 mt-4 font-semibold text-ink">Descrição</h3>
            <p className="whitespace-pre-wrap text-ink/80">{lead.description}</p>
          </>
        )}

        {lead.customFieldValues.length > 0 && (
          <>
            <h3 className="mb-2 mt-4 font-semibold text-ink">Campos customizados</h3>
            <dl className="flex flex-col gap-1 text-ink/80">
              {lead.customFieldValues.map((entry) => (
                <div key={entry.id}>
                  <dt className="inline text-ink/50">{entry.customField.name}: </dt>
                  <dd className="inline">
                    {Array.isArray(entry.value) ? entry.value.join(', ') : String(entry.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </div>
  );
}

function TimelineTab({ leadId, canComment }: { leadId: string; canComment: boolean }) {
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function refresh() {
    leadsApi.listActivities(leadId).then(setActivities);
  }

  useEffect(refresh, [leadId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    setIsSubmitting(true);
    try {
      await leadsApi.addComment(leadId, comment.trim());
      setComment('');
      refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {canComment && (
        <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
          <input
            className="flex-1 rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple"
            placeholder="Adicionar um comentário…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-card bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark disabled:opacity-60"
          >
            Comentar
          </button>
        </form>
      )}

      <ul className="flex flex-col gap-3">
        {activities.map((activity) => (
          <li key={activity.id} className="rounded-card border border-surface-muted p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-brand-purple-dark">
                {LEAD_ACTIVITY_LABELS[activity.type]}
              </span>
              <span className="text-xs text-ink/50">{formatDate(activity.createdAt)}</span>
            </div>
            <p className="mt-1 text-ink/80">{activity.message}</p>
            {activity.actorUser && (
              <p className="mt-1 text-xs text-ink/50">por {activity.actorUser.name}</p>
            )}
          </li>
        ))}
        {activities.length === 0 && <p className="text-sm text-ink/50">Nenhuma atividade ainda.</p>}
      </ul>
    </div>
  );
}

function AttachmentsTab({
  leadId,
  canEdit,
  onUploaded,
}: {
  leadId: string;
  canEdit: boolean;
  onUploaded: () => void;
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
      onUploaded();
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
      {canEdit && (
        <div className="mb-4">
          <label className="inline-block cursor-pointer rounded-card bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark">
            {isUploading ? 'Enviando…' : '+ Adicionar anexo'}
            <input type="file" className="hidden" onChange={handleFileChange} disabled={isUploading} />
          </label>
          <p className="mt-1 text-xs text-ink/50">Máximo 15MB. Imagens, PDF, Office, texto ou zip.</p>
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
              {canEdit && (
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
