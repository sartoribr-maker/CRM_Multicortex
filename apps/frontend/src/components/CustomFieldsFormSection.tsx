import { useEffect, useState } from 'react';
import { customFieldsApi } from '../lib/settingsApi';
import type { CustomField } from '../types/settings';
import type { CustomFieldValueInput } from '../lib/leadsApi';
import { CurrencyInput, DateInput } from './MaskedInputs';

interface CustomFieldsFormSectionProps {
  values: CustomFieldValueInput[];
  onChange: (values: CustomFieldValueInput[]) => void;
}

const inputClass = 'form-control';

export function CustomFieldsFormSection({ values, onChange }: CustomFieldsFormSectionProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    customFieldsApi
      .list()
      .then((all) => setFields(all.filter((field) => field.showInForm)))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return null;
  if (fields.length === 0) return null;

  function getValue(fieldId: string) {
    return values.find((v) => v.customFieldId === fieldId)?.value;
  }

  function setValue(fieldId: string, value: unknown) {
    const next = values.filter((v) => v.customFieldId !== fieldId);
    next.push({ customFieldId: fieldId, value });
    onChange(next);
  }

  return (
    <section className="form-section">
      <div className="form-section-header">
        <h3 className="font-heading text-base font-bold text-slate-800">Campos personalizados</h3>
        <p className="mt-1 text-xs text-slate-400">
          Informações adicionais configuradas para sua operação.
        </p>
      </div>
      <div className="form-section-body">
        {fields.map((field) => {
          const value = getValue(field.id);
          const label = `${field.name}${field.isRequired ? ' *' : ''}`;

          if (field.type === 'BOOLEAN') {
            return (
              <label key={field.id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => setValue(field.id, e.target.checked)}
                />
                {label}
              </label>
            );
          }

          if (field.type === 'SINGLE_SELECT') {
            return (
              <div key={field.id}>
                <label className="form-label">{label}</label>
                <select
                  required={field.isRequired}
                  className={inputClass}
                  value={(value as string) ?? ''}
                  onChange={(e) => setValue(field.id, e.target.value)}
                >
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          if (field.type === 'MULTI_SELECT') {
            const selected = Array.isArray(value) ? (value as string[]) : [];
            return (
              <div key={field.id}>
                <label className="form-label">{label}</label>
                <div className="flex flex-wrap gap-3">
                  {(field.options ?? []).map((option) => (
                    <label key={option} className="flex items-center gap-1.5 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={selected.includes(option)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...selected, option]
                            : selected.filter((o) => o !== option);
                          setValue(field.id, next);
                        }}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>
            );
          }

          if (field.type === 'DATE') {
            return (
              <div key={field.id}>
                <label className="form-label">{label}</label>
                <DateInput
                  required={field.isRequired}
                  className={inputClass}
                  value={(value as string) ?? ''}
                  onValueChange={(next) => setValue(field.id, next ?? '')}
                />
              </div>
            );
          }

          if (field.type === 'CURRENCY') {
            return (
              <div key={field.id}>
                <label className="form-label">{label}</label>
                <CurrencyInput
                  required={field.isRequired}
                  className={inputClass}
                  value={value === null || value === undefined ? undefined : Number(value)}
                  onValueChange={(next) => setValue(field.id, next ?? '')}
                />
              </div>
            );
          }

          if (field.type === 'NUMBER') {
            return (
              <div key={field.id}>
                <label className="form-label">{label}</label>
                <input
                  type="number"
                  required={field.isRequired}
                  className={inputClass}
                  value={typeof value === 'number' ? value : ''}
                  onChange={(e) =>
                    setValue(field.id, e.target.value === '' ? undefined : Number(e.target.value))
                  }
                />
              </div>
            );
          }

          return (
            <div key={field.id}>
              <label className="form-label">{label}</label>
              <input
                type="text"
                required={field.isRequired}
                className={inputClass}
                value={(value as string) ?? ''}
                onChange={(e) => setValue(field.id, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
