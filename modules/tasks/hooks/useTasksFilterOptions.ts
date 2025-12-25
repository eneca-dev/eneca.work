/**
 * Tasks Filter Options Hook
 *
 * Загружает все опции фильтров для страницы Задачи
 * Объединяет опции из resource-graph (org + project + tags)
 */

'use client'

import { useMemo } from 'react'
import {
  createSimpleCacheQuery,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import { getOrgStructure, getProjectStructure, getProjectTags } from '@/modules/resource-graph/actions'
import type { FilterOption } from '@/modules/inline-filter'
import type { OrgStructure, ProjectStructure, ProjectTag } from '@/modules/resource-graph/types'

// ============================================================================
// Base Structure Hooks
// ============================================================================

const useOrgStructure = createSimpleCacheQuery<OrgStructure>({
  queryKey: queryKeys.filterStructure.org(),
  queryFn: getOrgStructure,
  staleTime: staleTimePresets.static,
})

const useProjectStructure = createSimpleCacheQuery<ProjectStructure>({
  queryKey: queryKeys.filterStructure.project(),
  queryFn: getProjectStructure,
  staleTime: staleTimePresets.medium,
})

const useProjectTags = createSimpleCacheQuery<ProjectTag[]>({
  queryKey: queryKeys.filterStructure.tags(),
  queryFn: getProjectTags,
  staleTime: staleTimePresets.static,
})

// ============================================================================
// Combined Filter Options Hook
// ============================================================================

/**
 * Загружает все опции фильтров для страницы Задачи
 *
 * Включает: подразделения, отделы, команды, ответственных, проекты, метки
 */
export function useTasksFilterOptions() {
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
