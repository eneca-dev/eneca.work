/**
 * Tasks Filter Options Hook
 *
 * Загружает все опции фильтров для страницы Задачи
 * Объединяет опции из resource-graph (org + project + tags)
 * С учётом разрешений пользователя (filter-permissions)
 */

'use client'

import { useMemo } from 'react'
import {
  createSimpleCacheQuery,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import { getOrgStructure, getFilterProjects, getProjectTags } from '@/modules/resource-graph/actions'
import type { FilterOption } from '@/modules/inline-filter'
import type { OrgStructure, ProjectTag } from '@/modules/resource-graph/types'
import {
  useFilterContext,
  useFilteredOptions,
  getLockedFilters,
} from '@/modules/permissions'
import { expandScopeForTasksTabs } from '@/modules/permissions/utils/expand-scope-for-tasks'

// ============================================================================
// Base Structure Hooks
// ============================================================================

const useOrgStructure = createSimpleCacheQuery<OrgStructure>({
  queryKey: queryKeys.filterStructure.org(),
  queryFn: getOrgStructure,
  staleTime: staleTimePresets.static,
})

// Фильтру Задач из проектной структуры нужны ТОЛЬКО проекты → лёгкий источник
// (~132 строки вместо 4.4к section-grain из v_project_structure).
const useFilterProjects = createSimpleCacheQuery<Array<{ id: string; name: string }>>({
  queryKey: queryKeys.filterStructure.projectsLight(),
  queryFn: getFilterProjects,
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
 * Фильтрует опции на основе scope пользователя (filter-permissions)
 *
 * @param expandScopeForTasks Если true и у юзера есть `tasks.tabs.view.department`,
 *   scope расширяется team → department. Передаётся true только на вкладках
 *   Sections/Departments. На Kanban scope сохраняется базовый.
 */
export function useTasksFilterOptions({
  expandScopeForTasks = false,
}: { expandScopeForTasks?: boolean } = {}) {
  const { data: orgStructure, isLoading: loadingOrg } = useOrgStructure()
  const { data: projects, isLoading: loadingProject } = useFilterProjects()
  const { data: tags, isLoading: loadingTags } = useProjectTags()

  // 🔒 Получаем контекст разрешений.
  // Если activeTab = Sections/Departments и юзер имеет tasks.tabs.view.department,
  // расширяем scope team → department для согласованности UI с серверной выборкой.
  const { data: rawFilterContext, isLoading: loadingContext } = useFilterContext()
  const filterContext = useMemo(() => {
    if (!rawFilterContext) return null
    return expandScopeForTasks ? expandScopeForTasksTabs(rawFilterContext) : rawFilterContext
  }, [rawFilterContext, expandScopeForTasks])

  // Собираем все опции с parent IDs для иерархической фильтрации
  const allOptions = useMemo<FilterOption[]>(() => {
    const result: FilterOption[] = []

    // Подразделения (без parent)
    if (orgStructure?.subdivisions) {
      for (const item of orgStructure.subdivisions) {
        result.push({ id: item.id, name: item.name, key: 'подразделение' })
      }
    }

    // Отделы (parent = subdivisionId)
    if (orgStructure?.departments) {
      for (const item of orgStructure.departments) {
        result.push({
          id: item.id,
          name: item.name,
          key: 'отдел',
          parentId: item.subdivisionId || undefined,
        })
      }
    }

    // Команды (parent = departmentId)
    if (orgStructure?.teams) {
      for (const item of orgStructure.teams) {
        result.push({
          id: item.id,
          name: item.name,
          key: 'команда',
          parentId: item.departmentId || undefined,
        })
      }
    }

    // Ответственные (parent = teamId)
    if (orgStructure?.employees) {
      for (const item of orgStructure.employees) {
        result.push({
          id: item.id,
          name: item.name,
          key: 'ответственный',
          parentId: item.teamId || undefined,
        })
      }
    }

    // Проекты (без parent в контексте орг структуры)
    if (projects) {
      for (const item of projects) {
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
  }, [orgStructure, projects, tags])

  // 🔒 Фильтруем опции по scope пользователя
  const filteredOptions = useFilteredOptions(allOptions, filterContext)

  // 🔒 Получаем список заблокированных фильтров для UI
  const lockedFilters = useMemo(
    () => getLockedFilters(filterContext),
    [filterContext]
  )

  return {
    options: filteredOptions,
    allOptions, // Для отладки
    filterContext,
    lockedFilters,
    isLoading: loadingOrg || loadingProject || loadingTags || loadingContext,
  }
}
