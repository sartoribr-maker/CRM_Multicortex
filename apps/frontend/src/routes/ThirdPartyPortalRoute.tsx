import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

/** Portal de Terceiros: exige sessão e a permissão portal.sdr.access. */
export function ThirdPartyPortalRoute({ children }: PropsWithChildren) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!permissions.includes('portal.sdr.access')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
