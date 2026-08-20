import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { apiFetch } from '../lib/api';
import { APP_VERSION } from '../lib/version';
import { avatarUrl } from '../lib/usersApi';
import { useAuthStore } from '../store/useAuthStore';
import { useUiStore } from '../store/useUiStore';
import { Icon } from './Icon';
const navItems = [
    { to: '/', label: 'Visão geral', icon: 'dashboard' },
    { to: '/leads', label: 'Leads e oportunidades', icon: 'leads', permission: 'leads.view' },
    { to: '/leads/kanban', label: 'Kanban comercial', icon: 'dashboard', permission: 'leads.view' },
    { to: '/partners', label: 'Parceiros', icon: 'user', permission: 'partners.view' },
    { to: '/tasks', label: 'Tarefas', icon: 'file', permission: 'tasks.view' },
];
const reportItems = [{ to: '/reports/pipeline', label: 'Pipeline', permission: 'leads.view.all' }];
const settingsItems = [
    { to: '/settings/stages', label: 'Etapas do Funil', permission: 'settings.manage' },
    { to: '/settings/priorities', label: 'Prioridades', permission: 'settings.manage' },
    { to: '/settings/deal-sizes', label: 'Portes do Negócio', permission: 'settings.manage' },
    { to: '/settings/sources', label: 'Origens do Lead', permission: 'settings.manage' },
    { to: '/settings/segments', label: 'Segmentos de Mercado', permission: 'settings.manage' },
    { to: '/settings/project-types', label: 'Tipos de Produto', permission: 'settings.manage' },
    { to: '/settings/services', label: 'Serviços', permission: 'settings.manage' },
    { to: '/settings/custom-fields', label: 'Campos Personalizados', permission: 'settings.manage' },
    { to: '/settings/email', label: 'Configuração de E-mail', permission: 'settings.manage' },
    { to: '/settings/whatsapp', label: 'Configuração do WhatsApp', permission: 'settings.manage' },
    { to: '/settings/access', label: 'Usuários e Acessos', permission: 'users.view' },
];
export function AppShell({ children }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();
    const [settingsOpen, setSettingsOpen] = useState(location.pathname.startsWith('/settings'));
    const [reportsOpen, setReportsOpen] = useState(location.pathname.startsWith('/reports'));
    const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
    const theme = useUiStore((s) => s.theme);
    const toggleSidebar = useUiStore((s) => s.toggleSidebar);
    const toggleTheme = useUiStore((s) => s.toggleTheme);
    const user = useAuthStore((s) => s.user);
    const clearSession = useAuthStore((s) => s.clearSession);
    const navigate = useNavigate();
    const initials = user?.name
        .split(' ')
        .slice(0, 2)
        .map((word) => word[0])
        .join('')
        .toUpperCase();
    const visibleSettings = settingsItems.filter((item) => user?.permissions.includes(item.permission));
    const visibleReports = reportItems.filter((item) => user?.permissions.includes(item.permission));
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        document.documentElement.style.colorScheme = theme;
    }, [theme]);
    async function handleLogout() {
        await apiFetch('/auth/logout', { method: 'POST' });
        clearSession();
        navigate('/login', { replace: true });
    }
    return (_jsxs("div", { className: `min-h-screen bg-app-bg transition-[padding] ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`, children: [_jsx("a", { href: "#conteudo-principal", className: "skip-link", children: "Ir para o conte\u00FAdo principal" }), mobileOpen && (_jsx("button", { className: "fixed inset-0 z-40 bg-slate-950/45 lg:hidden", onClick: () => setMobileOpen(false), "aria-label": "Fechar menu" })), _jsxs("aside", { className: `mobile-sidebar fixed inset-y-0 left-0 z-50 flex w-64 max-w-[88vw] flex-col bg-sidebar text-white shadow-2xl transition-all duration-300 lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`, children: [_jsxs("div", { className: "flex h-24 items-center border-b border-white/10 px-4", children: [_jsx("div", { className: `flex min-w-0 flex-1 items-center justify-center rounded-xl bg-white py-2 shadow-md shadow-black/10 ${sidebarCollapsed ? 'lg:px-1' : 'px-3'}`, children: _jsx("img", { src: logo, alt: "Multicortex", className: "h-10 w-auto max-w-full object-contain" }) }), _jsx("button", { className: "ml-auto lg:hidden", onClick: () => setMobileOpen(false), children: _jsx(Icon, { name: "x", className: "h-5 w-5" }) })] }), _jsx("button", { type: "button", onClick: toggleSidebar, className: "absolute -right-3 top-28 hidden h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-sidebar text-white shadow-lg transition hover:scale-105 lg:flex", "aria-label": sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral', children: _jsx(Icon, { name: "panel", className: `h-4 w-4 ${sidebarCollapsed ? 'rotate-180' : ''}` }) }), _jsx("div", { className: "px-4 pt-7 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35", children: _jsx("span", { className: sidebarCollapsed ? 'lg:sr-only' : '', children: "Workspace" }) }), _jsxs("nav", { className: "mt-3 flex-1 space-y-1 overflow-y-auto px-3 pb-4", children: [navItems
                                .filter((item) => !item.permission || user?.permissions.includes(item.permission))
                                .map((item) => (_jsxs(NavLink, { to: item.to, end: item.to === '/' ||
                                    item.to === '/leads' ||
                                    item.to === '/partners' ||
                                    item.to === '/tasks', onClick: () => setMobileOpen(false), className: ({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${isActive ? 'bg-white text-brand-purple-dark shadow-lg shadow-black/10' : 'text-white/70 hover:bg-white/10 hover:text-white'}`, children: [_jsx(Icon, { name: item.icon, className: "h-[19px] w-[19px]" }), _jsx("span", { className: sidebarCollapsed ? 'lg:sr-only' : '', children: item.label })] }, item.to))), visibleReports.length > 0 && (_jsxs("div", { className: "pt-1", children: [_jsxs("button", { onClick: () => {
                                            if (sidebarCollapsed)
                                                toggleSidebar();
                                            setReportsOpen((open) => !open);
                                        }, className: `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${location.pathname.startsWith('/reports') ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`, children: [_jsx(Icon, { name: "sort", className: "h-[19px] w-[19px]" }), _jsx("span", { className: `flex-1 text-left ${sidebarCollapsed ? 'lg:sr-only' : ''}`, children: "Vis\u00F5es/Relat\u00F3rios" }), _jsx(Icon, { name: "chevron-down", className: `h-4 w-4 transition-transform ${sidebarCollapsed ? 'lg:hidden' : ''} ${reportsOpen ? 'rotate-180' : ''}` })] }), reportsOpen && !sidebarCollapsed && (_jsx("div", { className: "ml-5 mt-1 space-y-0.5 border-l border-white/10 pl-3", children: visibleReports.map((item) => (_jsx(NavLink, { to: item.to, onClick: () => setMobileOpen(false), className: ({ isActive }) => `block rounded-lg px-3 py-2 text-xs font-medium transition ${isActive ? 'bg-white text-brand-purple-dark' : 'text-white/55 hover:bg-white/10 hover:text-white'}`, children: item.label }, item.to))) }))] })), visibleSettings.length > 0 && (_jsxs("div", { className: "pt-1", children: [_jsxs("button", { onClick: () => {
                                            if (sidebarCollapsed)
                                                toggleSidebar();
                                            setSettingsOpen((open) => !open);
                                        }, className: `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${location.pathname.startsWith('/settings') ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`, children: [_jsx(Icon, { name: "settings", className: "h-[19px] w-[19px]" }), _jsx("span", { className: `flex-1 text-left ${sidebarCollapsed ? 'lg:sr-only' : ''}`, children: "Configura\u00E7\u00F5es" }), _jsx(Icon, { name: "chevron-down", className: `h-4 w-4 transition-transform ${sidebarCollapsed ? 'lg:hidden' : ''} ${settingsOpen ? 'rotate-180' : ''}` })] }), settingsOpen && !sidebarCollapsed && (_jsx("div", { className: "ml-5 mt-1 space-y-0.5 border-l border-white/10 pl-3", children: visibleSettings.map((item) => (_jsx(NavLink, { to: item.to, onClick: () => setMobileOpen(false), className: ({ isActive }) => `block rounded-lg px-3 py-2 text-xs font-medium transition ${isActive ? 'bg-white text-brand-purple-dark' : 'text-white/55 hover:bg-white/10 hover:text-white'}`, children: item.label }, item.to))) }))] }))] }), _jsxs("div", { className: "border-t border-white/10 p-3", children: [_jsxs("div", { className: "mb-2 flex items-center gap-3 rounded-xl bg-white/[0.06] p-3", children: [user?.avatarUrl ? (_jsx("img", { src: avatarUrl(user.id, user.avatarUrl), alt: `Foto de ${user.name}`, className: "h-9 w-9 shrink-0 rounded-xl object-cover" })) : (_jsx("div", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-orange to-brand-purple text-xs font-bold", children: initials })), _jsxs("div", { className: `min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`, children: [_jsx("p", { className: "truncate text-sm font-semibold", children: user?.name }), _jsx("p", { className: "truncate text-[11px] text-white/45", children: user?.role.name })] })] }), _jsxs("button", { onClick: handleLogout, className: "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/55 transition hover:bg-white/10 hover:text-white", children: [_jsx(Icon, { name: "logout", className: "h-[18px] w-[18px]" }), _jsx("span", { className: sidebarCollapsed ? 'lg:sr-only' : '', children: "Sair da plataforma" })] }), _jsxs("p", { className: `mt-1 text-center text-[10px] text-white/30 ${sidebarCollapsed ? 'lg:sr-only' : ''}`, children: ["Vers\u00E3o ", APP_VERSION] })] })] }), _jsxs("div", { className: "min-h-screen", children: [_jsxs("header", { className: "mobile-header sticky top-0 z-30 flex h-16 items-center border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur md:px-8", children: [_jsx("button", { onClick: () => setMobileOpen(true), className: "icon-button mr-3 lg:hidden", children: _jsx(Icon, { name: "menu", className: "h-5 w-5" }) }), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: toggleTheme, className: "icon-button", "aria-label": theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro', title: theme === 'dark' ? 'Tema claro' : 'Tema escuro', children: _jsx(Icon, { name: theme === 'dark' ? 'sun' : 'moon', className: "h-5 w-5" }) }), _jsxs("button", { className: "icon-button relative", "aria-label": "Notifica\u00E7\u00F5es", children: [_jsx(Icon, { name: "bell", className: "h-5 w-5" }), _jsx("span", { className: "absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-orange ring-2 ring-white" })] }), _jsxs("div", { className: "ml-2 hidden text-right sm:block", children: [_jsx("p", { className: "text-xs font-semibold text-slate-700", children: user?.name }), _jsx("p", { className: "text-[10px] text-slate-400", children: user?.email })] })] })] }), _jsx("main", { id: "conteudo-principal", tabIndex: -1, className: "mx-auto w-full max-w-[1600px] px-4 py-6 outline-none md:px-8 md:py-8", children: children })] })] }));
}
export function PageHeader({ eyebrow, title, description, actions, }) {
    return (_jsxs("div", { className: "page-header mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end", children: [_jsxs("div", { children: [eyebrow && (_jsx("p", { className: "mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-purple", children: eyebrow })), _jsx("h1", { className: "font-heading text-2xl font-bold tracking-tight text-slate-900 md:text-[28px]", children: title }), description && (_jsx("p", { className: "mt-1.5 max-w-2xl text-sm leading-6 text-slate-500", children: description }))] }), actions && (_jsx("div", { className: "page-actions flex shrink-0 flex-wrap items-center gap-2", children: actions }))] }));
}
