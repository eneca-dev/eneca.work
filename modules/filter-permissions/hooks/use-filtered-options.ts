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
 * Фильтрует опции автокомплита на основе scope пользователя.
 * Пользователь видит только опции, которые соответствуют его области видимости.
 *
 * @param allOptions - Все доступные опции
 * @param filterContext - Контекст фильтрации пользователя
 * @returns Отфильтрованные опции
 *
 * @example
 * ```tsx
 * const { data: filterContext } = useFilterContext()
 * const filteredOptions = useFilteredOptions(allOptions, filterContext)
 *
 * return <InlineFilter options={filteredOptions} ... />
 * ```
 */
export function useFilteredOptions(
  allOptions: FilterOption[],
  filterContext: UserFilterContext | null | undefined
): FilterOption[] {
  return useMemo(() => {
    if (!filterContext) return []

    const { scope } = filterContext

    // Admin видит всё
    if (scope.level === 'all') return allOptions

    return allOptions.filter((option) => {
      return isOptionAllowedForScope(option, scope, filterContext)
    })
  }, [allOptions, filterContext])
}

/**
 * Проверяет, доступна ли опция для данного scope
 */
function isOptionAllowedForScope(
  option: FilterOption,
  scope: FilterScope,
  context: UserFilterContext
): boolean {
  switch (option.key) {
    case 'подразделение':
      // Подразделение можно выбирать только если scope = subdivision
      if (scope.level === 'subdivision') {
        return scope.subdivisionIds?.includes(option.id) ?? false
      }
      // Ниже по иерархии - не показываем выбор подразделения
      return false

    case 'отдел':
      // Отдел можно выбирать на уровне subdivision или department
      if (scope.level === 'subdivision') {
        // Показываем все отделы подразделения (фильтрация на сервере)
        return true
      }
      if (scope.level === 'department') {
        return scope.departmentIds?.includes(option.id) ?? false
      }
      // Ниже по иерархии - не показываем выбор отдела
      return false

    case 'команда':
      // Команду можно выбирать на уровне subdivision, department или team
      if (scope.level === 'subdivision' || scope.level === 'department') {
        // Показываем все команды (фильтрация на сервере)
        return true
      }
      if (scope.level === 'team') {
        return scope.teamIds?.includes(option.id) ?? false
      }
      // На уровне projects - не показываем выбор команды
      return false

    case 'проект':
      // Если есть проектный scope - только управляемые проекты
      if (scope.projectIds?.length) {
        return scope.projectIds.includes(option.id)
      }
      // Для орг. ролей - показываем все проекты
      // (фильтрация будет по сотрудникам)
      return true

    case 'ответственный':
      // Ответственный всегда доступен для фильтрации внутри scope
      // TODO: можно добавить фильтрацию по team/department
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
