import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { PhoneInput } from '../../components/MaskedInputs';
import { whatsappSettingsApi } from '../../lib/settingsApi';
const INITIAL = {
    enabled: false,
    apiVersion: 'v23.0',
    phoneNumberId: '',
    businessAccountId: '',
    accessToken: '',
    languageCode: 'pt_BR',
    testTemplate: 'hello_world',
    leadCreatedTemplate: '',
    leadStageTemplate: '',
    taskCreatedTemplate: '',
    taskUpdatedTemplate: '',
    testPhone: '',
    notifyLeadCreated: true,
    notifyLeadStageChanged: true,
    notifyTaskCreated: true,
    notifyTaskUpdated: true,
};
function toForm(item) {
    return {
        enabled: item.enabled,
        apiVersion: item.apiVersion,
        phoneNumberId: item.phoneNumberId,
        businessAccountId: item.businessAccountId,
        accessToken: '',
        languageCode: item.languageCode,
        testTemplate: item.testTemplate,
        leadCreatedTemplate: item.leadCreatedTemplate,
        leadStageTemplate: item.leadStageTemplate,
        taskCreatedTemplate: item.taskCreatedTemplate,
        taskUpdatedTemplate: item.taskUpdatedTemplate,
        testPhone: item.testPhone,
        notifyLeadCreated: item.notifyLeadCreated,
        notifyLeadStageChanged: item.notifyLeadStageChanged,
        notifyTaskCreated: item.notifyTaskCreated,
        notifyTaskUpdated: item.notifyTaskUpdated,
    };
}
export function WhatsAppSettingsPanel() {
    const [form, setForm] = useState(INITIAL);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState(null);
    useEffect(() => {
        whatsappSettingsApi
            .get()
            .then((item) => {
            setSettings(item);
            setForm(toForm(item));
        })
            .catch((error) => setMessage({
            type: 'error',
            text: error instanceof Error ? error.message : 'Erro ao carregar.',
        }))
            .finally(() => setLoading(false));
    }, []);
    function update(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }
    async function save(event) {
        event.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            const item = await whatsappSettingsApi.update(form);
            setSettings(item);
            setForm(toForm(item));
            setMessage({ type: 'success', text: 'Configuração do WhatsApp salva.' });
        }
        catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Erro ao salvar.',
            });
        }
        finally {
            setSaving(false);
        }
    }
    async function test() {
        setTesting(true);
        setMessage(null);
        try {
            const result = await whatsappSettingsApi.test();
            setMessage({ type: 'success', text: `Mensagem de teste enviada para ${result.recipient}.` });
        }
        catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Falha no teste.',
            });
        }
        finally {
            setTesting(false);
        }
    }
    if (loading)
        return _jsx("p", { className: "py-12 text-center text-sm text-slate-400", children: "Carregando configura\u00E7\u00E3o\u2026" });
    return (_jsxs("form", { onSubmit: save, className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading font-bold text-slate-800", children: "WhatsApp Business Cloud API" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Configura\u00E7\u00E3o preparada para a integra\u00E7\u00E3o oficial da Meta." })] }), _jsxs("label", { className: "flex items-center gap-3 font-semibold text-slate-700", children: [_jsx("input", { type: "checkbox", className: "h-5 w-5 accent-brand-purple", checked: form.enabled, onChange: (event) => update('enabled', event.target.checked) }), "Integra\u00E7\u00E3o ativa"] })] }), !form.enabled && (_jsx("div", { className: "rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-700", children: "A integra\u00E7\u00E3o est\u00E1 desativada. Voc\u00EA pode organizar e salvar os campos agora; nenhuma mensagem ser\u00E1 enviada at\u00E9 ativ\u00E1-la." })), message && (_jsx("div", { className: `rounded-xl border p-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'}`, children: message.text })), _jsxs("section", { children: [_jsx("h3", { className: "mb-4 font-heading font-bold text-slate-800", children: "Credenciais da Meta" }), _jsxs("div", { className: "grid gap-5 md:grid-cols-2", children: [_jsx(Field, { label: "Vers\u00E3o da Graph API", hint: "Exemplo: v23.0. Ajuste conforme a vers\u00E3o habilitada na Meta.", children: _jsx("input", { required: true, className: "form-control", value: form.apiVersion, onChange: (e) => update('apiVersion', e.target.value) }) }), _jsx(Field, { label: "Phone Number ID", children: _jsx("input", { className: "form-control", value: form.phoneNumberId, onChange: (e) => update('phoneNumberId', e.target.value) }) }), _jsx(Field, { label: "WhatsApp Business Account ID", children: _jsx("input", { className: "form-control", value: form.businessAccountId, onChange: (e) => update('businessAccountId', e.target.value) }) }), _jsx(Field, { label: "Token de acesso", hint: settings?.hasAccessToken
                                    ? 'Um token já está armazenado. Deixe vazio para mantê-lo.'
                                    : 'Use preferencialmente um token permanente de usuário do sistema.', children: _jsx("input", { type: "password", autoComplete: "new-password", className: "form-control", value: form.accessToken ?? '', onChange: (e) => update('accessToken', e.target.value), placeholder: settings?.hasAccessToken ? '••••••••••••••••' : 'Cole o token da Meta' }) })] })] }), _jsxs("section", { className: "border-t border-slate-100 pt-6", children: [_jsx("h3", { className: "mb-4 font-heading font-bold text-slate-800", children: "Templates aprovados" }), _jsxs("div", { className: "grid gap-5 md:grid-cols-2", children: [_jsx(Field, { label: "Idioma", children: _jsx("input", { required: true, className: "form-control", value: form.languageCode, onChange: (e) => update('languageCode', e.target.value) }) }), _jsx(Field, { label: "Template de teste", children: _jsx("input", { className: "form-control", value: form.testTemplate, onChange: (e) => update('testTemplate', e.target.value) }) }), _jsx(Field, { label: "Cria\u00E7\u00E3o de oportunidade", children: _jsx("input", { className: "form-control", value: form.leadCreatedTemplate, onChange: (e) => update('leadCreatedTemplate', e.target.value) }) }), _jsx(Field, { label: "Mudan\u00E7a de etapa", children: _jsx("input", { className: "form-control", value: form.leadStageTemplate, onChange: (e) => update('leadStageTemplate', e.target.value) }) }), _jsx(Field, { label: "Cria\u00E7\u00E3o de tarefa", children: _jsx("input", { className: "form-control", value: form.taskCreatedTemplate, onChange: (e) => update('taskCreatedTemplate', e.target.value) }) }), _jsx(Field, { label: "Altera\u00E7\u00E3o de tarefa", children: _jsx("input", { className: "form-control", value: form.taskUpdatedTemplate, onChange: (e) => update('taskUpdatedTemplate', e.target.value) }) })] })] }), _jsxs("section", { className: "border-t border-slate-100 pt-6", children: [_jsx("h3", { className: "mb-4 font-heading font-bold text-slate-800", children: "Eventos que enviar\u00E3o mensagens" }), _jsx("div", { className: "grid gap-3 sm:grid-cols-2", children: [
                            ['notifyLeadCreated', 'Novo Lead/Oportunidade'],
                            ['notifyLeadStageChanged', 'Mudança de etapa'],
                            ['notifyTaskCreated', 'Nova tarefa'],
                            ['notifyTaskUpdated', 'Alteração de tarefa'],
                        ].map(([key, label]) => (_jsxs("label", { className: "flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700", children: [_jsx("input", { type: "checkbox", className: "h-4 w-4 accent-brand-purple", checked: form[key], onChange: (e) => update(key, e.target.checked) }), label] }, key))) })] }), _jsx("section", { className: "border-t border-slate-100 pt-6", children: _jsx(Field, { label: "Telefone para teste", hint: "Informe DDI + DDD + n\u00FAmero, somente d\u00EDgitos. Exemplo: 5511999999999.", children: _jsx(PhoneInput, { className: "form-control", value: form.testPhone, onValueChange: (value) => update('testPhone', value) }) }) }), _jsxs("div", { className: "flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5", children: [_jsxs("button", { type: "button", className: "btn-secondary", disabled: testing || !settings?.enabled || !settings.hasAccessToken, onClick: test, children: [_jsx(Icon, { name: "mail", className: "h-4 w-4" }), testing ? 'Enviando…' : 'Enviar mensagem de teste'] }), _jsxs("button", { className: "btn-primary", disabled: saving, children: [_jsx(Icon, { name: "view", className: "h-4 w-4" }), saving ? 'Salvando…' : 'Salvar configuração'] })] })] }));
}
function Field({ label, hint, children }) {
    return (_jsxs("label", { children: [_jsx("span", { className: "form-label", children: label }), children, hint && _jsx("span", { className: "mt-1 block text-xs leading-5 text-slate-400", children: hint })] }));
}
