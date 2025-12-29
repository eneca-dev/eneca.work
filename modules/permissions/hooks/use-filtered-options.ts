'use client'

/**
 * Hook для фильтрации опций автокомплита на основе scope пользователя
 *
 * Первый уровень защиты - пользователь не видит недоступные опции в UI.
 */

import { useMemo } from 'react'
import type { FilterOption } from '@/modules/inline-filter'
import type { UserFilterContext, FilterScope } from '../types'

/**
 * Контекст иерархии для фильтрации (опционально)
 * Позволяет фильтровать дочерние элементы по родительским
 */
export interface HierarchyContext {
  /** Map: departmentId → subdivisionId */
  departmentToSubdivision?: Map<string, string>
  /** Map: teamId → departmentId */
  teamToDepartment?: Map<string, string>
  /** Map: employeeId → teamId */
  employeeToTeam?: Map<string, string>
}

/**
 * Фильтрует опции автокомплита на основе scope пользователя.
 * Пользователь видит только опции, которые соответствуют его области видимости.
 *
 * @param allOptions - Все доступные опции (с parentId для иерархии)
 * @param filterContext - Контекст фильтрации пользователя
 * @param hierarchy - Опциональный контекст иерархии для глубокой фильтрации
 * @returns Отфильтрованные опции
 */
export function useFilteredOptions(
  allOptions: FilterOption[],
  filterContext: UserFilterContext | null | undefined,
  hierarchy?: HierarchyContext
): FilterOption[] {
  return useMemo(() => {
    if (!filterContext) return []

    const { scope } = filterContext

    // Admin видит всё
    if (scope.level === 'all') return allOptions

    // Строим множества разрешённых ID для каждого уровня
    const allowedIds = buildAllowedIds(allOptions, scope, hierarchy)

    return allOptions.filter((option) => {
      return isOptionAllowedForScope(option, scope, filterContext, allowedIds)
    })
  }, [allOptions, filterContext, hierarchy])
}

/**
 * Строит множества разрешённых ID на основе scope и иерархии
 */
function buildAllowedIds(
  allOptions: FilterOption[],
  scope: FilterScope,
  hierarchy?: HierarchyContext
): {
  subdivisions: Set<string>
  departments: Set<string>
  teams: Set<string>
  employees: Set<string>
} {
  const subdivisions = new Set(scope.subdivisionIds || [])
  const departments = new Set(scope.departmentIds || [])
  const teams = new Set(scope.teamIds || [])
  const employees = new Set<string>()

  // Для subdivision scope: находим все отделы этого подразделения
  if (scope.level === 'subdivision' && subdivisions.size > 0) {
    for (const option of allOptions) {
      if (option.key === 'отдел' && option.parentId && subdivisions.has(option.parentId)) {
        departments.add(option.id)
      }
    }
  }

  // Для subdivision/department scope: находим все команды этих отделов
  if ((scope.level === 'subdivision' || scope.level === 'department') && departments.size > 0) {
    for (const option of allOptions) {
      if (option.key === 'команда' && option.parentId && departments.has(option.parentId)) {
        teams.add(option.id)
      }
    }
  }

  // Для всех уровней кроме projects: находим сотрудников из разрешённых команд
  if (scope.level !== 'projects' && teams.size > 0) {
    for (const option of allOptions) {
      if (option.key === 'ответственный' && option.parentId && teams.has(option.parentId)) {
        employees.add(option.id)
      }
    }
  }

  return { subdivisions, departments, teams, employees }
}

/**
 * Проверяет, доступна ли опция для данного scope
 */
function isOptionAllowedForScope(
  option: FilterOption,
  scope: FilterScope,
  context: UserFilterContext,
  allowedIds: {
    subdivisions: Set<string>
    departments: Set<string>
    teams: Set<string>
    employees: Set<string>
  }
): boolean {
  switch (option.key) {
    case 'подразделение':
      // Подразделение можно выбирать только если scope = subdivision
      if (scope.level === 'subdivision') {
        return allowedIds.subdivisions.has(option.id)
      }
      // Ниже по иерархии - не показываем выбор подразделения
      return false

    case 'отдел':
      // Отдел можно выбирать на уровне subdivision или department
      if (scope.level === 'subdivision') {
        // Показываем только отделы из разрешённых подразделений
        return allowedIds.departments.has(option.id)
      }
      if (scope.level === 'department') {
        return allowedIds.departments.has(option.id)
      }
      // Ниже по иерархии - не показываем выбор отдела
      return false

    case 'команда':
      // Команду можно выбирать на уровне subdivision, department или team
      if (scope.level === 'subdivision' || scope.level === 'department') {
        // Показываем только команды из разрешённых отделов
        return allowedIds.teams.has(option.id)
      }
      if (scope.level === 'team') {
        return allowedIds.teams.has(option.id)
      }
      // На уровне projects - не показываем выбор команды
      return false

    case 'ответственный':
      // Фильтруем сотрудников по разрешённым командам
      if (scope.level === 'projects') {
        // Для project scope - показываем всех (фильтрация на сервере)
        return true
      }
      // Для орг. ролей - только сотрудники из разрешённых команд
      if (allowedIds.employees.size > 0) {
        return allowedIds.employees.has(option.id)
      }
      return true

    case 'проект':
      // Если есть проектный scope - только управляемые проекты
      if (scope.projectIds?.length) {
        return scope.projectIds.includes(option.id)
      }
      // Для орг. ролей - показываем все проекты
      return true

    case 'метка':
      // Метки всегда доступны
      return true

    default:
      return true
  }
}

/**
 * Получает список заблокированных фильтров для отображения в UI
 */
export function getLockedFilters(
  filterContext: UserFilterContext | null | undefined
): Array<{ key: string; displayName: string }> {
  if (!filterContext) return []

  const { scope } = filterContext
  const locked: Array<{ key: string; displayName: string }> = []

  // Admin - ничего не заблокировано
  if (scope.level === 'all') return []

  switch (scope.level) {
    case 'subdivision':
      if (filterContext.headSubdivisionName) {
        locked.push({
          key: 'подразделение',
          displayName: filterContext.headSubdivisionName,
        })
      }
      break

    case 'department':
      if (filterContext.headDepartmentName) {
        locked.push({
          key: 'отдел',
          displayName: filterContext.headDepartmentName,
        })
      }
      break

    case 'team':
      if (filterContext.leadTeamName) {
        locked.push({
          key: 'команда',
          displayName: filterContext.leadTeamName,
        })
      } else if (filterContext.ownTeamName) {
        locked.push({
          key: 'команда',
          displayName: filterContext.ownTeamName,
        })
      }
      break

    case 'projects':
      if (filterContext.managedProjectNames?.length) {
        // Для нескольких проектов показываем количество
        if (filterContext.managedProjectNames.length === 1) {
          locked.push({
            key: 'проект',
            displayName: filterContext.managedProjectNames[0],
          })
        } else {
          locked.push({
            key: 'проекты',
            displayName: `${filterContext.managedProjectNames.length} проектов`,
          })
        }
      }
      break
  }

  return locked
}
