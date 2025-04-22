import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface SettingsState {
  theme: 'light' | 'dark' | 'system'
  
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set) => ({
        theme: 'system',
        
        setTheme: (theme: 'light' | 'dark' | 'system') => set({ theme })
      }),
      {
        name: 'settings-storage',
      }
    )
  )
) 