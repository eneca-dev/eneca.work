/**
 * Resource Graph Filters - Filter Options Hooks
 *
 * Хуки для загрузки данных структур (для автокомплита InlineFilter)
 * Используют фабрики из cache module
 */

'use client'

import { useMemo } from 'react'
import {
  createSimpleCacheQuery,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import { getOrgStructure, getProjectStructure, getProjectTags } from '../actions'
import type { FilterOption } from '@/modules/inline-filter'
import type { OrgStructure, ProjectStructure, ProjectTag, ProjectStatusType } from '../types'

// ============================================================================
// Base Structure Hooks (используют cache module фабрики)
// ============================================================================

/**
 * Загрузить организационную структуру
 *
 * @example
 * const { data: orgStructure, isLoading } = useOrgStructure()
 */
export const useOrgStructure = createSimpleCacheQuery<OrgStructure>({
  queryKey: queryKeys.filterStructure.org(),
  queryFn: getOrgStructure,
  staleTime: staleTimePresets.static, // 10 минут - структура редко меняется
})

/**
 * Загрузить проектную структуру
 *
 * @example
 * const { data: projectStructure, isLoading } = useProjectStructure()
 */
export const useProjectStructure = createSimpleCacheQuery<ProjectStructure>({
  queryKey: queryKeys.filterStructure.project(),
  queryFn: getProjectStructure,
  staleTime: staleTimePresets.medium, // 5 минут - проекты меняются чаще
})

/**
 * Загрузить теги проектов
 *
 * @example
 * const { data: tags, isLoading } = useProjectTags()
 */
export const useProjectTags = createSimpleCacheQuery<ProjectTag[]>({
  queryKey: queryKeys.filterStructure.tags(),
  queryFn: getProjectTags,
  staleTime: staleTimePresets.static, // 10 минут - теги редко меняются
})

// ============================================================================
// Static Options (статичные данные из enum, не требуют запроса к БД)
// ============================================================================

/**
 * Статусы проектов с русскими названиями
 * Значения соответствуют project_status_enum в БД
 * Используется `satisfies` для compile-time валидации enum значений
 */
const PROJECT_STATUS_OPTIONS: FilterOption[] = [
  { id: 'active' satisfies ProjectStatusType, name: 'В работе', key: 'статус проекта' },
  { id: 'draft' satisfies ProjectStatusType, name: 'Черновик', key: 'статус проекта' },
  { id: 'potential project' satisfies ProjectStatusType, name: 'Потенциальный проект', key: 'статус проекта' },
  { id: 'completed' satisfies ProjectStatusType, name: 'Завершён', key: 'статус проекта' },
  { id: 'paused' satisfies ProjectStatusType, name: 'Приостановлен', key: 'статус проекта' },
  { id: 'waiting for input data' satisfies ProjectStatusType, name: 'Ожидание исходных данных', key: 'статус проекта' },
  { id: 'author supervision' satisfies ProjectStatusType, name: 'Авторский надзор', key: 'статус проекта' },
  { id: 'actual calculation' satisfies ProjectStatusType, name: 'Актуализация расчёта', key: 'статус проекта' },
  { id: 'customer approval' satisfies ProjectStatusType, name: 'Согласование с заказчиком', key: 'статус проекта' },
]

// ============================================================================
// Combined Filter Options Hook (для InlineFilter)
// ============================================================================

/**
 * Хук для получения всех опций фильтров в формате InlineFilter
 *
 * Возвращает массив FilterOption[] для автокомплита
 *
 * @example
 * const { options, isLoading } = useFilterOptions()
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

    // Статусы проектов (статичные, из enum)
    result.push(...PROJECT_STATUS_OPTIONS)

    return result
  }, [orgStructure, projectStructure, tags])

  return {
    options,
    isLoading: loadingOrg || loadingProject || loadingTags,
  }
}
