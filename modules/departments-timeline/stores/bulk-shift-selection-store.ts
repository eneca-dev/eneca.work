/**
 * Bulk Shift Selection Store
 *
 * Эфемерное состояние режима выборочного применения bulk-shift:
 * - какой отдел сейчас в режиме выбора
 * - какой проект выбран (scope)
 * - какие loading_id отмечены пользователем
 *
 * Только один отдел может быть в режиме выбора одновременно.
 * Не персистится — состояние теряется при перезагрузке страницы (by design).
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface BulkShiftSelectionState {
  /** ID отдела в режиме выбора. null = режим неактивен */
  activeDepartmentId: string | null
  /** ID проекта-скоупа выбора. null если режим неактивен */
  activeProjectId: string | null
  /** Отмеченные loading_id */
  selectedLoadingIds: Set<string>

  // Actions
  /** Войти в режим выбора для конкретной пары отдел × проект */
  enter: (departmentId: string, projectId: string) => void
  /** Выйти из режима, очистить выбор */
  exit: () => void
  /** Сменить scope-проект (сбрасывает выбор) */
  changeProject: (projectId: string) => void
  /** Toggle одной загрузки */
  toggle: (loadingId: string) => void
  /** Заменить весь выбор переданным набором */
  selectAll: (ids: string[]) => void
  /** Снять весь выбор (но остаться в режиме) */
  clear: () => void
}

export const useBulkShiftSelectionStore = create<BulkShiftSelectionState>()(
  devtools(
    (set) => ({
      activeDepartmentId: null,
      activeProjectId: null,
      selectedLoadingIds: new Set(),

      enter: (departmentId, projectId) =>
        set({
          activeDepartmentId: departmentId,
          activeProjectId: projectId,
          selectedLoadingIds: new Set(),
        }),

      exit: () =>
        set({
          activeDepartmentId: null,
          activeProjectId: null,
          selectedLoadingIds: new Set(),
        }),

      changeProject: (projectId) =>
        set({
          activeProjectId: projectId,
          selectedLoadingIds: new Set(),
        }),

      toggle: (loadingId) =>
        set((state) => {
          const next = new Set(state.selectedLoadingIds)
          if (next.has(loadingId)) {
            next.delete(loadingId)
          } else {
            next.add(loadingId)
          }
          return { selectedLoadingIds: next }
        }),

      selectAll: (ids) =>
        set({ selectedLoadingIds: new Set(ids) }),

      clear: () =>
        set({ selectedLoadingIds: new Set() }),
    }),
    { name: 'BulkShiftSelection' }
  )
)
