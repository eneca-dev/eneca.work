/**
 * Resource Graph Module - Stores
 *
 * Zustand stores для локального состояния модуля
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { TimelineScale, DisplaySettings, ResourceGraphFilters, TreeNodeType } from '../types'
import { DEFAULT_DISPLAY_SETTINGS } from '../constants'

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
// Filters Store
// ============================================================================

interface FiltersState {
  filters: ResourceGraphFilters

  // Setters
  setFilters: (filters: Partial<ResourceGraphFilters>) => void
  setManagerId: (managerId: string | null) => void
  setProjectId: (projectId: string | null) => void
  setStageId: (stageId: string | null) => void
  setObjectId: (objectId: string | null) => void
  setSectionId: (sectionId: string | null) => void
  setSubdivisionId: (subdivisionId: string | null) => void
  setDepartmentId: (departmentId: string | null) => void
  setTeamId: (teamId: string | null) => void
  setEmployeeId: (employeeId: string | null) => void
  setTagIds: (tagIds: string[]) => void
  setSearch: (search: string) => void

  // Clear
  clearFilters: () => void
  clearProjectFilters: () => void
  clearOrgFilters: () => void
}

const DEFAULT_FILTERS: ResourceGraphFilters = {}

export const useFiltersStore = create<FiltersState>()(
  devtools(
    persist(
      (set) => ({
        filters: DEFAULT_FILTERS,

        setFilters: (newFilters) =>
          set((state) => ({
            filters: { ...state.filters, ...newFilters },
          })),

        // Project filters (with cascade)
        setManagerId: (managerId) =>
          set((state) => ({
            filters: {
              ...state.filters,
              managerId: managerId || undefined,
              // Cascade: clear dependent filters
              projectId: undefined,
              stageId: undefined,
              objectId: undefined,
              sectionId: undefined,
            },
          })),

        setProjectId: (projectId) =>
          set((state) => ({
            filters: {
              ...state.filters,
              projectId: projectId || undefined,
              // Cascade: clear dependent filters
              stageId: undefined,
              objectId: undefined,
              sectionId: undefined,
            },
          })),

        setStageId: (stageId) =>
          set((state) => ({
            filters: {
              ...state.filters,
              stageId: stageId || undefined,
              // Cascade: clear dependent filters
              objectId: undefined,
              sectionId: undefined,
            },
          })),

        setObjectId: (objectId) =>
          set((state) => ({
            filters: {
              ...state.filters,
              objectId: objectId || undefined,
              // Cascade: clear dependent filters
              sectionId: undefined,
            },
          })),

        setSectionId: (sectionId) =>
          set((state) => ({
            filters: {
              ...state.filters,
              sectionId: sectionId || undefined,
            },
          })),

        // Org filters (with cascade)
        setSubdivisionId: (subdivisionId) =>
          set((state) => ({
            filters: {
              ...state.filters,
              subdivisionId: subdivisionId || undefined,
              // Cascade: clear dependent filters
              departmentId: undefined,
              teamId: undefined,
              employeeId: undefined,
            },
          })),

        setDepartmentId: (departmentId) =>
          set((state) => ({
            filters: {
              ...state.filters,
              departmentId: departmentId || undefined,
              // Cascade: clear dependent filters
              teamId: undefined,
              employeeId: undefined,
            },
          })),

        setTeamId: (teamId) =>
          set((state) => ({
            filters: {
              ...state.filters,
              teamId: teamId || undefined,
              // Cascade: clear dependent filters
              employeeId: undefined,
            },
          })),

        setEmployeeId: (employeeId) =>
          set((state) => ({
            filters: {
              ...state.filters,
              employeeId: employeeId || undefined,
            },
          })),

        setTagIds: (tagIds) =>
          set((state) => ({
            filters: {
              ...state.filters,
              tagIds: tagIds.length > 0 ? tagIds : undefined,
            },
          })),

        setSearch: (search) =>
          set((state) => ({
            filters: { ...state.filters, search: search || undefined },
          })),

        clearFilters: () =>
          set({ filters: DEFAULT_FILTERS }),

        clearProjectFilters: () =>
          set((state) => ({
            filters: {
              ...state.filters,
              managerId: undefined,
              projectId: undefined,
              stageId: undefined,
              objectId: undefined,
              sectionId: undefined,
              tagIds: undefined,
            },
          })),

        clearOrgFilters: () =>
          set((state) => ({
            filters: {
              ...state.filters,
              subdivisionId: undefined,
              departmentId: undefined,
              teamId: undefined,
              employeeId: undefined,
            },
          })),
      }),
      {
        name: 'resource-graph-filters',
        partialize: (state) => ({
          filters: state.filters,
        }),
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
            // Expand all of specific type - need data to know IDs
            // This is a placeholder - real implementation would need data
            return state
          }
          // Expand all - reset to empty (all collapsed by default)
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
