'use client'

/**
 * Kanban Filters - Filter Options Hook
 *
 * Хук для загрузки данных для автокомплита InlineFilter.
 * Использует те же данные что и resource-graph для единообразия.
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { FilterOption } from '@/modules/inline-filter'
import {
  getOrgStructure,
  getProjectStructure,
  getProjectTags,
} from '@/modules/resource-graph/actions'

// ============================================================================
// Query Keys
// ============================================================================

const kanbanFilterKeys = {
  all: ['kanban-filter-structure'] as const,
  org: () => [...kanbanFilterKeys.all, 'org'] as const,
  project: () => [...kanbanFilterKeys.all, 'project'] as const,
  tags: () => [...kanbanFilterKeys.all, 'tags'] as const,
}

// ============================================================================
// Base Structure Hooks
// ============================================================================

/**
 * Загрузить организационную структуру
 */
function useOrgStructure() {
  return useQuery({
    queryKey: kanbanFilterKeys.org(),
    queryFn: async () => {
      const result = await getOrgStructure()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

/**
 * Загрузить проектную структуру
 */
function useProjectStructure() {
  return useQuery({
    queryKey: kanbanFilterKeys.project(),
    queryFn: async () => {
      const result = await getProjectStructure()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}

/**
 * Загрузить теги проектов
 */
function useProjectTags() {
  return useQuery({
    queryKey: kanbanFilterKeys.tags(),
    queryFn: async () => {
      const result = await getProjectTags()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

// ============================================================================
// Combined Filter Options Hook
// ============================================================================

/**
 * Хук для получения всех опций фильтров в формате InlineFilter
 *
 * Использует те же данные что и resource-graph для единообразия.
 *
 * @example
 * const { options, isLoading } = useKanbanFilterOptions()
 *
 * <InlineFilter
 *   config={KANBAN_FILTER_CONFIG}
 *   value={filterString}
 *   onChange={setFilterString}
 *   options={options}
 * />
 */
export function useKanbanFilterOptions() {
  const { data: orgStructure, isLoading: loadingOrg } = useOrgStructure()
  const { data: projectStructure, isLoading: loadingProject } = useProjectStructure()
  const { data: tags, isLoading: loadingTags } = useProjectTags()

  const options = useMemo<FilterOption[]>(() => {
    const result: FilterOption[] = []

    // Подразделения
    if (orgStructure?.subdivisions) {
      for (const item of orgStructure.subdivisions) {
        result.push({ id: item.id, name: item.name, key: 'подразделение' })
      }
    }

    // Отделы
    if (orgStructure?.departments) {
      for (const item of orgStructure.departments) {
        result.push({ id: item.id, name: item.name, key: 'отдел' })
      }
    }

    // Команды
    if (orgStructure?.teams) {
      for (const item of orgStructure.teams) {
        result.push({ id: item.id, name: item.name, key: 'команда' })
      }
    }

    // Ответственные (сотрудники)
    if (orgStructure?.employees) {
      for (const item of orgStructure.employees) {
        result.push({ id: item.id, name: item.name, key: 'ответственный' })
      }
    }

    // Проекты
    if (projectStructure?.projects) {
      for (const item of projectStructure.projects) {
        result.push({ id: item.id, name: item.name, key: 'проект' })
      }
    }

    // Метки
    if (tags) {
      for (const tag of tags) {
        result.push({ id: tag.id, name: tag.name, key: 'метка' })
      }
    }

    return result
  }, [orgStructure, projectStructure, tags])

  return {
    options,
    isLoading: loadingOrg || loadingProject || loadingTags,
  }
}
