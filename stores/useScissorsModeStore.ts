import { create } from 'zustand'

interface ScissorsModeState {
  isActive: boolean
  activate: () => void
  deactivate: () => void
  toggle: () => void
}

export const useScissorsModeStore = create<ScissorsModeState>((set) => ({
  isActive: false,
  activate: () => set({ isActive: true }),
  deactivate: () => set({ isActive: false }),
  toggle: () => set((state) => ({ isActive: !state.isActive })),
}))
