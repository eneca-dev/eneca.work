/**
 * Departments Timeline Module - Stores
 *
 * Zustand stores для локального состояния модуля
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { TreeNodeType } from '../types'

// ============================================================================
// UI State Store
// ============================================================================

/** Формат для сериализации expandedNodes в localStorage */
type SerializedExpandedNodes = Record<TreeNodeType, string[]>

interface UIState {
  /** Развёрнутые узлы по типу */
  expandedNodes: Record<TreeNodeType, Set<string>>
  /** Выбранный элемент для детального просмотра */
  selectedItemId: string | null
  /** Тип выбранного элемента */
  selectedItemType: TreeNodeType | null
  /** Переопределения ёмкости для ObjectSection (osId → dateStr → capacity) */
  capacityOverrides: Record<string, Record<string, number>>

  // Check operations
  isExpanded: (type: TreeNodeType, id: string) => boolean

  // Toggle operations
  toggleNode: (type: TreeNodeType, id: string) => void
  expandNode: (type: TreeNodeType, id: string) => void
  collapseNode: (type: TreeNodeType, id: string) => void

  // Batch operations (эффективнее чем множество expandNode)
  batchExpand: (nodes: Array<{ type: TreeNodeType; id: string }>) => void
  batchCollapse: (nodes: Array<{ type: TreeNodeType; id: string }>) => void

  // Bulk operations
  expandAll: (nodesByType: Partial<Record<TreeNodeType, string[]>>) => void
  collapseAll: (type?: TreeNodeType) => void

  // Selection
  setSelectedItem: (id: string | null, type?: TreeNodeType | null) => void

  // Capacity (per-date)
  setCapacity: (osId: string, dateStr: string, value: number) => void
}

const createEmptyExpandedNodes = (): Record<TreeNodeType, Set<string>> => ({
  department: new Set(),
  team: new Set(),
  employee: new Set(),
  project: new Set(),
  object: new Set(),
  section: new Set(),
})

/** Сериализация Set в массив для localStorage */
const serializeExpandedNodes = (
  nodes: Record<TreeNodeType, Set<string>>
): SerializedExpandedNodes => ({
  department: Array.from(nodes.department),
  team: Array.from(nodes.team),
  employee: Array.from(nodes.employee),
  project: Array.from(nodes.project),
  object: Array.from(nodes.object),
  section: Array.from(nodes.section),
})

/** Десериализация массива в Set из localStorage */
const deserializeExpandedNodes = (
  nodes: SerializedExpandedNodes
): Record<TreeNodeType, Set<string>> => ({
  department: new Set(nodes.department || []),
  team: new Set(nodes.team || []),
  employee: new Set(nodes.employee || []),
  project: new Set(nodes.project || []),
  object: new Set(nodes.object || []),
  section: new Set(nodes.section || []),
})

