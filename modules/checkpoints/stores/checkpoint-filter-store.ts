// MOCK DATA - prototype only
// Zustand store для UI state фильтров чекпоинтов

import { create } from 'zustand'

interface CheckpointFilterStore {
  /** Выбранные типы чекпоинтов (пустой массив = все типы) */
  selectedTypeIds: string[]

  /** Показывать только проблемные чекпоинты */
  showProblemsOnly: boolean

  /** Установить выбранные типы */
  setSelectedTypes: (typeIds: string[]) => void

  /** Переключить фильтр "только проблемные" */
  toggleProblemsOnly: () => void

  /** Сбросить все фильтры */
  resetFilters: () => void
}

export const useCheckpointFilters = create<CheckpointFilterStore>((set) => ({
  selectedTypeIds: [],
  showProblemsOnly: false,

  setSelectedTypes: (typeIds) => set({ selectedTypeIds: typeIds }),

  toggleProblemsOnly: () => set((state) => ({ showProblemsOnly: !state.showProblemsOnly })),

  resetFilters: () => set({ selectedTypeIds: [], showProblemsOnly: false }),
}))
