import { formatCurrency } from '../../lib/formatters';
import type { PricingParameter } from '../../types/settings';

export function formatPricingParameter({ value, format }: PricingParameter): string {
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent') {
    return `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  }
  if (format === 'factor') return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}x`;
  return value.toLocaleString('pt-BR');
}

/** Parâmetros de cálculo e notas de uma aba da planilha de precificação. */
export function PricingParameters({
  parameters,
  notes,
}: {
  parameters: PricingParameter[];
  notes: string[];
}) {
  if (!parameters.length && !notes.length) return null;
  const groups = [...new Set(parameters.map((parameter) => parameter.group))];
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm md:grid-cols-2">
      {groups.map((group) => (
        <div key={group ?? 'sem-grupo'}>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {group ?? 'Parâmetros'}
          </p>
          <dl className="space-y-1">
            {parameters
              .filter((parameter) => parameter.group === group)
              .map((parameter) => (
                <div key={parameter.label} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{parameter.label}</dt>
                  <dd className="whitespace-nowrap font-semibold text-slate-700">
                    {formatPricingParameter(parameter)}
                  </dd>
                </div>
              ))}
          </dl>
        </div>
      ))}
      {notes.length > 0 && (
        <ul className="space-y-1 text-xs text-slate-500 md:col-span-2">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
