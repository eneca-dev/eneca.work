import { create } from 'zustand';

interface SidebarState {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const useSidebarState = create<SidebarState>((set) => ({
  collapsed: true,
  setCollapsed: (collapsed: boolean) => set({ collapsed }),
}));