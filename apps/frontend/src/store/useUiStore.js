import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useUiStore = create()(persist((set) => ({
    sidebarCollapsed: false,
    theme: 'light',
    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
}), { name: 'multicortex-ui' }));
