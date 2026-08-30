/**
 * Sections Page UI Store
 *
 * Zustand store для UI состояния страницы разделов:
 * - Expand/collapse узлов дерева
 *
 * Ёмкость (capacity) хранится на сервере (таблица section_capacity) и приходит
 * как часть иерархии — см. modules/sections-page/hooks/index.ts (useUpsertSectionCapacityBatch).
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CustomDateRange } from '@/modules/resource-graph/components/timeline'
import type { TimelineScaleMode } from '@/components/shared/timeline'

export type { CustomDateRange, TimelineScaleMode }

interface SectionsPageUIState {
  // ============================================================================
  // Timeline Date Range
  // ============================================================================

  /** Кастомный диапазон дат таймлайна (null = дефолтный 150+150) */
  customDateRange: CustomDateRange | null

  /** Установить кастомный диапазон */
  setCustomDateRange: (range: CustomDateRange | null) => void

  // ============================================================================
  // Timeline Scale
  // ============================================================================

  /** Масштаб таймлайна: 'day' | 'week' | 'month' */
  timelineScale: TimelineScaleMode

  /** Установить масштаб */
  setTimelineScale: (scale: TimelineScaleMode) => void

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
      // Timeline Date Range
      // ============================================================================

      customDateRange: null,
      setCustomDateRange: (range) => set({ customDateRange: range }),

      // ============================================================================
      // Timeline Scale Implementation
      // ============================================================================

      timelineScale: 'day',
      setTimelineScale: (scale) => set({ timelineScale: scale }),

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
    }),
    {
      name: 'sections-page-ui',
      // Сериализация Set → Array для localStorage
      partialize: (state) => ({
        expandedNodes: state.expandedNodes,
        customDateRange: state.customDateRange,
        timelineScale: state.timelineScale,
      }),
    }
  )
)