export const useDepartmentsTimelineUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get): UIState => ({
        expandedNodes: createEmptyExpandedNodes(),
        selectedItemId: null,
        selectedItemType: null,
        capacityOverrides: {},

        isExpanded: (type, id) => get().expandedNodes[type].has(id),

        toggleNode: (type, id) =>
          set((state) => {
            const newSet = new Set(state.expandedNodes[type])
            if (newSet.has(id)) {
              newSet.delete(id)
            } else {
              newSet.add(id)
            }
            return {
              expandedNodes: {
                ...state.expandedNodes,
                [type]: newSet,
              },
            }
          }),

        expandNode: (type, id) =>
          set((state) => {
            if (state.expandedNodes[type].has(id)) return state
            const newSet = new Set(state.expandedNodes[type])
            newSet.add(id)
            return {
              expandedNodes: {
                ...state.expandedNodes,
                [type]: newSet,
              },
            }
          }),

        collapseNode: (type, id) =>
          set((state) => {
            if (!state.expandedNodes[type].has(id)) return state
            const newSet = new Set(state.expandedNodes[type])
            newSet.delete(id)
            return {
              expandedNodes: {
                ...state.expandedNodes,
                [type]: newSet,
              },
            }
          }),

        batchExpand: (nodes) =>
          set((state) => {
            const newExpandedNodes = { ...state.expandedNodes }
            let hasChanges = false

            for (const { type, id } of nodes) {
              if (!newExpandedNodes[type].has(id)) {
                if (!hasChanges) {
                  // Клонируем все Set только если есть изменения
                  for (const key of Object.keys(newExpandedNodes) as TreeNodeType[]) {
                    newExpandedNodes[key] = new Set(newExpandedNodes[key])
                  }
                  hasChanges = true
                }
                newExpandedNodes[type].add(id)
              }
            }

            return hasChanges ? { expandedNodes: newExpandedNodes } : state
          }),

        batchCollapse: (nodes) =>
          set((state) => {
            const newExpandedNodes = { ...state.expandedNodes }
            let hasChanges = false

            for (const { type, id } of nodes) {
              if (newExpandedNodes[type].has(id)) {
                if (!hasChanges) {
                  for (const key of Object.keys(newExpandedNodes) as TreeNodeType[]) {
                    newExpandedNodes[key] = new Set(newExpandedNodes[key])
                  }
                  hasChanges = true
                }
                newExpandedNodes[type].delete(id)
              }
            }

            return hasChanges ? { expandedNodes: newExpandedNodes } : state
          }),

        expandAll: (nodesByType) =>
          set((state) => {
            const newExpandedNodes = { ...state.expandedNodes }

            for (const [type, ids] of Object.entries(nodesByType) as [TreeNodeType, string[]][]) {
              if (ids && ids.length > 0) {
                const newSet = new Set(state.expandedNodes[type])
                for (const id of ids) {
                  newSet.add(id)
                }
                newExpandedNodes[type] = newSet
              }
            }

            return { expandedNodes: newExpandedNodes }
          }),

        collapseAll: (type) =>
          set((state) => {
            if (type) {
              if (state.expandedNodes[type].size === 0) return state
              return {
                expandedNodes: {
                  ...state.expandedNodes,
                  [type]: new Set(),
                },
              }
            }
            return { expandedNodes: createEmptyExpandedNodes() }
          }),

        setSelectedItem: (id, type = null) =>
          set({ selectedItemId: id, selectedItemType: type }),

        setCapacity: (osId, dateStr, value) =>
          set((state) => ({
            capacityOverrides: {
              ...state.capacityOverrides,
              [osId]: { ...state.capacityOverrides[osId], [dateStr]: value },
            },
          })),
      }),
      {
        name: 'departments-timeline-ui-state',
        version: 1,
        migrate: (persisted: any, version: number) => {
          if (version === 0) {
            // v0 had capacityOverrides as Record<string, number>
            // v1 has Record<string, Record<string, number>>
            return { ...persisted, capacityOverrides: {} }
          }
          return persisted as any
        },
        partialize: (state) => ({
          expandedNodes: state.expandedNodes,
          capacityOverrides: state.capacityOverrides,
        }),
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name)
            if (!str) return null
            const parsed = JSON.parse(str)
            return {
              ...parsed,
              state: {
                ...parsed.state,
                expandedNodes: deserializeExpandedNodes(parsed.state.expandedNodes),
              },
            }
          },
          setItem: (name, value) => {
            const serialized = {
              ...value,
              state: {
                ...value.state,
                expandedNodes: serializeExpandedNodes(value.state.expandedNodes),
              },
            }
            localStorage.setItem(name, JSON.stringify(serialized))
          },
          removeItem: (name) => localStorage.removeItem(name),
        },
      }
    ),
    { name: 'DepartmentsTimelineUI' }
  )
)

// ============================================================================
// Convenience Hook for Row Components
// ============================================================================

/**
 * Хук для управления состоянием раскрытия строки
 *
 * Использует оптимизированный селектор для минимизации re-renders:
 * подписывается только на конкретный узел, а не на весь expandedNodes объект
 *
 * @example
 * const { isExpanded, toggle } = useRowExpanded('department', department.id)
 */
export function useRowExpanded(type: TreeNodeType, id: string) {
  // Оптимизированный селектор: подписываемся только на конкретный boolean
  // вместо всего объекта expandedNodes (избегаем лишних re-renders)
  const isExpanded = useDepartmentsTimelineUIStore(
    (state) => state.expandedNodes[type].has(id)
  )
  const toggleNode = useDepartmentsTimelineUIStore((state) => state.toggleNode)

  const toggle = () => toggleNode(type, id)

  return { isExpanded, toggle }
}

/**
 * Хук для получения per-date переопределений ёмкости ObjectSection
 */
export function useDateCapacityOverrides(osId: string): Record<string, number> {
  return useDepartmentsTimelineUIStore(
    (state) => state.capacityOverrides[osId] ?? EMPTY_DATE_OVERRIDES
  )
}

const EMPTY_DATE_OVERRIDES: Record<string, number> = {}
