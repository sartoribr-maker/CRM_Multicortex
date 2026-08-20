import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { apiJson } from '../lib/api';
import { APP_VERSION } from '../lib/version';
import { useAuthStore } from '../store/useAuthStore';
const inputClass = 'form-control';
const REMEMBERED_EMAIL_KEY = 'multicortex.rememberedEmail';
export default function LoginPage() {
    const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '';
    const [email, setEmail] = useState(rememberedEmail);
    const [password, setPassword] = useState('');
    const [rememberEmail, setRememberEmail] = useState(Boolean(rememberedEmail));
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const setSession = useAuthStore((s) => s.setSession);
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname ?? '/';
    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            const data = await apiJson('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });
            if (rememberEmail) {
                localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
            }
            else {
                localStorage.removeItem(REMEMBERED_EMAIL_KEY);
            }
            if (data.passwordChangeRequired) {
                navigate('/change-password', { replace: true, state: { changeToken: data.changeToken } });
                return;
            }
            setSession(data.accessToken, data.user);
            navigate(from, { replace: true });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
        }
        finally {
            setIsSubmitting(false);
        }
    }
    return (_jsx(AuthLayout, { title: "Entrar", subtitle: "Acesse o Multicortex CRM", children: _jsxs("form", { className: "flex flex-col gap-4", onSubmit: handleSubmit, children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "form-label", children: "E-mail" }), _jsx("input", { id: "email", type: "email", required: true, autoComplete: "email", className: inputClass, value: email, onChange: (e) => setEmail(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "password", className: "form-label", children: "Senha" }), _jsx("input", { id: "password", type: "password", required: true, autoComplete: "current-password", className: inputClass, value: password, onChange: (e) => setPassword(e.target.value) })] }), _jsxs("label", { className: "flex cursor-pointer items-center gap-2 text-sm text-slate-600", children: [_jsx("input", { type: "checkbox", className: "h-4 w-4 accent-brand-purple", checked: rememberEmail, onChange: (e) => setRememberEmail(e.target.checked) }), "Lembrar meu e-mail no pr\u00F3ximo login"] }), error && (_jsx("p", { className: "rounded-card bg-danger/10 px-3 py-2 text-sm text-danger", children: error })), _jsx("button", { type: "submit", disabled: isSubmitting, className: "btn-primary mt-2 w-full", children: isSubmitting ? 'Entrando…' : 'Entrar' }), _jsx(Link, { to: "/forgot-password", className: "text-center text-sm text-brand-blue hover:text-brand-blue-dark", children: "Esqueci minha senha" }), _jsxs("p", { className: "pt-1 text-center text-[11px] text-slate-400", children: ["MultiCortex CRM \u00B7 Vers\u00E3o ", APP_VERSION] })] }) }));
}
