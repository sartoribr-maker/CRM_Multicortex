import { CustomFieldsFormSection } from '../../components/CustomFieldsFormSection';
import { LeadAutocompleteInput } from '../../components/LeadAutocompleteInput';
import { PhoneInput } from '../../components/MaskedInputs';
import type { CustomFieldValueInput, LeadFormPayload } from '../../lib/leadsApi';
import { LEAD_LINE_LABELS, type LeadDetail, type LeadLine } from '../../types/leads';
import type { Priority, ProjectType, Segment } from '../../types/settings';

/** Campos de prospecção que o SDR pode preencher (espelha a política do backend). */
export interface SdrLeadFormState {
  name: string;
  line: LeadLine | '';
  companyName: string;
  companyDocument: string;
  companySegment: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  projectTypeIds: string[];
  priorityId: string;
  description: string;
  customFieldValues: CustomFieldValueInput[];
}

export const EMPTY_SDR_LEAD_FORM: SdrLeadFormState = {
  name: '',
  line: '',
  companyName: '',
  companyDocument: '',
  companySegment: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  projectTypeIds: [],
  priorityId: '',
  description: '',
  customFieldValues: [],
};

export function sdrFormFromLead(lead: LeadDetail): SdrLeadFormState {
  return {
    name: lead.name,
    line: lead.line ?? '',
    companyName: lead.companyName ?? '',
    companyDocument: lead.companyDocument ?? '',
    companySegment: lead.companySegment ?? '',
    contactName: lead.contactName ?? '',
    contactEmail: lead.contactEmail ?? '',
    contactPhone: lead.contactPhone ?? '',
    projectTypeIds: lead.projectTypes.map(({ projectType }) => projectType.id),
    priorityId: lead.priority?.id ?? '',
    description: lead.description ?? '',
    customFieldValues: lead.customFieldValues.map(({ customFieldId, value }) => ({
      customFieldId,
      value,
    })),
  };
}

/**
 * Na criação, campos vazios são omitidos. Na edição, textos vazios limpam o
 * valor; e-mail, linha, prioridade e tipos vazios não são enviados.
 */
export function sdrPayloadFromForm(
  form: SdrLeadFormState,
  mode: 'create' | 'update',
): Partial<LeadFormPayload> {
  const text = (value: string) => (mode === 'update' ? value.trim() : value.trim() || undefined);
  return {
    name: form.name.trim(),
    line: form.line || undefined,
    companyName: text(form.companyName),
    companyDocument: text(form.companyDocument),
    companySegment: text(form.companySegment),
    contactName: text(form.contactName),
    contactEmail: form.contactEmail.trim() || undefined,
    contactPhone: text(form.contactPhone),
    projectTypeIds: form.projectTypeIds.length ? form.projectTypeIds : undefined,
    priorityId: form.priorityId || undefined,
    description: text(form.description),
    customFieldValues: form.customFieldValues.length ? form.customFieldValues : undefined,
  };
}

interface SdrLeadFieldsProps {
  form: SdrLeadFormState;
  onChange: (form: SdrLeadFormState) => void;
  priorities: Priority[];
  projectTypes: ProjectType[];
  segments: Segment[];
}

export function SdrLeadFields({
  form,
  onChange,
  priorities,
  projectTypes,
  segments,
}: SdrLeadFieldsProps) {
  function update<K extends keyof SdrLeadFormState>(key: K, value: SdrLeadFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="form-label">Nome da oportunidade *</label>
          <input
            required
            className="form-control"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="Ex.: Prospecção - Empresa X"
          />
        </div>
        <div>
          <label className="form-label">Empresa</label>
          <LeadAutocompleteInput
            type="company"
            value={form.companyName}
            onChange={(value) => update('companyName', value)}
            onSelect={(option) =>
              onChange({
                ...form,
                companyName: option.companyName ?? '',
                companyDocument: option.companyDocument ?? form.companyDocument,
              })
            }
          />
        </div>
        <div>
          <label className="form-label">CNPJ/CPF</label>
          <input
            className="form-control"
            value={form.companyDocument}
            onChange={(event) => update('companyDocument', event.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Segmento</label>
          <select
            className="form-control"
            value={form.companySegment}
            onChange={(event) => update('companySegment', event.target.value)}
          >
            <option value="">Selecione…</option>
            {segments.map((segment) => (
              <option key={segment.id} value={segment.name}>
                {segment.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Linha *</label>
          <select
            required
            className="form-control"
            value={form.line}
            onChange={(event) => update('line', event.target.value as LeadLine | '')}
          >
            <option value="">Selecione…</option>
            {Object.entries(LEAD_LINE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="form-label">Contato</label>
          <LeadAutocompleteInput
            type="contact"
            value={form.contactName}
            onChange={(value) => update('contactName', value)}
            onSelect={(option) =>
              onChange({
                ...form,
                contactName: option.contactName ?? '',
                contactEmail: option.contactEmail ?? form.contactEmail,
                contactPhone: option.contactPhone ?? form.contactPhone,
              })
            }
          />
        </div>
        <div>
          <label className="form-label">E-mail do contato</label>
          <input
            type="email"
            className="form-control"
            value={form.contactEmail}
            onChange={(event) => update('contactEmail', event.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Telefone do contato</label>
          <PhoneInput
            className="form-control"
            value={form.contactPhone}
            onValueChange={(value) => update('contactPhone', value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="form-label">Prioridade</label>
          <select
            className="form-control"
            value={form.priorityId}
            onChange={(event) => update('priorityId', event.target.value)}
          >
            <option value="">Selecione…</option>
            {priorities.map((priority) => (
              <option key={priority.id} value={priority.id}>
                {priority.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="form-label">Tipos de projeto</span>
          <div className="grid max-h-36 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
            {projectTypes.map((projectType) => (
              <label
                key={projectType.id}
                className="flex items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-purple-50"
              >
                <input
                  type="checkbox"
                  checked={form.projectTypeIds.includes(projectType.id)}
                  onChange={(event) =>
                    update(
                      'projectTypeIds',
                      event.target.checked
                        ? [...form.projectTypeIds, projectType.id]
                        : form.projectTypeIds.filter((id) => id !== projectType.id),
                    )
                  }
                />
                {projectType.name}
              </label>
            ))}
            {projectTypes.length === 0 && (
              <p className="p-1.5 text-xs text-slate-400">Nenhum tipo cadastrado.</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="form-label">Descrição</label>
        <textarea
          className="form-control"
          rows={3}
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
          placeholder="Contexto da prospecção, dores identificadas, próximos passos…"
        />
      </div>

      <CustomFieldsFormSection
        values={form.customFieldValues}
        onChange={(values) => update('customFieldValues', values)}
      />
    </div>
  );
}
