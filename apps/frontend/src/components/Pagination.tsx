import { Icon } from './Icon';

export const PAGE_SIZE_STEP = 10;
export const PAGE_SIZE_MIN = 10;
// Limite aceito pelo backend (@Max(100) nos DTOs de listagem).
export const PAGE_SIZE_MAX = 100;

export function clampPageSize(value: number) {
  const rounded = Math.round(value / PAGE_SIZE_STEP) * PAGE_SIZE_STEP;
  return Math.min(PAGE_SIZE_MAX, Math.max(PAGE_SIZE_MIN, rounded || PAGE_SIZE_MIN));
}

/** Contador com − e + para escolher quantos registros exibir por página. */
export function PageSizeStepper({
  pageSize,
  onChange,
  label = 'Exibir',
}: {
  pageSize: number;
  onChange: (pageSize: number) => void;
  label?: string;
}) {
  const btn =
    'flex h-9 w-9 items-center justify-center text-lg font-bold text-slate-600 transition hover:bg-purple-50 hover:text-brand-purple disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-600';
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500">
      <span>{label}</span>
      <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          className={btn}
          aria-label="Exibir menos registros"
          title="Exibir menos"
          disabled={pageSize <= PAGE_SIZE_MIN}
          onClick={() => onChange(clampPageSize(pageSize - PAGE_SIZE_STEP))}
        >
          −
        </button>
        <span
          className="min-w-[3rem] border-x border-slate-200 px-2 text-center font-semibold text-slate-800"
          aria-live="polite"
        >
          {pageSize}
        </span>
        <button
          type="button"
          className={btn}
          aria-label="Exibir mais registros"
          title="Exibir mais"
          disabled={pageSize >= PAGE_SIZE_MAX}
          onClick={() => onChange(clampPageSize(pageSize + PAGE_SIZE_STEP))}
        >
          +
        </button>
      </div>
      <span>por página</span>
    </div>
  );
}

function pageWindow(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= totalPages - 2)
    [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('…');
    result.push(p);
  });
  return result;
}

/** Paginador de rodapé: intervalo exibido, anterior/próxima e números de página. */
export function Paginator({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
      <span>
        {from}–{to} de {total} · Página {page} de {totalPages}
      </span>
      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center gap-1" aria-label="Paginação">
          <button
            type="button"
            className="btn-secondary !h-9 !px-3"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <Icon name="chevron-left" className="h-4 w-4" />
            Anterior
          </button>
          {pageWindow(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === page ? 'page' : undefined}
                className={`h-9 min-w-[2.25rem] rounded-xl border px-2 font-semibold transition ${
                  p === page
                    ? 'border-brand-purple bg-brand-purple text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-purple/60 hover:text-brand-purple'
                }`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            className="btn-secondary !h-9 !px-3"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Próxima
            <Icon name="chevron-right" className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
