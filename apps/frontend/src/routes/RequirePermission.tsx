import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

interface RequirePermissionProps {
  permission: string;
}

export function RequirePermission({ permission, children }: PropsWithChildren<RequirePermissionProps>) {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);

  if (!permissions.includes(permission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
