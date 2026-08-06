import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/settings/SettingsPage';
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
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <RequirePermission permission="settings.manage">
              <SettingsPage />
            </RequirePermission>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
