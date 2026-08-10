/**
 * Budgets Page UI Store
 *
 * Состояние раскрытия узлов иерархии бюджетов.
 *
 * Паттерн — как на вкладках «Разделы»/«Отделы» (useSectionsPageUIStore,
 * useDepartmentsTimelineUIStore): состояние живёт в Zustand, а строки
 * подписываются на свой boolean через селектор (useBudgetRowExpanded).
 * Благодаря этому toggle одного узла перерисовывает ТОЛЬКО его строку,
 * а не всё дерево (раньше объект expanded прокидывался пропом → ломал memo).
 *
 * Формат — Record<id, boolean>, чтобы поддержать дефолт `?? true` для
 * блока «Человеческие ресурсы» (раскрыт по умолчанию).
 */

'use client'

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface BudgetsPageUIState {
  /** Явно заданные состояния раскрытия по id узла */
  expanded: Record<string, boolean>

  /** Переключить раскрытие узла (defaultExpanded — значение по умолчанию для этого узла) */
  toggle: (id: string, defaultExpanded?: boolean) => void
  /** Раскрыть набор узлов (узел + все потомки при раскрытии раздела) */
  expandMultiple: (ids: string[]) => void
  /** Раскрыть узел вместе с родителями (для авто-перехода к разделу) */
  expandWithParents: (id: string, parentIds: string[]) => void
  /** Свернуть всё */
  collapseAll: () => void
  /** Засеять дефолтное раскрытие (топ-уровень проектов), только если состояние пустое */
  seedIfEmpty: (ids: string[]) => void
}

export const useBudgetsPageUIStore = create<BudgetsPageUIState>()(
  devtools(
    persist(
      (set, get): BudgetsPageUIState => ({
        expanded: {},

        toggle: (id, defaultExpanded = false) =>
          set((state) => {
            const current = state.expanded[id] ?? defaultExpanded
            return { expanded: { ...state.expanded, [id]: !current } }
          }),

        expandMultiple: (ids) =>
          set((state) => {
            const next = { ...state.expanded }
            for (const id of ids) next[id] = true
            return { expanded: next }
          }),

        expandWithParents: (id, parentIds) =>
          set((state) => {
            const next = { ...state.expanded }
            for (const parentId of parentIds) next[parentId] = true
            next[id] = true
            return { expanded: next }
          }),

        collapseAll: () => set({ expanded: {} }),

        seedIfEmpty: (ids) =>
          set((state) => {
            if (Object.keys(state.expanded).length > 0) return state
            const next: Record<string, boolean> = {}
            for (const id of ids) next[id] = true
            return { expanded: next }
          }),
      }),
      {
        name: 'budgets-page-ui',
        partialize: (state) => ({ expanded: state.expanded }),
      }
    ),
    { name: 'BudgetsPageUI' }
  )
)

/**
 * Хук для строки иерархии: подписка на boolean раскрытия ОДНОГО узла.
 *
 * Zustand перерисовывает компонент только когда меняется именно этот boolean,
 * поэтому toggle одного узла не трогает остальные строки.
 *
 * @example
 * const { isExpanded, toggle } = useBudgetRowExpanded(node.id)
 * const { isExpanded, toggle } = useBudgetRowExpanded(`hr:${projectId}`, true) // HR-блок раскрыт по умолчанию
 */
export function useBudgetRowExpanded(id: string, defaultExpanded = false) {
  const isExpanded = useBudgetsPageUIStore((s) => s.expanded[id] ?? defaultExpanded)
  const toggleNode = useBudgetsPageUIStore((s) => s.toggle)
  return {
    isExpanded,
    toggle: () => toggleNode(id, defaultExpanded),
  }
}
