import { apiAssetUrl, apiJson } from './api';
export interface UserOption {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}
export interface UserRecord extends UserOption {
  avatarUrl: string | null;
  position: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  roleId: string;
  role: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}
export interface UserPayload {
  name: string;
  email: string;
  password?: string;
  roleId: string;
  position?: string;
  phone?: string;
}
export interface UsersFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  roleId?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}
export interface UsersListResponse {
  items: UserRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
function query(filters: UsersFilters) {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)));
  return p.size ? `?${p}` : '';
}
export const avatarUrl = (id: string, version?: string | null) =>
  apiAssetUrl(`/users/${id}/avatar${version ? `?v=${encodeURIComponent(version)}` : ''}`);
export const usersApi = {
  list: () => apiJson<UsersListResponse>('/users?pageSize=100').then((r) => r.items),
  listPage: (filters: UsersFilters = {}) => apiJson<UsersListResponse>(`/users${query(filters)}`),
  get: (id: string) => apiJson<UserRecord>(`/users/${id}`),
  create: (payload: UserPayload) =>
    apiJson<UserRecord>('/users', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<UserPayload>) =>
    apiJson<UserRecord>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  uploadAvatar: (id: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return apiJson<UserRecord>(`/users/${id}/avatar`, { method: 'POST', body });
  },
  deactivate: (id: string) => apiJson<UserRecord>(`/users/${id}/deactivate`, { method: 'POST' }),
  reactivate: (id: string) => apiJson<UserRecord>(`/users/${id}/reactivate`, { method: 'POST' }),
  resetPassword: (id: string, newPassword: string) =>
    apiJson<{ success: boolean }>(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),
  remove: (id: string) => apiJson<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' }),
};
