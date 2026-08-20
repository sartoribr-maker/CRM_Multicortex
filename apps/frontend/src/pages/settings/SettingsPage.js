import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { AppShell, PageHeader } from '../../components/AppShell';
import { CurrencyInput } from '../../components/MaskedInputs';
import { formatCurrency } from '../../lib/formatters';
import { ColorOrderedListPanel } from './ColorOrderedListPanel';
import { SimpleCatalogPanel } from './SimpleCatalogPanel';
import { CustomFieldsPanel } from './CustomFieldsPanel';
import { EmailSettingsPanel } from './EmailSettingsPanel';
import { WhatsAppSettingsPanel } from './WhatsAppSettingsPanel';
import { ServicesPanel } from './ServicesPanel';
import { ProductTypesPanel } from './ProductTypesPanel';
import { stagesApi, prioritiesApi, dealSizesApi, sourcesApi, segmentsApi, } from '../../lib/settingsApi';
const SECTIONS = {
    stages: {
        title: 'Etapas do Funil',
        description: 'Configure as colunas e regras de fechamento do pipeline comercial.',
    },
    priorities: {
        title: 'Prioridades',
        description: 'Configure os níveis de urgência das oportunidades.',
    },
    dealSizes: {
        title: 'Portes do Negócio',
        description: 'Configure as faixas de valor usadas na classificação comercial.',
    },
    sources: {
        title: 'Origens do Lead',
        description: 'Configure os canais de entrada das oportunidades.',
    },
    segments: {
        title: 'Segmentos de Mercado',
        description: 'Mantenha as opções disponíveis no cadastro de empresas e oportunidades.',
    },
    projectTypes: {
        title: 'Tipos de Produto',
        description: 'Configure os produtos vendidos e os serviços embarcados.',
    },
    services: {
        title: 'Serviços',
        description: 'Cadastre os serviços, seus valores e unidades de cobrança.',
    },
    customFields: {
        title: 'Campos Personalizados',
        description: 'Configure informações adicionais para o cadastro de leads.',
    },
    email: {
        title: 'Configuração de E-mail',
        description: 'Configure o servidor e teste as notificações automáticas do CRM.',
    },
    whatsapp: {
        title: 'Configuração do WhatsApp',
        description: 'Prepare a futura integração com o WhatsApp Business Cloud da Meta.',
    },
};
export default function SettingsPage({ section }) {
    const page = SECTIONS[section];
    return (_jsx(AppShell, { children: _jsxs("div", { className: "mx-auto max-w-6xl", children: [_jsx(PageHeader, { eyebrow: "Configura\u00E7\u00F5es", title: page.title, description: page.description }), _jsxs("div", { className: "card p-5 md:p-7", children: [section === 'stages' && (_jsx(ColorOrderedListPanel, { title: "Etapas do Funil", description: "Colunas do Kanban de vendas, na ordem em que aparecem.", itemNoun: "etapa", api: stagesApi, emptyDraft: { name: '', color: '#74529F', isWonStage: false, isLostStage: false }, renderExtraFormFields: (draft, setDraft) => (_jsxs("div", { className: "flex gap-4 text-sm text-ink", children: [_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: draft.isWonStage ?? false, onChange: (e) => setDraft({ isWonStage: e.target.checked }) }), "Etapa de ganho"] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: draft.isLostStage ?? false, onChange: (e) => setDraft({ isLostStage: e.target.checked }) }), "Etapa de perda"] })] })), renderExtraColumns: (item) => (_jsxs(_Fragment, { children: [item.isWonStage && (_jsx("span", { className: "text-xs font-semibold text-success", children: "GANHO" })), item.isLostStage && (_jsx("span", { className: "text-xs font-semibold text-danger", children: "PERDIDO" }))] })) })), section === 'priorities' && (_jsx(ColorOrderedListPanel, { title: "Prioridades", description: "N\u00EDvel de urg\u00EAncia atribu\u00EDdo a cada oportunidade.", itemNoun: "prioridade", api: prioritiesApi, emptyDraft: { name: '', color: '#EAC634' } })), section === 'dealSizes' && (_jsx(ColorOrderedListPanel, { title: "Porte do Neg\u00F3cio", description: "Faixas de valor estimado usadas para classificar oportunidades.", itemNoun: "porte", api: dealSizesApi, emptyDraft: { name: '', color: '#4A80C0', minValue: null, maxValue: null }, renderExtraFormFields: (draft, setDraft) => (_jsxs("div", { className: "flex gap-3", children: [_jsxs("div", { className: "flex-1", children: [_jsx("label", { className: "mb-1 block text-sm font-medium text-ink", children: "Valor m\u00EDnimo (R$)" }), _jsx(CurrencyInput, { className: "w-full rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple", value: draft.minValue === null ? undefined : Number(draft.minValue), onValueChange: (value) => setDraft({ minValue: value ?? null }) })] }), _jsxs("div", { className: "flex-1", children: [_jsx("label", { className: "mb-1 block text-sm font-medium text-ink", children: "Valor m\u00E1ximo (R$, opcional)" }), _jsx(CurrencyInput, { className: "w-full rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple", value: draft.maxValue === null ? undefined : Number(draft.maxValue), onValueChange: (value) => setDraft({ maxValue: value ?? null }) })] })] })), renderExtraColumns: (item) => (_jsxs("span", { className: "text-xs text-ink/60", children: [item.minValue !== null ? formatCurrency(item.minValue) : formatCurrency(0), " \u2014", ' ', item.maxValue !== null ? formatCurrency(item.maxValue) : 'sem limite'] })) })), section === 'sources' && (_jsx(SimpleCatalogPanel, { title: "Origem do Lead", description: "De onde o lead veio (indica\u00E7\u00E3o, site, evento, etc.).", itemNoun: "origem", api: sourcesApi, emptyDraft: { name: '', description: '' } })), section === 'segments' && (_jsx(SimpleCatalogPanel, { title: "Segmentos de Mercado", description: "Principais setores de atua\u00E7\u00E3o dos clientes e prospects.", itemNoun: "segmento", api: segmentsApi, emptyDraft: { name: '', description: '' } })), section === 'projectTypes' && _jsx(ProductTypesPanel, {}), section === 'services' && _jsx(ServicesPanel, {}), section === 'customFields' && _jsx(CustomFieldsPanel, {}), section === 'email' && _jsx(EmailSettingsPanel, {}), section === 'whatsapp' && _jsx(WhatsAppSettingsPanel, {})] })] }) }));
}
