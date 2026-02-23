import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OnboardingState {
  // Персистентное: видел ли пользователь туториал v2
  hasSeenV2Tutorial: boolean
  // Эфемерное UI-состояние
  isOpen: boolean
  currentPage: number
  // Подсветить кнопку в sidebar после закрытия
  highlightTutorialButton: boolean

  open: () => void
  close: () => void
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  markAsSeen: () => void
  clearHighlight: () => void
}

const TOTAL_PAGES = 10

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      hasSeenV2Tutorial: false,
      isOpen: false,
      currentPage: 0,
      highlightTutorialButton: false,

      open: () => set({ isOpen: true, currentPage: 0, highlightTutorialButton: false }),
      close: () => {
        set({ isOpen: false, highlightTutorialButton: true })
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
      clearHighlight: () => set({ highlightTutorialButton: false }),
    }),
    {
      name: 'onboarding-v2',
      partialize: (state) => ({ hasSeenV2Tutorial: state.hasSeenV2Tutorial }),
    }
  )
)

export { TOTAL_PAGES }
