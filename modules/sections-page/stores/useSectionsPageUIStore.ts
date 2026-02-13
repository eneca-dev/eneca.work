/**
 * Sections Page UI Store
 *
 * Zustand store для UI состояния страницы разделов:
 * - Expand/collapse узлов дерева
 * - Capacity overrides (клиентские, до сохранения на сервер)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { eachDayOfInterval } from 'date-fns'
import { parseMinskDate, formatMinskDate } from '@/lib/timezone-utils'

interface SectionsPageUIState {
  // ============================================================================
  // Expand/Collapse State
  // ============================================================================

  /** Развёрнутые узлы дерева (Set хранится как Array для localStorage) */
  expandedNodes: string[]

  /** Проверить развёрнут ли узел */
  isExpanded: (nodeId: string) => boolean

  /** Развернуть узел */
  expand: (nodeId: string) => void

  /** Свернуть узел */
  collapse: (nodeId: string) => void

  /** Toggle узла */
  toggle: (nodeId: string) => void

  /** Развернуть все узлы типа */
  expandAll: (nodeIds: string[]) => void

  /** Свернуть все узлы типа */
  collapseAll: (nodeIds: string[]) => void

  // ============================================================================
  // Capacity Overrides (клиентские)
  // ============================================================================

  /**
   * Capacity overrides для конкретных дат (до сохранения на сервер)
   * Map: sectionId -> date -> value
   */
  capacityOverrides: Record<string, Record<string, number>>

  /** Установить capacity override */
  setCapacity: (sectionId: string, date: string, value: number) => void

  /** Установить capacity для диапазона дат */
  setCapacityRange: (sectionId: string, startDate: string, endDate: string, value: number) => void

  /** Удалить capacity override */
  deleteCapacity: (sectionId: string, date: string) => void

  /** Очистить все overrides для раздела */
  clearSectionOverrides: (sectionId: string) => void

  /** Очистить все overrides */
  clearAllOverrides: () => void
}

// Константа для пустого объекта (предотвращает создание нового объекта на каждый рендер)
const EMPTY_CAPACITY_OVERRIDES: Record<string, number> = {}

/**
 * Selector hook для получения capacity overrides конкретного раздела
 */
export function useDateCapacityOverrides(sectionId: string): Record<string, number> {
  return useSectionsPageUIStore((state) => state.capacityOverrides[sectionId] || EMPTY_CAPACITY_OVERRIDES)
}

/**
 * Selector hook для проверки expanded состояния
 */
export function useRowExpanded(type: string, id: string) {
  const nodeId = `${type}-${id}`
  const isExpanded = useSectionsPageUIStore((s) => s.isExpanded(nodeId))
  const toggle = useSectionsPageUIStore((s) => s.toggle)

  return {
    isExpanded,
    toggle: () => toggle(nodeId),
  }
}

export const useSectionsPageUIStore = create<SectionsPageUIState>()(
  persist(
    (set, get) => ({
      // ============================================================================
      // Expand/Collapse Implementation
      // ============================================================================

      expandedNodes: [],

      isExpanded: (nodeId) => {
        return get().expandedNodes.includes(nodeId)
      },

      expand: (nodeId) => {
        set((state) => {
          if (state.expandedNodes.includes(nodeId)) return state
          return { expandedNodes: [...state.expandedNodes, nodeId] }
        })
      },

      collapse: (nodeId) => {
        set((state) => ({
          expandedNodes: state.expandedNodes.filter((id) => id !== nodeId),
        }))
      },

      toggle: (nodeId) => {
        const { isExpanded, expand, collapse } = get()
        if (isExpanded(nodeId)) {
          collapse(nodeId)
        } else {
          expand(nodeId)
        }
      },

      expandAll: (nodeIds) => {
        set((state) => {
          const newExpanded = new Set(state.expandedNodes)
          nodeIds.forEach((id) => newExpanded.add(id))
          return { expandedNodes: Array.from(newExpanded) }
        })
      },

      collapseAll: (nodeIds) => {
        set((state) => {
          const toRemove = new Set(nodeIds)
          return {
            expandedNodes: state.expandedNodes.filter((id) => !toRemove.has(id)),
          }
        })
      },

      // ============================================================================
      // Capacity Overrides Implementation
      // ============================================================================

      capacityOverrides: {},

      setCapacity: (sectionId, date, value) => {
        set((state) => ({
          capacityOverrides: {
            ...state.capacityOverrides,
            [sectionId]: {
              ...(state.capacityOverrides[sectionId] || {}),
              [date]: value,
            },
          },
        }))
      },

      setCapacityRange: (sectionId, startDate, endDate, value) => {
        set((state) => {
          // Generate all dates in range
          const dates = eachDayOfInterval({
            start: parseMinskDate(startDate),
            end: parseMinskDate(endDate),
          })

          // Build overrides for all dates
          const newOverrides = { ...(state.capacityOverrides[sectionId] || {}) }
          dates.forEach((date) => {
            const dateStr = formatMinskDate(date)
            newOverrides[dateStr] = value
          })

          return {
            capacityOverrides: {
              ...state.capacityOverrides,
              [sectionId]: newOverrides,
            },
          }
        })
      },

      deleteCapacity: (sectionId, date) => {
        set((state) => {
          const sectionOverrides = state.capacityOverrides[sectionId]
          if (!sectionOverrides) return state

          const { [date]: _, ...rest } = sectionOverrides

          if (Object.keys(rest).length === 0) {
            const { [sectionId]: __, ...restSections } = state.capacityOverrides
            return { capacityOverrides: restSections }
          }

          return {
            capacityOverrides: {
              ...state.capacityOverrides,
              [sectionId]: rest,
            },
          }
        })
      },

      clearSectionOverrides: (sectionId) => {
        set((state) => {
          const { [sectionId]: _, ...rest } = state.capacityOverrides
          return { capacityOverrides: rest }
        })
      },

      clearAllOverrides: () => {
        set({ capacityOverrides: {} })
      },
    }),
    {
      name: 'sections-page-ui',
      // Сериализация Set → Array для localStorage
      partialize: (state) => ({
        expandedNodes: state.expandedNodes,
        capacityOverrides: state.capacityOverrides,
      }),
    }
  )
)
