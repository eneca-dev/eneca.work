/**
 * Tasks Tabs Store
 *
 * Управление вкладками на странице Задачи.
 * Каждая вкладка хранит свой viewMode и filterString.
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'

// ============================================================================
// Types
// ============================================================================

export type TasksViewMode = 'kanban' | 'timeline' | 'budgets' | 'departments' | 'sections'

// Маппинг viewMode → иконка (lucide-react)
export const VIEW_MODE_ICONS = {
  kanban: 'LayoutGrid',
  timeline: 'GanttChart',
  departments: 'Users',
  budgets: 'Wallet',
  sections: 'FolderTree',
} as const

export type TabIconName = (typeof VIEW_MODE_ICONS)[TasksViewMode]

export interface TaskTab {
  id: string
  name: string
  viewMode: TasksViewMode
  filterString: string
  isSystem: boolean // true = нельзя удалить/редактировать
  order: number
  createdAt: string
}

// Helper: получить иконку для viewMode
export function getTabIcon(viewMode: TasksViewMode): TabIconName {
  return VIEW_MODE_ICONS[viewMode]
}

// Лимит пользовательских вкладок
export const MAX_USER_TABS = 10

export type CreateTabInput = Pick<TaskTab, 'name' | 'viewMode'> & {
  filterString?: string
}

export type UpdateTabInput = Partial<Pick<TaskTab, 'name' | 'viewMode' | 'filterString'>>

// ============================================================================
// System Tabs (нельзя удалить/переименовать)
// ============================================================================

const SYSTEM_TABS: TaskTab[] = [
  {
    id: 'kanban',
    name: 'Канбан',
    viewMode: 'kanban',
    filterString: '',
    isSystem: true,
    order: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'timeline',
    name: 'График',
    viewMode: 'timeline',
    filterString: '',
    isSystem: true,
    order: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'departments',
    name: 'Отделы',
    viewMode: 'departments',
    filterString: '',
    isSystem: true,
    order: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'budgets',
    name: 'Бюджеты',
    viewMode: 'budgets',
    filterString: '',
    isSystem: true,
    order: 3,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'sections',
    name: 'Разделы',
    viewMode: 'sections',
    filterString: '',
    isSystem: true,
    order: 4,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
]

// ============================================================================
// Store Interface
// ============================================================================

interface TasksTabsState {
  tabs: TaskTab[]
  activeTabId: string | null

  // Navigation
  setActiveTab: (id: string) => void
  getActiveTab: () => TaskTab | undefined

  // CRUD for user tabs
  createTab: (input: CreateTabInput) => string | null
  updateTab: (id: string, updates: UpdateTabInput) => void
  deleteTab: (id: string) => void
  canCreateTab: () => boolean

  // Reorder (for drag & drop)
  reorderTabs: (fromIndex: number, toIndex: number) => void

  // Shortcuts for active tab
  updateActiveTabFilters: (filterString: string) => void
  updateActiveTabViewMode: (viewMode: TasksViewMode) => void

  // Helpers
  getSystemTabs: () => TaskTab[]
  getUserTabs: () => TaskTab[]

  // Project filter sync (при переименовании/удалении проекта)
  updateProjectName: (oldName: string, newName: string) => void
  removeProjectFilter: (projectName: string) => void
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useTasksTabsStore = create<TasksTabsState>()(
  devtools(
    persist(
      (set, get) => ({
        tabs: [...SYSTEM_TABS],
        activeTabId: 'kanban',

        // ─────────────────────────────────────────────────────────────────
        // Navigation
        // ─────────────────────────────────────────────────────────────────

        setActiveTab: (id) => {
          const tab = get().tabs.find((t) => t.id === id)
          if (tab) {
            set({ activeTabId: id })
          }
        },

        getActiveTab: () => {
          const { tabs, activeTabId } = get()
          return tabs.find((t) => t.id === activeTabId)
        },

        // ─────────────────────────────────────────────────────────────────
        // CRUD
        // ─────────────────────────────────────────────────────────────────

        createTab: (input) => {
          const { tabs } = get()

          // Проверка лимита (MAX_USER_TABS всего вкладок)
          if (tabs.length >= MAX_USER_TABS) {
            return null
          }

          const id = nanoid(8)
          const maxOrder = Math.max(...tabs.map((t) => t.order), -1)

          const newTab: TaskTab = {
            id,
            name: input.name,
            viewMode: input.viewMode,
            filterString: input.filterString ?? '',
            isSystem: false,
            order: maxOrder + 1,
            createdAt: new Date().toISOString(),
          }

          set({ tabs: [...tabs, newTab], activeTabId: id })
          return id
        },

        updateTab: (id, updates) => {
          const { tabs } = get()
          const tab = tabs.find((t) => t.id === id)

          // Нельзя редактировать системные вкладки (кроме filterString)
          if (!tab) return
          if (tab.isSystem && updates.name) return

          set({
            tabs: tabs.map((t) =>
              t.id === id ? { ...t, ...updates } : t
            ),
          })
        },

        deleteTab: (id) => {
          const { tabs, activeTabId } = get()
          const tab = tabs.find((t) => t.id === id)

          if (!tab) return

          const newTabs = tabs.filter((t) => t.id !== id)

          // Если удаляем активную вкладку — переключаемся на первую оставшуюся
          // Если вкладок не осталось — activeTabId будет null
          const newActiveId = activeTabId === id
            ? (newTabs[0]?.id ?? null)
            : activeTabId

          set({ tabs: newTabs, activeTabId: newActiveId })
        },

        // ─────────────────────────────────────────────────────────────────
        // Reorder
        // ─────────────────────────────────────────────────────────────────

        reorderTabs: (fromIndex, toIndex) => {
          const { tabs } = get()
          const reordered = [...tabs]
          const [moved] = reordered.splice(fromIndex, 1)
          reordered.splice(toIndex, 0, moved)

          // Update order field
          const updated = reordered.map((tab, index) => ({
            ...tab,
            order: index,
          }))

          set({ tabs: updated })
        },

        // ─────────────────────────────────────────────────────────────────
        // Active Tab Shortcuts
        // ─────────────────────────────────────────────────────────────────

        updateActiveTabFilters: (filterString) => {
          const { tabs, activeTabId } = get()
          set({
            tabs: tabs.map((t) =>
              t.id === activeTabId ? { ...t, filterString } : t
            ),
          })
        },

        updateActiveTabViewMode: (viewMode) => {
          const { tabs, activeTabId } = get()
          const tab = tabs.find((t) => t.id === activeTabId)

          // Для системных вкладок viewMode фиксирован
          if (tab?.isSystem) return

          set({
            tabs: tabs.map((t) =>
              t.id === activeTabId ? { ...t, viewMode } : t
            ),
          })
        },

        // ─────────────────────────────────────────────────────────────────
        // Helpers
        // ─────────────────────────────────────────────────────────────────

        getSystemTabs: () => get().tabs.filter((t) => t.isSystem),
        getUserTabs: () => get().tabs.filter((t) => !t.isSystem),
        canCreateTab: () => get().tabs.length < MAX_USER_TABS,

        // ─────────────────────────────────────────────────────────────────
        // Project Filter Sync
        // ─────────────────────────────────────────────────────────────────

        updateProjectName: (oldName, newName) => {
          const { tabs } = get()

          const updatedTabs = tabs.map((tab) => {
            if (!tab.filterString.includes('проект:')) return tab

            const patterns = [
              new RegExp(`проект:"${oldName}"`, 'g'),
              new RegExp(`проект:${oldName}(?=\\s|$)`, 'g'),
            ]

            let updated = tab.filterString
            for (const pattern of patterns) {
              updated = updated.replace(pattern, `проект:"${newName}"`)
            }

            return updated !== tab.filterString
              ? { ...tab, filterString: updated }
              : tab
          })

          set({ tabs: updatedTabs })
        },

        removeProjectFilter: (projectName) => {
          const { tabs } = get()

          const updatedTabs = tabs.map((tab) => {
            if (!tab.filterString.includes('проект:')) return tab

            const patterns = [
              new RegExp(`проект:"${projectName}"\\s*`, 'g'),
              new RegExp(`проект:${projectName}\\s*`, 'g'),
            ]

            let updated = tab.filterString
            for (const pattern of patterns) {
              updated = updated.replace(pattern, '')
            }
            updated = updated.trim().replace(/\s+/g, ' ')

            return updated !== tab.filterString
              ? { ...tab, filterString: updated }
              : tab
          })

          set({ tabs: updatedTabs })
        },
      }),
      {
        name: 'tasks-tabs',
        version: 1,
        // Мигрируем старые данные если нужно
        migrate: (persisted, version) => {
          if (version === 0 || !persisted) {
            return {
              tabs: [...SYSTEM_TABS],
              activeTabId: 'kanban',
            }
          }
          return persisted as TasksTabsState
        },
      }
    ),
    { name: 'tasks-tabs' }
  )
)
