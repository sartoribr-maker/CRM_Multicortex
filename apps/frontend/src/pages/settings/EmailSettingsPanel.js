import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { emailSettingsApi } from '../../lib/settingsApi';
const INITIAL_FORM = {
    enabled: false,
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    username: 'sartori.br@gmail.com',
    password: '',
    fromEmail: 'sartori.br@gmail.com',
    fromName: 'Multicortex CRM',
};
function settingsToForm(settings) {
    return {
        enabled: settings.enabled,
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        username: settings.username,
        password: '',
        fromEmail: settings.fromEmail,
        fromName: settings.fromName,
    };
}
export function EmailSettingsPanel() {
    const [form, setForm] = useState(INITIAL_FORM);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState(null);
    useEffect(() => {
        emailSettingsApi
            .get()
            .then((data) => {
            setSettings(data);
            setForm(settingsToForm(data));
        })
            .catch((error) => setMessage({
            type: 'error',
            text: error instanceof Error ? error.message : 'Erro ao carregar a configuração.',
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
            const updated = await emailSettingsApi.update(form);
            setSettings(updated);
            setForm(settingsToForm(updated));
            setMessage({ type: 'success', text: 'Configuração de e-mail salva com sucesso.' });
        }
        catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Erro ao salvar a configuração.',
            });
        }
        finally {
            setSaving(false);
        }
    }
    async function testEmail() {
        setTesting(true);
        setMessage(null);
        try {
            const result = await emailSettingsApi.test();
            setMessage({ type: 'success', text: `E-mail de teste enviado para ${result.recipient}.` });
        }
        catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Falha ao enviar o teste.',
            });
        }
        finally {
            setTesting(false);
        }
    }
    if (loading)
        return _jsx("p", { className: "py-12 text-center text-sm text-slate-400", children: "Carregando configura\u00E7\u00E3o\u2026" });
    return (_jsxs("form", { onSubmit: save, className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading font-bold text-slate-800", children: "Notifica\u00E7\u00F5es autom\u00E1ticas" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Envia avisos aos respons\u00E1veis por oportunidades e tarefas." })] }), _jsxs("label", { className: "flex items-center gap-3 font-semibold text-slate-700", children: [_jsx("input", { type: "checkbox", checked: form.enabled, onChange: (event) => update('enabled', event.target.checked), className: "h-5 w-5 accent-brand-purple" }), "Envio ativo"] })] }), message && (_jsx("div", { className: `rounded-xl border p-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'}`, children: message.text })), _jsxs("div", { className: "grid gap-5 md:grid-cols-2", children: [_jsx(Field, { label: "Servidor SMTP", children: _jsx("input", { required: true, className: "form-control", value: form.host, onChange: (event) => update('host', event.target.value) }) }), _jsx(Field, { label: "Porta", children: _jsx("input", { required: true, type: "number", min: 1, max: 65535, className: "form-control", value: form.port, onChange: (event) => update('port', Number(event.target.value)) }) }), _jsx(Field, { label: "Usu\u00E1rio / e-mail", children: _jsx("input", { required: true, type: "email", autoComplete: "username", className: "form-control", value: form.username, onChange: (event) => update('username', event.target.value) }) }), _jsx(Field, { label: "Senha de aplicativo", hint: settings?.hasPassword
                            ? 'Uma senha já está cadastrada. Deixe vazio para mantê-la.'
                            : 'No Gmail, utilize uma senha de aplicativo de 16 caracteres.', children: _jsx("input", { type: "password", autoComplete: "new-password", className: "form-control", value: form.password ?? '', onChange: (event) => update('password', event.target.value), placeholder: settings?.hasPassword ? '••••••••••••••••' : 'Informe a senha de aplicativo' }) }), _jsx(Field, { label: "E-mail remetente", children: _jsx("input", { required: true, type: "email", className: "form-control", value: form.fromEmail, onChange: (event) => update('fromEmail', event.target.value) }) }), _jsx(Field, { label: "Nome do remetente", children: _jsx("input", { required: true, className: "form-control", value: form.fromName, onChange: (event) => update('fromName', event.target.value) }) })] }), _jsxs("label", { className: "flex items-center gap-3 text-sm font-semibold text-slate-700", children: [_jsx("input", { type: "checkbox", checked: form.secure, onChange: (event) => update('secure', event.target.checked), className: "h-4 w-4 accent-brand-purple" }), "Conex\u00E3o SSL direta (normalmente ativa na porta 465; deixe desmarcada para Gmail na porta 587)"] }), _jsxs("div", { className: "flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5", children: [_jsxs("button", { type: "button", className: "btn-secondary", disabled: testing || !settings?.hasPassword || !settings.enabled, onClick: testEmail, children: [_jsx(Icon, { name: "mail", className: "h-4 w-4" }), testing ? 'Enviando…' : 'Enviar e-mail de teste'] }), _jsxs("button", { className: "btn-primary", disabled: saving, children: [_jsx(Icon, { name: "view", className: "h-4 w-4" }), saving ? 'Salvando…' : 'Salvar configuração'] })] })] }));
}
function Field({ label, hint, children }) {
    return (_jsxs("label", { children: [_jsx("span", { className: "form-label", children: label }), children, hint && _jsx("span", { className: "mt-1 block text-xs leading-5 text-slate-400", children: hint })] }));
}
