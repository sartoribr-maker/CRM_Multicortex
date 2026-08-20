import { create } from 'zustand';
export const useAuthStore = create((set) => ({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    setSession: (accessToken, user) => set({ accessToken, user, isAuthenticated: true }),
    clearSession: () => set({ accessToken: null, user: null, isAuthenticated: false }),
}));
