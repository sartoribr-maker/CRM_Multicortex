import { FormEvent, useState } from 'react';
import { Icon } from '../../components/Icon';
import { leadsApi, type LeadFormPayload } from '../../lib/leadsApi';
import type { LeadDetail } from '../../types/leads';
import type { Priority, ProjectType, Segment } from '../../types/settings';
import {
  EMPTY_SDR_LEAD_FORM,
  SdrLeadFields,
  sdrPayloadFromForm,
  type SdrLeadFormState,
} from './SdrLeadFields';

interface SdrLeadFormModalProps {
  priorities: Priority[];
  projectTypes: ProjectType[];
  segments: Segment[];
  /** Campos adicionais enviados na criação (ex.: tipo e parceiro para usuários internos). */
  extraPayload?: Partial<LeadFormPayload>;
  onClose: () => void;
  onCreated: (lead: LeadDetail) => void;
}

/** Criação pelo SDR: origem, responsável e etapa inicial são definidos pelo backend. */
export function SdrLeadFormModal({
  priorities,
  projectTypes,
  segments,
  extraPayload,
  onClose,
  onCreated,
}: SdrLeadFormModalProps) {
  const [form, setForm] = useState<SdrLeadFormState>(EMPTY_SDR_LEAD_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.line) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload = sdrPayloadFromForm(form, 'create');
      const lead = await leadsApi.create({
        ...payload,
        ...extraPayload,
        name: form.name.trim(),
        line: form.line,
      });
      onCreated(lead);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a oportunidade.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mobile-modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="mobile-modal-panel max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-bold text-slate-900">Nova oportunidade</h2>
            <p className="mt-1 text-sm text-slate-500">
              Cadastrada como Outbound do parceiro SDR, na primeira etapa do funil, sob sua
              responsabilidade.
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-5">
          <SdrLeadFields
            form={form}
            onChange={setForm}
            priorities={priorities}
            projectTypes={projectTypes}
            segments={segments}
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSaving || !form.name.trim() || !form.line}
          >
            {isSaving ? 'Criando…' : 'Criar oportunidade'}
          </button>
        </div>
      </form>
    </div>
  );
}
