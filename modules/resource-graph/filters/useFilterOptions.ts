/**
 * Resource Graph Filters - Filter Options Hooks
 *
 * Хуки для загрузки данных структур (для автокомплита InlineFilter)
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getOrgStructure, getProjectStructure, getProjectTags } from '../actions'
import type { FilterOption } from '@/modules/inline-filter'

// ============================================================================
// Query Keys
// ============================================================================

const filterStructureKeys = {
  all: ['filter-structure'] as const,
  org: () => [...filterStructureKeys.all, 'org'] as const,
  project: () => [...filterStructureKeys.all, 'project'] as const,
  tags: () => [...filterStructureKeys.all, 'tags'] as const,
}

// ============================================================================
// Base Structure Hooks
// ============================================================================

/**
 * Загрузить организационную структуру
 */
export function useOrgStructure() {
  return useQuery({
    queryKey: filterStructureKeys.org(),
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
export function useProjectStructure() {
  return useQuery({
    queryKey: filterStructureKeys.project(),
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
export function useProjectTags() {
  return useQuery({
    queryKey: filterStructureKeys.tags(),
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
// Combined Filter Options Hook (для InlineFilter)
// ============================================================================

/**
 * Хук для получения всех опций фильтров в формате InlineFilter
 *
 * Возвращает массив FilterOption[] для автокомплита
 */
export function useFilterOptions() {
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
