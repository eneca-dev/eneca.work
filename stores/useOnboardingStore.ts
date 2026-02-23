import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OnboardingState {
  // Персистентное: видел ли пользователь туториал v2
  hasSeenV2Tutorial: boolean
  // Эфемерное: открыта ли модалка прямо сейчас
  isOpen: boolean
  currentPage: number

  open: () => void
  close: () => void
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  markAsSeen: () => void
}

const TOTAL_PAGES = 8

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      hasSeenV2Tutorial: false,
      isOpen: false,
      currentPage: 0,

      open: () => set({ isOpen: true, currentPage: 0 }),
      close: () => {
        set({ isOpen: false })
        get().markAsSeen()
      },
      goToPage: (page) => set({ currentPage: Math.max(0, Math.min(page, TOTAL_PAGES - 1)) }),
      nextPage: () => {
        const { currentPage } = get()
        if (currentPage < TOTAL_PAGES - 1) {
          set({ currentPage: currentPage + 1 })
        }
      },
      prevPage: () => {
        const { currentPage } = get()
        if (currentPage > 0) {
          set({ currentPage: currentPage - 1 })
        }
      },
      markAsSeen: () => set({ hasSeenV2Tutorial: true }),
    }),
    {
      name: 'onboarding-v2',
      // Сохраняем только флаг "видел" — остальное эфемерное UI-состояние
      partialize: (state) => ({ hasSeenV2Tutorial: state.hasSeenV2Tutorial }),
    }
  )
)

export { TOTAL_PAGES }
