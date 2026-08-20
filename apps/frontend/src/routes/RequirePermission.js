import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
export function RequirePermission({ permission, children }) {
    const permissions = useAuthStore((s) => s.user?.permissions ?? []);
    if (!permissions.includes(permission)) {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    return _jsx(_Fragment, { children: children });
}
