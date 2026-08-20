import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
import logo from '../assets/logo.png';
export class ErrorBoundary extends Component {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { failed: false }
        });
    }
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch(error, info) {
        console.error('Erro não tratado na interface', error, info);
    }
    render() {
        if (!this.state.failed)
            return this.props.children;
        return (_jsx("main", { className: "flex min-h-screen items-center justify-center bg-app-bg p-5", children: _jsxs("div", { className: "card max-w-md p-8 text-center", children: [_jsx("img", { src: logo, alt: "Multicortex", className: "mx-auto h-12" }), _jsx("h1", { className: "mt-6 font-heading text-xl font-bold text-slate-900", children: "N\u00E3o foi poss\u00EDvel exibir esta p\u00E1gina" }), _jsx("p", { className: "mt-2 text-sm leading-6 text-slate-500", children: "Ocorreu uma falha inesperada. Seus dados permanecem seguros." }), _jsx("button", { className: "btn-primary mt-6", onClick: () => window.location.reload(), children: "Recarregar aplica\u00E7\u00E3o" })] }) }));
    }
}
