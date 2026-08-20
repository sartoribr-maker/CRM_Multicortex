import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { apiJson } from '../lib/api';
const inputClass = 'w-full rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple';
export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            await apiJson('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, newPassword }),
            });
            setSuccess(true);
            setTimeout(() => navigate('/login', { replace: true }), 2000);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.');
        }
        finally {
            setIsSubmitting(false);
        }
    }
    if (!token) {
        return (_jsx(AuthLayout, { title: "Link inv\u00E1lido", subtitle: "O link de redefini\u00E7\u00E3o de senha est\u00E1 incompleto.", children: _jsx(Link, { to: "/forgot-password", className: "text-sm text-brand-blue hover:text-brand-blue-dark", children: "Solicitar um novo link" }) }));
    }
    return (_jsx(AuthLayout, { title: "Redefinir senha", subtitle: "Escolha uma nova senha para sua conta", children: _jsxs("form", { className: "flex flex-col gap-4", onSubmit: handleSubmit, children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "newPassword", className: "mb-1 block text-sm font-medium text-ink", children: "Nova senha" }), _jsx("input", { id: "newPassword", type: "password", required: true, minLength: 8, autoComplete: "new-password", className: inputClass, value: newPassword, onChange: (e) => setNewPassword(e.target.value) })] }), success && (_jsx("p", { className: "rounded-card bg-success/10 px-3 py-2 text-sm text-success", children: "Senha redefinida com sucesso! Redirecionando para o login\u2026" })), error && (_jsx("p", { className: "rounded-card bg-danger/10 px-3 py-2 text-sm text-danger", children: error })), _jsx("button", { type: "submit", disabled: isSubmitting || success, className: "mt-2 rounded-card bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-purple-dark disabled:opacity-60", children: isSubmitting ? 'Salvando…' : 'Redefinir senha' })] }) }));
}
