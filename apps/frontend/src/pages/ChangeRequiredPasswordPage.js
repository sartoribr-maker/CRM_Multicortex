import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { apiJson } from '../lib/api';
export default function ChangeRequiredPasswordPage() {
    const location = useLocation();
    const changeToken = location.state?.changeToken;
    const [newPassword, setNewPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [saving, setSaving] = useState(false);
    if (!changeToken && !success)
        return _jsx(Navigate, { to: "/login", replace: true });
    async function submit(event) {
        event.preventDefault();
        setError(null);
        if (newPassword !== confirmation) {
            setError('As senhas não coincidem.');
            return;
        }
        setSaving(true);
        try {
            await apiJson('/auth/change-required-password', {
                method: 'POST',
                body: JSON.stringify({ changeToken, newPassword }),
            });
            setSuccess(true);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível alterar a senha.');
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsx(AuthLayout, { title: "Crie uma nova senha", subtitle: "A troca \u00E9 obrigat\u00F3ria antes de acessar o CRM", children: success ? (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("p", { className: "rounded-card bg-green-50 px-3 py-2 text-sm text-green-700", children: "Senha alterada com sucesso." }), _jsx(Link, { to: "/login", className: "btn-primary text-center", children: "Entrar com a nova senha" })] })) : (_jsxs("form", { className: "flex flex-col gap-4", onSubmit: submit, children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "new-password", className: "form-label", children: "Nova senha" }), _jsx("input", { id: "new-password", type: "password", required: true, minLength: 8, autoComplete: "new-password", className: "form-control", value: newPassword, onChange: (e) => setNewPassword(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "password-confirmation", className: "form-label", children: "Confirmar nova senha" }), _jsx("input", { id: "password-confirmation", type: "password", required: true, minLength: 8, autoComplete: "new-password", className: "form-control", value: confirmation, onChange: (e) => setConfirmation(e.target.value) })] }), error && _jsx("p", { className: "rounded-card bg-danger/10 px-3 py-2 text-sm text-danger", children: error }), _jsx("button", { type: "submit", disabled: saving, className: "btn-primary mt-2 w-full", children: saving ? 'Salvando…' : 'Alterar senha' })] })) }));
}
