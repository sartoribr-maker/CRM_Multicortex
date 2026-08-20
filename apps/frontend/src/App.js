import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ChangeRequiredPasswordPage from './pages/ChangeRequiredPasswordPage';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/settings/SettingsPage';
import LeadsListPage from './pages/leads/LeadsListPage';
import LeadFormPage from './pages/leads/LeadFormPage';
import LeadDetailPage from './pages/leads/LeadDetailPage';
import LeadsKanbanPage from './pages/leads/LeadsKanbanPage';
import PartnersListPage from './pages/partners/PartnersListPage';
import PartnerFormPage from './pages/partners/PartnerFormPage';
import PartnerDetailPage from './pages/partners/PartnerDetailPage';
import TasksListPage from './pages/tasks/TasksListPage';
import TaskFormPage from './pages/tasks/TaskFormPage';
import TaskDetailPage from './pages/tasks/TaskDetailPage';
import AccessManagementPage from './pages/access/AccessManagementPage';
import PipelineReportPage from './pages/reports/PipelineReportPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RequirePermission } from './routes/RequirePermission';
import { attemptSilentRefresh } from './lib/api';
import logo from './assets/logo.png';
function BootSplash() {
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center", children: _jsx("img", { src: logo, alt: "Multicortex", className: "h-12 animate-pulse" }) }));
}
function SettingsScreen({ section }) {
    return (_jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "settings.manage", children: _jsx(SettingsPage, { section: section }) }) }));
}
function App() {
    const [isBootstrapped, setIsBootstrapped] = useState(false);
    useEffect(() => {
        attemptSilentRefresh().finally(() => setIsBootstrapped(true));
    }, []);
    if (!isBootstrapped) {
        return _jsx(BootSplash, {});
    }
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/forgot-password", element: _jsx(ForgotPasswordPage, {}) }), _jsx(Route, { path: "/reset-password", element: _jsx(ResetPasswordPage, {}) }), _jsx(Route, { path: "/change-password", element: _jsx(ChangeRequiredPasswordPage, {}) }), _jsx(Route, { path: "/", element: _jsx(ProtectedRoute, { children: _jsx(HomePage, {}) }) }), _jsx(Route, { path: "/access", element: _jsx(Navigate, { to: "/settings/access", replace: true }) }), _jsx(Route, { path: "/tasks", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "tasks.view", children: _jsx(TasksListPage, {}) }) }) }), _jsx(Route, { path: "/tasks/nova", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "tasks.create", children: _jsx(TaskFormPage, {}) }) }) }), _jsx(Route, { path: "/tasks/:id", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "tasks.view", children: _jsx(TaskDetailPage, {}) }) }) }), _jsx(Route, { path: "/tasks/:id/editar", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "tasks.edit", children: _jsx(TaskFormPage, {}) }) }) }), _jsx(Route, { path: "/partners", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "partners.view", children: _jsx(PartnersListPage, {}) }) }) }), _jsx(Route, { path: "/partners/novo", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "partners.create", children: _jsx(PartnerFormPage, {}) }) }) }), _jsx(Route, { path: "/partners/:id", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "partners.view", children: _jsx(PartnerDetailPage, {}) }) }) }), _jsx(Route, { path: "/partners/:id/editar", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "partners.edit", children: _jsx(PartnerFormPage, {}) }) }) }), _jsx(Route, { path: "/settings", element: _jsx(Navigate, { to: "/settings/stages", replace: true }) }), _jsx(Route, { path: "/settings/stages", element: _jsx(SettingsScreen, { section: "stages" }) }), _jsx(Route, { path: "/settings/priorities", element: _jsx(SettingsScreen, { section: "priorities" }) }), _jsx(Route, { path: "/settings/deal-sizes", element: _jsx(SettingsScreen, { section: "dealSizes" }) }), _jsx(Route, { path: "/settings/sources", element: _jsx(SettingsScreen, { section: "sources" }) }), _jsx(Route, { path: "/settings/segments", element: _jsx(SettingsScreen, { section: "segments" }) }), _jsx(Route, { path: "/settings/project-types", element: _jsx(SettingsScreen, { section: "projectTypes" }) }), _jsx(Route, { path: "/settings/services", element: _jsx(SettingsScreen, { section: "services" }) }), _jsx(Route, { path: "/settings/custom-fields", element: _jsx(SettingsScreen, { section: "customFields" }) }), _jsx(Route, { path: "/settings/email", element: _jsx(SettingsScreen, { section: "email" }) }), _jsx(Route, { path: "/settings/whatsapp", element: _jsx(SettingsScreen, { section: "whatsapp" }) }), _jsx(Route, { path: "/settings/access", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "users.view", children: _jsx(AccessManagementPage, {}) }) }) }), _jsx(Route, { path: "/reports/pipeline", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "leads.view.all", children: _jsx(PipelineReportPage, {}) }) }) }), _jsx(Route, { path: "/leads", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "leads.view", children: _jsx(LeadsListPage, {}) }) }) }), _jsx(Route, { path: "/leads/kanban", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "leads.view", children: _jsx(LeadsKanbanPage, {}) }) }) }), _jsx(Route, { path: "/leads/novo", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "leads.create", children: _jsx(LeadFormPage, {}) }) }) }), _jsx(Route, { path: "/leads/:id", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "leads.view", children: _jsx(LeadDetailPage, {}) }) }) }), _jsx(Route, { path: "/leads/:id/editar", element: _jsx(ProtectedRoute, { children: _jsx(RequirePermission, { permission: "leads.edit", children: _jsx(LeadFormPage, {}) }) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
}
export default App;
