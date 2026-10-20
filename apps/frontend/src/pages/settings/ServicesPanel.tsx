import { FormEvent, useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { CurrencyInput, DateInput } from '../../components/MaskedInputs';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { servicesApi } from '../../lib/settingsApi';
import type { ServiceBillingUnit, ServiceCatalogItem } from '../../types/settings';
import { PricingParameters } from './PricingParameters';
import { ServicesImportModal } from './ServicesImportModal';

export const SERVICE_UNIT_LABELS: Record<ServiceBillingUnit, string> = {
  MONTH: 'mês',
  HOUR: 'hora',
  ONE_TIME: 'único',
};

type MoneyField =
  | 'priceWithoutTax'
  | 'hardwareCost'
  | 'marginValue'
  | 'licenseCost'
  | 'setupPrivateCloudPrice'
  | 'setupOnPremisesPrice'
  | 'pocPrice';

type Draft = {
  name: string;
  description: string;
  price?: number;
  billingUnit: ServiceBillingUnit;
  tier: string;
  hardwareSpec: string;
  /** Percentual exibido no formulário (18 = 18%). */
  taxPercent: string;
  pocDays: string;
  priceReferenceDate?: string;
} & Partial<Record<MoneyField, number>>;

const emptyDraft: Draft = {
  name: '',
  description: '',
  price: undefined,
  billingUnit: 'MONTH',
  tier: '',
  hardwareSpec: '',
  taxPercent: '',
  pocDays: '',
};

/** Composição do preço recorrente. */
const PRICE_FIELDS: Array<[MoneyField, string]> = [
  ['priceWithoutTax', 'Preço descontando imposto'],
  ['hardwareCost', 'Custo do hardware'],
  ['marginValue', 'Margem de lucro'],
];

/** Cobranças únicas associadas ao serviço. */
const ONE_TIME_FIELDS: Array<[MoneyField, string]> = [
  ['licenseCost', 'Licença de compilação'],
  ['setupPrivateCloudPrice', 'Setup Private Cloud'],
  ['setupOnPremisesPrice', 'Setup On-premises'],
  ['pocPrice', 'PoC'],
];

const MONEY_FIELDS = [...PRICE_FIELDS, ...ONE_TIME_FIELDS].map(([field]) => field);

const toNumber = (value?: string | number | null) =>
  value === null || value === undefined || value === '' ? undefined : Number(value);

function draftFrom(item: ServiceCatalogItem): Draft {
  return {
    name: item.name,
    description: item.description ?? '',
    price: Number(item.price),
    billingUnit: item.billingUnit,
    tier: item.tier ?? '',
    hardwareSpec: item.hardwareSpec ?? '',
    taxPercent:
      item.taxRate === null || item.taxRate === undefined ? '' : String(Number(item.taxRate) * 100),
    pocDays: item.pocDays ? String(item.pocDays) : '',
    priceReferenceDate: item.priceReferenceDate?.slice(0, 10),
    ...Object.fromEntries(MONEY_FIELDS.map((field) => [field, toNumber(item[field])])),
  };
}

/** Campos vazios viram null para limpar o valor na edição. */
function payloadFrom(draft: Draft) {
  const percent = toNumber(draft.taxPercent.replace(',', '.'));
  return {
    name: draft.name,
    description: draft.description,
    price: draft.price,
    billingUnit: draft.billingUnit,
    tier: draft.tier.trim() || null,
    hardwareSpec: draft.hardwareSpec.trim() || null,
    taxRate: percent === undefined ? null : Math.round(percent * 100) / 10000,
    pocDays: toNumber(draft.pocDays) ?? null,
    priceReferenceDate: draft.priceReferenceDate || null,
    ...Object.fromEntries(MONEY_FIELDS.map((field) => [field, draft[field] ?? null])),
  } as unknown as Partial<ServiceCatalogItem>;
}

function OneTimeSummary({ item }: { item: ServiceCatalogItem }) {
  const entries = ONE_TIME_FIELDS.filter(
    ([field]) => item[field] !== null && item[field] !== undefined,
  );
  if (!entries.length) return <>—</>;
  return (
    <ul className="space-y-0.5 text-xs">
      {entries.map(([field, label]) => (
        <li key={field} className="whitespace-nowrap">
          <span className="text-slate-400">
            {label}
            {field === 'pocPrice' && item.pocDays ? ` (${item.pocDays} dias)` : ''}:
          </span>{' '}
          {formatCurrency(item[field])}
        </li>
      ))}
    </ul>
  );
}

export function ServicesPanel() {
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  async function refresh() {
    try {
      setItems(await servicesApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar serviços.');
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  function edit(item: ServiceCatalogItem) {
    setEditingId(item.id);
    setDraft(draftFrom(item));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.price === undefined) return setError('Informe o valor do serviço.');
    setError(null);
    try {
      if (editingId === 'new') await servicesApi.create(payloadFrom(draft));
      else if (editingId) await servicesApi.update(editingId, payloadFrom(draft));
      setEditingId(null);
      setDraft(emptyDraft);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar serviço.');
    }
  }

  async function archive(id: string) {
    if (
      !window.confirm('Arquivar este serviço? Os tipos de produto existentes manterão o vínculo.')
    )
      return;
    try {
      await servicesApi.archive(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao arquivar serviço.');
    }
  }

  const editingItem = items.find((item) => item.id === editingId);

  const moneyInput = ([field, label]: [MoneyField, string]) => (
    <div key={field}>
      <label className="form-label">{label}</label>
      <CurrencyInput
        className="form-control"
        value={draft[field]}
        onValueChange={(value) => setDraft({ ...draft, [field]: value })}
      />
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-brand-purple-dark">Serviços</h2>
          <p className="text-sm text-ink/70">
            Catálogo de serviços, preços e unidades de cobrança.
          </p>
        </div>
        {!editingId && (
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              onClick={() =>
                servicesApi
                  .downloadTemplate()
                  .catch((err) => setError(err instanceof Error ? err.message : String(err)))
              }
            >
              <Icon name="file" className="h-4 w-4" />
              Baixar modelo
            </button>
            <button className="btn-secondary" onClick={() => setIsImportOpen(true)}>
              <Icon name="upload" className="h-4 w-4" />
              Importar planilha
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setEditingId('new');
                setDraft(emptyDraft);
              }}
            >
              <Icon name="plus" className="h-4 w-4" />
              Novo serviço
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {notice}
          <button
            type="button"
            className="icon-button"
            onClick={() => setNotice(null)}
            aria-label="Fechar aviso"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </p>
      )}
      {isImportOpen && (
        <ServicesImportModal
          onClose={() => setIsImportOpen(false)}
          onImported={(message) => {
            setIsImportOpen(false);
            setNotice(message);
            refresh();
          }}
        />
      )}
      {editingId && (
        <form
          onSubmit={submit}
          className="mt-5 grid gap-4 rounded-2xl border border-brand-purple/15 bg-purple-50/30 p-5 md:grid-cols-2 xl:grid-cols-4"
        >
          <div className="md:col-span-2">
            <label className="form-label">Nome</label>
            <input
              required
              className="form-control"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Descrição</label>
            <input
              className="form-control"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Linha</label>
            <input
              className="form-control"
              value={draft.tier}
              onChange={(e) => setDraft({ ...draft, tier: e.target.value })}
              placeholder="Ex.: GOOD, BEST, TITAN"
            />
          </div>
          <div>
            <label className="form-label">Máquina / VRAM</label>
            <input
              className="form-control"
              value={draft.hardwareSpec}
              onChange={(e) => setDraft({ ...draft, hardwareSpec: e.target.value })}
              placeholder="Ex.: H100 PCIe — 80 GB"
            />
          </div>
          <div>
            <label className="form-label">Valor (preço final com imposto)</label>
            <CurrencyInput
              required
              className="form-control"
              value={draft.price}
              onValueChange={(price) => setDraft({ ...draft, price })}
            />
          </div>
          <div>
            <label className="form-label">Unidade de cobrança</label>
            <select
              className="form-control"
              value={draft.billingUnit}
              onChange={(e) =>
                setDraft({ ...draft, billingUnit: e.target.value as ServiceBillingUnit })
              }
            >
              <option value="MONTH">Por mês</option>
              <option value="HOUR">Por hora</option>
              <option value="ONE_TIME">Valor único</option>
            </select>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 md:col-span-2 xl:col-span-4">
            Composição do preço
          </h3>
          <div>
            <label className="form-label">Imposto sobre o preço final (%)</label>
            <input
              className="form-control"
              inputMode="decimal"
              value={draft.taxPercent}
              onChange={(e) => setDraft({ ...draft, taxPercent: e.target.value })}
              placeholder="Ex.: 18"
            />
          </div>
          {PRICE_FIELDS.map(moneyInput)}

          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 md:col-span-2 xl:col-span-4">
            Cobranças únicas
          </h3>
          {ONE_TIME_FIELDS.map(moneyInput)}
          <div>
            <label className="form-label">Duração da PoC (dias)</label>
            <input
              className="form-control"
              inputMode="numeric"
              value={draft.pocDays}
              onChange={(e) => setDraft({ ...draft, pocDays: e.target.value.replace(/\D/g, '') })}
            />
          </div>
          <div>
            <label className="form-label">Data de referência dos preços</label>
            <DateInput
              className="form-control"
              value={draft.priceReferenceDate}
              onValueChange={(priceReferenceDate) => setDraft({ ...draft, priceReferenceDate })}
            />
          </div>
          {editingItem?.pricingParameters?.map((tab) => (
            <div key={tab.sheet} className="md:col-span-2 xl:col-span-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Parâmetros da aba “{tab.sheet}”
                {editingItem.pricingSource ? ` · ${editingItem.pricingSource}` : ''}
              </h3>
              <PricingParameters parameters={tab.parameters} notes={tab.notes} />
            </div>
          ))}
          <div className="flex gap-2 md:col-span-2 xl:col-span-4">
            <button className="btn-primary">Salvar</button>
            <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
        <table className="data-table min-w-[1000px]">
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Valor</th>
              <th>Margem</th>
              <th>Cobranças únicas</th>
              <th>Tipos de produto</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="block font-semibold text-slate-800">{item.name}</span>
                  <span className="block text-xs text-slate-400">
                    {[item.tier, item.hardwareSpec].filter(Boolean).join(' · ') ||
                      item.description ||
                      '—'}
                  </span>
                  {item.priceReferenceDate && (
                    <span className="block text-[10px] text-slate-400">
                      Preços de {formatDate(item.priceReferenceDate)}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  {formatCurrency(item.price)}/{SERVICE_UNIT_LABELS[item.billingUnit]}
                  {item.taxRate !== null && item.taxRate !== undefined && (
                    <span className="block text-xs text-slate-400">
                      com {Math.round(Number(item.taxRate) * 100)}% de imposto
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  {item.marginValue !== null && item.marginValue !== undefined
                    ? formatCurrency(item.marginValue)
                    : '—'}
                  {item.hardwareCost !== null && item.hardwareCost !== undefined && (
                    <span className="block text-xs text-slate-400">
                      hardware {formatCurrency(item.hardwareCost)}
                    </span>
                  )}
                </td>
                <td>
                  <OneTimeSummary item={item} />
                </td>
                <td>{item._count?.projectTypes ?? 0}</td>
                <td className="whitespace-nowrap text-right">
                  <button className="icon-button" title="Editar" onClick={() => edit(item)}>
                    <Icon name="edit" className="h-4 w-4" />
                  </button>
                  <button
                    className="icon-button hover:!bg-red-50 hover:!text-red-600"
                    title="Arquivar"
                    onClick={() => archive(item.id)}
                  >
                    <Icon name="archive" className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6} className="text-center text-sm text-slate-500">
                  Nenhum serviço cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
