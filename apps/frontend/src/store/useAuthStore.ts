import { create } from 'zustand';
import type { AuthUser } from '../types/auth';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  setSession: (accessToken, user) => set({ accessToken, user, isAuthenticated: true }),
  clearSession: () => set({ accessToken: null, user: null, isAuthenticated: false }),
}));
