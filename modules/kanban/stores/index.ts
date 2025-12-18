/**
 * Kanban Module - Stores
 *
 * Zustand stores для локального состояния модуля
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

// Re-export kanban store
export * from './kanban-store'

// ============================================================================
// Filter Config (конфигурация ключей фильтра)
// ============================================================================

export const KANBAN_FILTER_CONFIG: FilterConfig = {
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
  placeholder: 'Фильтр: подразделение:"ОВ" команда:"Название" ответственный:"Иванов"',
}

// ============================================================================
// Filters Store (строка фильтра + persist)
// ============================================================================

interface KanbanFiltersState {
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

export const useKanbanFiltersStore = create<KanbanFiltersState>()(
  devtools(
    persist(
      (set, get) => ({
        filterString: '',

        setFilterString: (value) => set({ filterString: value }),

        clearFilters: () => set({ filterString: '' }),

        getQueryParams: () => {
          const { filterString } = get()
          const parsed = parseFilterString(filterString, KANBAN_FILTER_CONFIG)
          return tokensToQueryParams(parsed.tokens, KANBAN_FILTER_CONFIG)
        },

        hasFilters: () => {
          const { filterString } = get()
          return hasActiveFilters(filterString, KANBAN_FILTER_CONFIG)
        },
      }),
      {
        name: 'kanban-filters',
      }
    )
  )
)
