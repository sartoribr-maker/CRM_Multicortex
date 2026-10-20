import type { LeadAutocompleteOption } from '../lib/leadsApi';
import { Icon } from './Icon';
import { PhoneInput } from './MaskedInputs';

export type CompanyExtraField =
  | 'companyLocation'
  | 'companyLinkedinUrl'
  | 'companyWebsite'
  | 'companyPhone'
  | 'companySizeEstimate'
  | 'companyRevenue'
  | 'companyEmployeeCount';

export type ContactExtraField = 'contactPosition' | 'contactLinkedinUrl';

type ExtraField = CompanyExtraField | ContactExtraField;

interface FieldDefinition<K extends ExtraField> {
  key: K;
  label: string;
  kind?: 'url' | 'phone';
  /** Mostra o ícone que abre o endereço preenchido em nova aba. */
  linkable?: boolean;
}

/** Endereço externo seguro para abrir: só http(s); sem protocolo, assume https. */
export function externalHref(value?: string | null): string | null {
  const text = value?.trim();
  if (!text) return null;
  const href = /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Abre em nova aba o primeiro endereço válido; sem nenhum, não faz nada. */
export function openFirstExternalLink(...values: Array<string | null | undefined>): void {
  const href = values.map(externalHref).find(Boolean);
  if (href) window.open(href, '_blank', 'noopener,noreferrer');
}

export function ExternalLinkIcon({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center text-slate-400 transition hover:text-brand-purple"
      title={label}
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
    >
      <Icon name="external" className="h-4 w-4" />
    </a>
  );
}

export const COMPANY_EXTRA_FIELDS: FieldDefinition<CompanyExtraField>[] = [
  { key: 'companyLocation', label: 'Localização' },
  { key: 'companyWebsite', label: 'Site', kind: 'url' },
  { key: 'companyLinkedinUrl', label: 'LinkedIn da empresa', kind: 'url', linkable: true },
  { key: 'companyPhone', label: 'Telefone da empresa', kind: 'phone' },
  { key: 'companySizeEstimate', label: 'Porte / Faturamento estimado' },
  { key: 'companyRevenue', label: 'Faturamento' },
  { key: 'companyEmployeeCount', label: 'Qtde. de funcionários' },
];

export const CONTACT_EXTRA_FIELDS: FieldDefinition<ContactExtraField>[] = [
  { key: 'contactPosition', label: 'Cargo' },
  { key: 'contactLinkedinUrl', label: 'LinkedIn do contato', kind: 'url', linkable: true },
];

/** Campos complementares da empresa vindos de uma sugestão do autocomplete. */
export function companyExtrasFrom(
  option: LeadAutocompleteOption,
): Partial<Record<CompanyExtraField, string>> {
  return Object.fromEntries(
    COMPANY_EXTRA_FIELDS.flatMap(({ key }) => (option[key] ? [[key, option[key]]] : [])),
  );
}

/** Campos complementares do contato vindos de uma sugestão do autocomplete. */
export function contactExtrasFrom(
  option: LeadAutocompleteOption,
): Partial<Record<ContactExtraField, string>> {
  return Object.fromEntries(
    CONTACT_EXTRA_FIELDS.flatMap(({ key }) => (option[key] ? [[key, option[key]]] : [])),
  );
}

interface LeadPartyExtraFieldsProps<K extends ExtraField> {
  fields: FieldDefinition<K>[];
  values: Partial<Record<K, string | null>>;
  onChange: (key: K, value: string) => void;
  labelClassName?: string;
  inputClassName?: string;
}

/** Campos complementares de empresa ou contato nos formulários de oportunidade. */
export function LeadPartyExtraFields<K extends ExtraField>({
  fields,
  values,
  onChange,
  labelClassName = 'form-label',
  inputClassName = 'form-control',
}: LeadPartyExtraFieldsProps<K>) {
  return (
    <>
      {fields.map(({ key, label, kind, linkable }) => {
        const href = linkable ? externalHref(values[key]) : null;
        return (
          <div key={key}>
            <label className={labelClassName}>{label}</label>
            {kind === 'phone' ? (
              <PhoneInput
                className={inputClassName}
                value={values[key] ?? ''}
                onValueChange={(value) => onChange(key, value ?? '')}
              />
            ) : (
              <div className="relative">
                <input
                  inputMode={kind === 'url' ? 'url' : undefined}
                  className={`${inputClassName} ${linkable ? '!pr-10' : ''}`}
                  value={values[key] ?? ''}
                  onChange={(event) => onChange(key, event.target.value)}
                  placeholder={kind === 'url' ? 'https://' : undefined}
                />
                {href && (
                  <span className="absolute inset-y-0 right-3 flex items-center">
                    <ExternalLinkIcon href={href} label={`Abrir ${label}`} />
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
