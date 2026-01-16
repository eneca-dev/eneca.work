/**
 * Tasks Module - Unified Stores
 *
 * Общие stores для страницы Задачи (объединяет resource-graph и kanban)
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { Building2, Users, FolderKanban, Tag, UsersRound, UserCircle } from 'lucide-react'
import type { FilterConfig, FilterQueryParams } from '@/modules/inline-filter'
import {
  parseFilterString,
  tokensToQueryParams,
  hasActiveFilters,
} from '@/modules/inline-filter'

// ============================================================================
// View Mode Types
// ============================================================================

export type TasksViewMode = 'kanban' | 'timeline' | 'budgets' | 'departments'

// ============================================================================
// Unified Filter Config (объединение resource-graph + kanban)
// ============================================================================

export const TASKS_FILTER_CONFIG: FilterConfig = {
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
    'команда': {
      field: 'team_id',
      label: 'Команда',
      icon: UsersRound,
      color: 'cyan',
    },
    'ответственный': {
      field: 'responsible_id',
      label: 'Ответственный',
      icon: UserCircle,
      color: 'rose',
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
// Unified Filters Store
// ============================================================================

interface TasksFiltersState {
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
  /** Обновить имя проекта в фильтре (при переименовании) */
  updateProjectName: (oldName: string, newName: string) => void
  /** Удалить проект из фильтра (при удалении) */
  removeProjectFilter: (projectName: string) => void
}

export const useTasksFiltersStore = create<TasksFiltersState>()(
  devtools(
    persist(
      (set, get) => ({
        filterString: '',

        setFilterString: (value) => set({ filterString: value }),

        clearFilters: () => set({ filterString: '' }),

        getQueryParams: () => {
          const { filterString } = get()
          const parsed = parseFilterString(filterString, TASKS_FILTER_CONFIG)
          return tokensToQueryParams(parsed.tokens, TASKS_FILTER_CONFIG)
        },

        hasFilters: () => {
          const { filterString } = get()
          return hasActiveFilters(filterString, TASKS_FILTER_CONFIG)
        },

        updateProjectName: (oldName, newName) => {
          const { filterString } = get()
          if (!filterString.includes('проект:')) return

          // Replace project name in filter string
          // Handles both quoted and unquoted values
          const patterns = [
            new RegExp(`проект:"${oldName}"`, 'g'),
            new RegExp(`проект:${oldName}(?=\\s|$)`, 'g'),
          ]

          let updated = filterString
          for (const pattern of patterns) {
            updated = updated.replace(pattern, `проект:"${newName}"`)
          }

          if (updated !== filterString) {
            set({ filterString: updated })
          }
        },

        removeProjectFilter: (projectName) => {
          const { filterString } = get()
          if (!filterString.includes('проект:')) return

          // Remove project filter token
          const patterns = [
            new RegExp(`проект:"${projectName}"\\s*`, 'g'),
            new RegExp(`проект:${projectName}\\s*`, 'g'),
          ]

          let updated = filterString
          for (const pattern of patterns) {
            updated = updated.replace(pattern, '')
          }

          // Trim extra spaces
          updated = updated.trim().replace(/\s+/g, ' ')

          if (updated !== filterString) {
            set({ filterString: updated })
          }
        },
      }),
      {
        name: 'tasks-filters',
      }
    )
  )
)

// ============================================================================
// View Mode Store
// ============================================================================

interface TasksViewState {
  /** Текущий режим отображения */
  viewMode: TasksViewMode
  /** Установить режим отображения */
  setViewMode: (mode: TasksViewMode) => void
}

export const useTasksViewStore = create<TasksViewState>()(
  devtools(
    persist(
      (set) => ({
        viewMode: 'kanban',

        setViewMode: (mode) => set({ viewMode: mode }),
      }),
      {
        name: 'tasks-view-mode',
      }
    )
  )
)
