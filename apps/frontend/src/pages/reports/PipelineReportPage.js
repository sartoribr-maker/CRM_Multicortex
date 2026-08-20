import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { formatCurrency } from '../../lib/formatters';
import { leadsApi } from '../../lib/leadsApi';
import { stagesApi } from '../../lib/settingsApi';
const numberValue = (value) => Number(value ?? 0);
export default function PipelineReportPage() {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [stages, setStages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        Promise.all([leadsApi.list({ page: 1, pageSize: 100 }), stagesApi.list()])
            .then(async ([firstPage, stageItems]) => {
            const remainingPages = Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) => leadsApi.list({ page: index + 2, pageSize: 100 }));
            const remaining = await Promise.all(remainingPages);
            setLeads([firstPage, ...remaining].flatMap((page) => page.items));
            setStages(stageItems);
        })
            .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar relatório.'))
            .finally(() => setLoading(false));
    }, []);
    const totals = useMemo(() => leads.reduce((result, lead) => ({
        capex: result.capex + numberValue(lead.capexValue),
        monthlyOpex: result.monthlyOpex + numberValue(lead.opexValue),
        estimated: result.estimated + numberValue(lead.estimatedValue),
    }), { capex: 0, monthlyOpex: 0, estimated: 0 }), [leads]);
    const pipeline = useMemo(() => stages.map((stage) => {
        const items = leads.filter((lead) => lead.stage.id === stage.id);
        return {
            stage,
            items,
            estimated: items.reduce((sum, lead) => sum + numberValue(lead.estimatedValue), 0),
        };
    }), [leads, stages]);
    return (_jsxs(AppShell, { children: [_jsx(PageHeader, { eyebrow: "Vis\u00F5es e relat\u00F3rios", title: "Pipeline de oportunidades", description: "Vis\u00E3o consolidada de todos os leads e seus valores por etapa comercial." }), error && _jsx("p", { className: "mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-600", children: error }), loading ? (_jsx("p", { className: "card p-12 text-center text-sm text-slate-400", children: "Carregando pipeline\u2026" })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(Summary, { label: "Oportunidades", value: String(leads.length) }), _jsx(Summary, { label: "CAPEX total", value: formatCurrency(totals.capex) }), _jsx(Summary, { label: "OPEX mensal", value: formatCurrency(totals.monthlyOpex) }), _jsx(Summary, { label: "Valor estimado", value: formatCurrency(totals.estimated) })] }), _jsxs("section", { className: "card mt-5 p-5 md:p-6", children: [_jsxs("div", { className: "mb-5", children: [_jsx("h2", { className: "font-heading font-bold text-slate-800", children: "Distribui\u00E7\u00E3o por etapa" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Quantidade e participa\u00E7\u00E3o no valor total do pipeline." })] }), _jsx("div", { className: "space-y-5", children: pipeline.map(({ stage, items, estimated }) => {
                                    const percentage = totals.estimated ? (estimated / totals.estimated) * 100 : 0;
                                    return (_jsxs("button", { className: "block w-full text-left", onClick: () => navigate(`/leads?stageId=${stage.id}`), children: [_jsxs("div", { className: "mb-2 flex flex-wrap justify-between gap-2 text-sm", children: [_jsxs("span", { className: "font-semibold text-slate-700", children: [stage.name, " ", _jsx("span", { className: "ml-1 text-slate-400", children: items.length })] }), _jsx("span", { className: "font-bold text-slate-700", children: formatCurrency(estimated) })] }), _jsx("div", { className: "h-2.5 overflow-hidden rounded-full bg-slate-100", children: _jsx("div", { className: "h-full rounded-full", style: { width: `${Math.max(percentage, items.length ? 1 : 0)}%`, backgroundColor: stage.color } }) })] }, stage.id));
                                }) })] }), _jsxs("section", { className: "table-shell mt-5 overflow-x-auto", children: [_jsx("div", { className: "border-b border-slate-100 px-5 py-4", children: _jsx("h2", { className: "font-heading font-bold text-slate-800", children: "Todas as oportunidades" }) }), _jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Oportunidade" }), _jsx("th", { children: "Etapa" }), _jsx("th", { children: "Probabilidade" }), _jsx("th", { children: "Parceiro" }), _jsx("th", { className: "text-right", children: "CAPEX" }), _jsx("th", { className: "text-right", children: "OPEX" }), _jsx("th", { className: "text-right", children: "Total" })] }) }), _jsx("tbody", { children: leads.map((lead) => (_jsxs("tr", { className: "cursor-pointer", onClick: () => navigate(`/leads/${lead.id}`), children: [_jsxs("td", { children: [_jsx("p", { className: "font-semibold text-slate-800", children: lead.name }), _jsx("p", { className: "text-xs text-slate-400", children: lead.companyName ?? 'Empresa não informada' })] }), _jsx("td", { children: _jsx("span", { className: "whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold text-white", style: { backgroundColor: lead.stage.color }, children: lead.stage.name }) }), _jsx("td", { children: lead.successProbability === null ? '—' : `${lead.successProbability}%` }), _jsx("td", { children: lead.partner?.name ?? '—' }), _jsx("td", { className: "text-right", children: formatCurrency(lead.capexValue) }), _jsx("td", { className: "text-right", children: formatCurrency(lead.opexValue) }), _jsx("td", { className: "text-right font-bold text-slate-800", children: formatCurrency(lead.estimatedValue) })] }, lead.id))) })] })] })] }))] }));
}
function Summary({ label, value }) {
    return _jsxs("div", { className: "card p-5", children: [_jsx("p", { className: "text-xs font-semibold text-slate-400", children: label }), _jsx("p", { className: "mt-2 text-xl font-bold text-slate-900", children: value })] });
}
