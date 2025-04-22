import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface UiState {
  loading: boolean
  notification: string | null
  
  setLoading: (loading: boolean) => void
  setNotification: (notification: string | null) => void
  clearNotification: () => void
}

export const useUiStore = create<UiState>()(
  devtools(
    (set) => ({
      loading: false,
      notification: null,
      
      setLoading: (loading: boolean) => set({ loading }),
      setNotification: (notification: string | null) => set({ notification }),
      clearNotification: () => set({ notification: null })
    })
  )
) 