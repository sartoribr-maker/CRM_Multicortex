import type { ApiHealthResponse } from '@multicortex/shared';
import { useAuthStore } from '../store/useAuthStore';
import type { AuthUser } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api/v1';

interface RefreshResponse {
  accessToken: string | null;
  user?: AuthUser;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!response.ok) return false;

        const data: RefreshResponse = await response.json();
        if (!data.accessToken || !data.user) return false;

        useAuthStore.getState().setSession(data.accessToken, data.user);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function attemptSilentRefresh(): Promise<boolean> {
  return refreshSession();
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  retryOn401 = true,
): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
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

export async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { message?: string });
    throw new Error(body.message ?? `Erro ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

export async function fetchHealth(): Promise<ApiHealthResponse> {
  return apiJson<ApiHealthResponse>('/health');
}
