/**
 * Resource Graph Module - Stores
 *
 * Zustand stores для локального состояния модуля
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { Building2, Users, FolderKanban, Tag } from 'lucide-react'
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
  },
  placeholder: 'Фильтр: подразделение:"ОВ" проект:"Название"',
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

interface UIState {
  /** Развёрнутые узлы по типу */
  expandedNodes: Record<TreeNodeType, Set<string>>
  /** Выбранный элемент для детального просмотра */
  selectedItemId: string | null
  /** Тип выбранного элемента */
  selectedItemType: TreeNodeType | null

  // Toggle operations
  toggleNode: (type: TreeNodeType, id: string) => void
  expandNode: (type: TreeNodeType, id: string) => void
  collapseNode: (type: TreeNodeType, id: string) => void

  // Bulk operations
  expandAll: (type?: TreeNodeType) => void
  collapseAll: (type?: TreeNodeType) => void

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

export const useUIStateStore = create<UIState>()(
  devtools(
    (set) => ({
      expandedNodes: createEmptyExpandedNodes(),
      selectedItemId: null,
      selectedItemType: null,

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
          const newSet = new Set(state.expandedNodes[type])
          newSet.delete(id)
          return {
            expandedNodes: {
              ...state.expandedNodes,
              [type]: newSet,
            },
          }
        }),

      expandAll: (type) =>
        set((state) => {
          if (type) {
            return state
          }
          return { expandedNodes: createEmptyExpandedNodes() }
        }),

      collapseAll: (type) =>
        set((state) => {
          if (type) {
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
    })
  )
)
