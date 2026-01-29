/**
 * Resource Graph Module - Stores
 *
 * Zustand stores для локального состояния модуля
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { Building2, Users, FolderKanban, Tag, CircleDot } from 'lucide-react'
import type { TimelineScale, DisplaySettings, TreeNodeType } from '../types'
import { DEFAULT_DISPLAY_SETTINGS } from '../constants'
import type { FilterConfig, FilterQueryParams } from '@/modules/inline-filter'
import { parseFilterString, tokensToQueryParams, hasActiveFilters } from '@/modules/inline-filter'

// ============================================================================
// Filter Config (конфигурация ключей фильтра)
// ============================================================================

export const RESOURCE_GRAPH_FILTER_CONFIG: FilterConfig = {
  keys: {
    'подразделение': {
      field: 'subdivision_id',
      label: 'Подразделение',
      icon: Building2,
      color: 'violet',
    },
    'отдел': {
      field: 'department_id',
      label: 'Отдел',
      icon: Users,
      color: 'blue',
    },
    'проект': {
      field: 'project_id',
      label: 'Проект',
      icon: FolderKanban,
      color: 'amber',
    },
    'метка': {
      field: 'tag_id',
      label: 'Метка проекта',
      multiple: true,
      icon: Tag,
      color: 'emerald',
    },
    'статус проекта': {
      field: 'project_status',
      label: 'Статус проекта',
      icon: CircleDot,
      color: 'cyan',
    },
  },
  placeholder: 'Фильтр: подразделение:"ОВ" проект:"Название" статус проекта:"active"',
}

// ============================================================================
// Display Settings Store
// ============================================================================

interface DisplaySettingsState {
  settings: DisplaySettings
  setScale: (scale: TimelineScale) => void
  toggleWeekends: () => void
  toggleHolidays: () => void
  toggleCompactMode: () => void
  resetSettings: () => void
}

export const useDisplaySettingsStore = create<DisplaySettingsState>()(
  devtools(
    persist(
      (set) => ({
        settings: DEFAULT_DISPLAY_SETTINGS,

        setScale: (scale) =>
          set((state) => ({
            settings: { ...state.settings, scale },
          })),

        toggleWeekends: () =>
          set((state) => ({
            settings: { ...state.settings, showWeekends: !state.settings.showWeekends },
          })),

        toggleHolidays: () =>
          set((state) => ({
            settings: { ...state.settings, showHolidays: !state.settings.showHolidays },
          })),

        toggleCompactMode: () =>
          set((state) => ({
            settings: { ...state.settings, compactMode: !state.settings.compactMode },
          })),

        resetSettings: () =>
          set({ settings: DEFAULT_DISPLAY_SETTINGS }),
      }),
      {
        name: 'resource-graph-display-settings',
      }
    )
  )
)

// ============================================================================
// Filters Store (упрощённый - одна строка фильтра)
// ============================================================================

interface FiltersState {
  /** Строка инлайн-фильтра */
  filterString: string
  /** Установить строку фильтра */
  setFilterString: (value: string) => void
  /** Очистить фильтры */
  clearFilters: () => void
  /** Получить распарсенные параметры для запроса */
  getQueryParams: () => FilterQueryParams
  /** Проверить есть ли активные фильтры */
  hasFilters: () => boolean
}

export const useFiltersStore = create<FiltersState>()(
  devtools(
    persist(
      (set, get) => ({
        filterString: '',

        setFilterString: (value) => set({ filterString: value }),

        clearFilters: () => set({ filterString: '' }),

        getQueryParams: () => {
          const { filterString } = get()
          const parsed = parseFilterString(filterString, RESOURCE_GRAPH_FILTER_CONFIG)
          return tokensToQueryParams(parsed.tokens, RESOURCE_GRAPH_FILTER_CONFIG)
        },

        hasFilters: () => {
          const { filterString } = get()
          return hasActiveFilters(filterString, RESOURCE_GRAPH_FILTER_CONFIG)
        },
      }),
      {
        name: 'resource-graph-filters',
      }
    )
  )
)

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

  // Check operations
  isExpanded: (type: TreeNodeType, id: string) => boolean

  // Toggle operations
  toggleNode: (type: TreeNodeType, id: string) => void
  expandNode: (type: TreeNodeType, id: string) => void
  collapseNode: (type: TreeNodeType, id: string) => void

  // Batch operations (эффективнее чем множество expandNode)
  batchExpand: (nodes: Array<{ type: TreeNodeType; id: string }>) => void
  batchCollapse: (nodes: Array<{ type: TreeNodeType; id: string }>) => void

  // Selection
  setSelectedItem: (id: string | null, type?: TreeNodeType | null) => void
}

const createEmptyExpandedNodes = (): Record<TreeNodeType, Set<string>> => ({
  project: new Set(),
  stage: new Set(),
  object: new Set(),
  section: new Set(),
  decomposition_stage: new Set(),
  decomposition_item: new Set(),
})

/** Сериализация Set в массив для localStorage */
const serializeExpandedNodes = (
  nodes: Record<TreeNodeType, Set<string>>
): SerializedExpandedNodes => ({
  project: Array.from(nodes.project),
  stage: Array.from(nodes.stage),
  object: Array.from(nodes.object),
  section: Array.from(nodes.section),
  decomposition_stage: Array.from(nodes.decomposition_stage),
  decomposition_item: Array.from(nodes.decomposition_item),
})

/** Десериализация массива в Set из localStorage */
const deserializeExpandedNodes = (
  nodes: SerializedExpandedNodes
): Record<TreeNodeType, Set<string>> => ({
  project: new Set(nodes.project || []),
  stage: new Set(nodes.stage || []),
  object: new Set(nodes.object || []),
  section: new Set(nodes.section || []),
  decomposition_stage: new Set(nodes.decomposition_stage || []),
  decomposition_item: new Set(nodes.decomposition_item || []),
})

export const useUIStateStore = create<UIState>()(
  devtools(
    persist(
      (set, get): UIState => ({
        expandedNodes: createEmptyExpandedNodes(),
        selectedItemId: null,
        selectedItemType: null,

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

        setSelectedItem: (id, type = null) =>
          set({ selectedItemId: id, selectedItemType: type }),
      }),
      {
        name: 'resource-graph-ui-state',
        partialize: (state) => ({
          expandedNodes: state.expandedNodes,
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
    )
  )
)

// ============================================================================
// Convenience Hook for Row Components
// ============================================================================

/**
 * Хук для управления состоянием раскрытия строки
 *
 * @example
 * const { isExpanded, toggle } = useRowExpanded('project', project.id)
 */
export function useRowExpanded(type: TreeNodeType, id: string) {
  const expandedNodes = useUIStateStore((state) => state.expandedNodes)
  const toggleNode = useUIStateStore((state) => state.toggleNode)

  const isExpanded = expandedNodes[type].has(id)
  const toggle = () => toggleNode(type, id)

  return { isExpanded, toggle }
}
