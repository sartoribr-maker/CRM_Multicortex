import { formatCurrency } from '../../lib/formatters';
import { SERVICE_UNIT_LABELS } from '../../pages/settings/ServicesPanel';
import type { ProjectType, ServiceCatalogItem } from '../../types/settings';

/** Cobranças únicas exibidas abaixo de cada plano (custos internos e margem ficam de fora). */
const ONE_TIME_CHARGES: Array<[keyof ServiceCatalogItem, string]> = [
  ['licenseCost', 'Licença'],
  ['setupPrivateCloudPrice', 'Setup Private Cloud'],
  ['setupOnPremisesPrice', 'Setup On-premises'],
  ['pocPrice', 'PoC'],
];

/** Planos sem linha comercial ficam num grupo sem título. */
function groupByTier(services: ServiceCatalogItem[]) {
  const groups = new Map<string, ServiceCatalogItem[]>();
  for (const service of services) {
    const tier = service.tier?.trim() ?? '';
    groups.set(tier, [...(groups.get(tier) ?? []), service]);
  }
  return [...groups.entries()];
}

function PlanCard({ service }: { service: ServiceCatalogItem }) {
  const charges = ONE_TIME_CHARGES.filter(
    ([field]) => service[field] !== null && service[field] !== undefined,
  );
  return (
    <li className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm font-semibold text-slate-700">
          {service.hardwareSpec || service.name}
        </span>
        <span className="shrink-0 whitespace-nowrap text-sm font-bold text-brand-purple-dark">
          {formatCurrency(service.price)}
          <span className="text-xs font-medium text-slate-400">
            /{SERVICE_UNIT_LABELS[service.billingUnit]}
          </span>
        </span>
      </div>
      {charges.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-dashed border-slate-200 pt-2 text-[11px]">
          {charges.map(([field, label]) => (
            <div key={field} className="flex justify-between gap-2">
              <dt className="text-slate-400">
                {label}
                {field === 'pocPrice' && service.pocDays ? ` (${service.pocDays} dias)` : ''}
              </dt>
              <dd className="whitespace-nowrap font-medium text-slate-600">
                {formatCurrency(service[field] as string | number)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

/**
 * Catálogo dos planos dos tipos de produto selecionados na oportunidade:
 * cada serviço é uma opção de assinatura, por isso não há totalização.
 */
export function ProductPlansPanel({ projectTypes }: { projectTypes: ProjectType[] }) {
  if (!projectTypes.length) {
    return (
      <div className="flex min-h-[7.5rem] items-center justify-center rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
        Selecione um tipo de produto para ver os planos e valores.
      </div>
    );
  }

  return (
    <div className="max-h-[28rem] space-y-4 overflow-y-auto rounded-xl border border-brand-purple/20 bg-gradient-to-br from-purple-50 to-white p-4">
      {projectTypes.map((projectType) => {
        const services = projectType.services.map(({ service }) => service);
        return (
          <section key={projectType.id}>
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-bold text-brand-purple-dark">{projectType.name}</h4>
              <span className="text-[11px] text-slate-400">
                {services.length ? `${services.length} plano(s)` : 'Sem planos vinculados'}
              </span>
            </div>
            <div className="mt-2 space-y-3">
              {groupByTier(services).map(([tier, items]) => (
                <div key={tier || 'sem-linha'}>
                  {tier && (
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      {tier}
                    </p>
                  )}
                  <ul className="space-y-1.5">
                    {items.map((service) => (
                      <PlanCard key={service.id} service={service} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
