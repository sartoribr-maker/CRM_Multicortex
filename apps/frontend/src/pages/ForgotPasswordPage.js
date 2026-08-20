import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { apiJson } from '../lib/api';
const inputClass = 'w-full rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple';
export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        setMessage(null);
        setIsSubmitting(true);
        try {
            const data = await apiJson('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email }),
            });
            setMessage(data.message);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível processar o pedido.');
        }
        finally {
            setIsSubmitting(false);
        }
    }
    return (_jsx(AuthLayout, { title: "Esqueci minha senha", subtitle: "Informe seu e-mail para receber o link de redefini\u00E7\u00E3o", children: _jsxs("form", { className: "flex flex-col gap-4", onSubmit: handleSubmit, children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "mb-1 block text-sm font-medium text-ink", children: "E-mail" }), _jsx("input", { id: "email", type: "email", required: true, autoComplete: "email", className: inputClass, value: email, onChange: (e) => setEmail(e.target.value) })] }), message && (_jsx("p", { className: "rounded-card bg-success/10 px-3 py-2 text-sm text-success", children: message })), error && (_jsx("p", { className: "rounded-card bg-danger/10 px-3 py-2 text-sm text-danger", children: error })), _jsx("button", { type: "submit", disabled: isSubmitting, className: "mt-2 rounded-card bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-purple-dark disabled:opacity-60", children: isSubmitting ? 'Enviando…' : 'Enviar link de redefinição' }), _jsx(Link, { to: "/login", className: "text-center text-sm text-brand-blue hover:text-brand-blue-dark", children: "Voltar para o login" })] }) }));
}
