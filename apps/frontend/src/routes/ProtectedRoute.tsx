import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import type { AuthUser } from '../types/auth';

export const THIRD_PARTY_PORTAL_PATH = '/terceiro';

export function isThirdPartyUser(user: AuthUser | null | undefined): boolean {
  return user?.portal === 'THIRD_PARTY';
}

/** Rota do portal equivalente a uma rota interna (ex.: link de e-mail para um lead). */
export function portalPathFor(pathname: string): string {
  if (pathname.startsWith(THIRD_PARTY_PORTAL_PATH)) return pathname;
  const leadId = /^\/leads\/([0-9a-f-]{36})(?:\/|$)/i.exec(pathname)?.[1];
  return leadId ? `${THIRD_PARTY_PORTAL_PATH}/kanban?lead=${leadId}` : THIRD_PARTY_PORTAL_PATH;
}

/** Rotas internas do CRM: usuários do Portal de Terceiros são devolvidos ao portal. */
export function ProtectedRoute({ children }: PropsWithChildren) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isThirdPartyUser(user)) {
    return <Navigate to={portalPathFor(location.pathname)} replace />;
  }

  return <>{children}</>;
}
