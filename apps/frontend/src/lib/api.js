import { useAuthStore } from '../store/useAuthStore';
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
export function apiAssetUrl(path) {
    return `${API_BASE_URL}${path}`;
}
let refreshPromise = null;
async function refreshSession() {
    if (!refreshPromise) {
        refreshPromise = (async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                    method: 'POST',
                    credentials: 'include',
                });
                if (!response.ok)
                    return false;
                const data = await response.json();
                if (!data.accessToken || !data.user)
                    return false;
                useAuthStore.getState().setSession(data.accessToken, data.user);
                return true;
            }
            catch {
                return false;
            }
            finally {
                refreshPromise = null;
            }
        })();
    }
    return refreshPromise;
}
export async function attemptSilentRefresh() {
    return refreshSession();
}
export async function apiFetch(path, options = {}, retryOn401 = true) {
    const token = useAuthStore.getState().accessToken;
    const headers = new Headers(options.headers);
    if (token)
        headers.set('Authorization', `Bearer ${token}`);
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (options.body && !isFormData && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        credentials: 'include',
    });
    if (response.status === 401 && retryOn401) {
        const refreshed = await refreshSession();
        if (refreshed) {
            return apiFetch(path, options, false);
        }
        useAuthStore.getState().clearSession();
    }
    return response;
}
export async function apiJson(path, options) {
    const response = await apiFetch(path, options);
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = Array.isArray(body.message) ? body.message.join('. ') : body.message;
        throw new Error(message ?? `Erro ${response.status}`);
    }
    if (response.status === 204) {
        return undefined;
    }
    return response.json();
}
export async function fetchHealth() {
    return apiJson('/health');
}
