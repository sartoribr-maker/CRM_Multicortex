import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ChangeRequiredPasswordPage from './pages/ChangeRequiredPasswordPage';
import HomePage from './pages/HomePage';
import SettingsPage, { type SettingsSection } from './pages/settings/SettingsPage';
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
  return (
    <div className="flex min-h-screen items-center justify-center">
      <img src={logo} alt="Multicortex" className="h-12 animate-pulse" />
    </div>
  );
}

function SettingsScreen({ section }: { section: SettingsSection }) {
  return (
    <ProtectedRoute>
      <RequirePermission permission="settings.manage">
        <SettingsPage section={section} />
      </RequirePermission>
    </ProtectedRoute>
  );
}

function App() {
  const [isBootstrapped, setIsBootstrapped] = useState(false);

  useEffect(() => {
    attemptSilentRefresh().finally(() => setIsBootstrapped(true));
  }, []);

  if (!isBootstrapped) {
    return <BootSplash />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/change-password" element={<ChangeRequiredPasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route path="/access" element={<Navigate to="/settings/access" replace />} />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <RequirePermission permission="tasks.view">
              <TasksListPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks/nova"
        element={
          <ProtectedRoute>
            <RequirePermission permission="tasks.create">
              <TaskFormPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks/:id"
        element={
          <ProtectedRoute>
            <RequirePermission permission="tasks.view">
              <TaskDetailPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks/:id/editar"
        element={
          <ProtectedRoute>
            <RequirePermission permission="tasks.edit">
              <TaskFormPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route
        path="/partners"
        element={
          <ProtectedRoute>
            <RequirePermission permission="partners.view">
              <PartnersListPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route
        path="/partners/novo"
        element={
          <ProtectedRoute>
            <RequirePermission permission="partners.create">
              <PartnerFormPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route
        path="/partners/:id"
        element={
          <ProtectedRoute>
            <RequirePermission permission="partners.view">
              <PartnerDetailPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route
        path="/partners/:id/editar"
        element={
          <ProtectedRoute>
            <RequirePermission permission="partners.edit">
              <PartnerFormPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route path="/settings" element={<Navigate to="/settings/stages" replace />} />
      <Route path="/settings/stages" element={<SettingsScreen section="stages" />} />
      <Route path="/settings/priorities" element={<SettingsScreen section="priorities" />} />
      <Route path="/settings/deal-sizes" element={<SettingsScreen section="dealSizes" />} />
      <Route path="/settings/sources" element={<SettingsScreen section="sources" />} />
      <Route path="/settings/segments" element={<SettingsScreen section="segments" />} />
      <Route path="/settings/project-types" element={<SettingsScreen section="projectTypes" />} />
      <Route path="/settings/services" element={<SettingsScreen section="services" />} />
      <Route path="/settings/custom-fields" element={<SettingsScreen section="customFields" />} />
      <Route path="/settings/email" element={<SettingsScreen section="email" />} />
      <Route path="/settings/whatsapp" element={<SettingsScreen section="whatsapp" />} />
      <Route
        path="/settings/access"
        element={
          <ProtectedRoute>
            <RequirePermission permission="users.view">
              <AccessManagementPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/pipeline"
        element={
          <ProtectedRoute>
            <RequirePermission permission="leads.view.all">
              <PipelineReportPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <RequirePermission permission="leads.view">
              <LeadsListPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/kanban"
        element={
          <ProtectedRoute>
            <RequirePermission permission="leads.view">
              <LeadsKanbanPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/novo"
        element={
          <ProtectedRoute>
            <RequirePermission permission="leads.create">
              <LeadFormPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/:id"
        element={
          <ProtectedRoute>
            <RequirePermission permission="leads.view">
              <LeadDetailPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/:id/editar"
        element={
          <ProtectedRoute>
            <RequirePermission permission="leads.edit">
              <LeadFormPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
