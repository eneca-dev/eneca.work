/**
 * Mandatory Filters
 *
 * Принудительно добавляет ограничения к фильтрам на основе scope пользователя.
 * Это второй уровень защиты (после UI), работает на уровне Server Actions.
 */

import type { FilterQueryParams } from '@/modules/inline-filter'
import type { UserFilterContext } from '../types'
import { debugLog, debugGroup } from '@/lib/debug-logger'

/**
 * Применяет обязательные фильтры на основе scope пользователя.
 * Возвращает модифицированные фильтры с принудительными ограничениями.
 *
 * @param userFilters - Фильтры, переданные пользователем
 * @param filterContext - Контекст разрешений пользователя
 * @returns Фильтры с применёнными ограничениями
 */
export function applyMandatoryFilters(
  userFilters: FilterQueryParams,
  filterContext: UserFilterContext
): FilterQueryParams {
  const { scope } = filterContext

  debugGroup('Mandatory Filters', () => {
    debugLog.info('mandatory-filters', 'Applying mandatory filters', {
      scopeLevel: scope.level,
      userFilters,
      userId: filterContext.userId,
      primaryRole: filterContext.primaryRole,
    })
  })

  // Admin - никаких ограничений
  if (scope.level === 'all') {
    debugLog.info('mandatory-filters', 'Admin scope - no restrictions applied')
    return userFilters
  }

  const mandatoryFilters: FilterQueryParams = { ...userFilters }

  // Применяем ограничения в зависимости от scope
  switch (scope.level) {
    case 'subdivision':
      // Принудительно фильтруем по подразделению
      if (scope.subdivisionIds?.length === 1) {
        mandatoryFilters.subdivision_id = scope.subdivisionIds[0]
      } else if (scope.subdivisionIds?.length) {
        mandatoryFilters.subdivision_id = scope.subdivisionIds
      }
      break

    case 'department':
      // Принудительно фильтруем по отделу
      if (scope.departmentIds?.length === 1) {
        mandatoryFilters.department_id = scope.departmentIds[0]
      } else if (scope.departmentIds?.length) {
        mandatoryFilters.department_id = scope.departmentIds
      }
      // Удаляем subdivision_id - не имеет смысла на этом уровне
      delete mandatoryFilters.subdivision_id
      break

    case 'team':
      // Принудительно фильтруем по команде
      if (scope.teamIds?.length === 1) {
        mandatoryFilters.team_id = scope.teamIds[0]
      } else if (scope.teamIds?.length) {
        mandatoryFilters.team_id = scope.teamIds
      }
      // Удаляем более высокие уровни
      delete mandatoryFilters.subdivision_id
      delete mandatoryFilters.department_id
      break

    case 'projects':
      // Ограничиваем проекты только управляемыми
      if (userFilters.project_id) {
        // Проверяем что запрошенный проект в списке управляемых
        const requestedProject = userFilters.project_id as string
        if (!scope.projectIds?.includes(requestedProject)) {
          // Пользователь пытается запросить чужой проект - игнорируем
          if (scope.projectIds?.length === 1) {
            mandatoryFilters.project_id = scope.projectIds[0]
          } else if (scope.projectIds?.length) {
            mandatoryFilters.project_id = scope.projectIds
          }
        }
      } else {
        // Если проект не указан - ставим все управляемые
        if (scope.projectIds?.length === 1) {
          mandatoryFilters.project_id = scope.projectIds[0]
        } else if (scope.projectIds?.length) {
          mandatoryFilters.project_id = scope.projectIds
        }
      }
      break
  }

  // Дополнительно: если есть projectIds в scope (комбинация ролей),
  // и пользователь запросил проект - проверяем доступ
  if (scope.projectIds?.length && mandatoryFilters.project_id) {
    const requestedProject = mandatoryFilters.project_id as string
    if (
      typeof requestedProject === 'string' &&
      !scope.projectIds.includes(requestedProject)
    ) {
      // Проект не в списке управляемых - удаляем фильтр
      // (будет применён орг. фильтр)
      debugLog.warn('mandatory-filters', 'Project access denied, removing filter', {
        requestedProject,
        allowedProjects: scope.projectIds,
      })
      delete mandatoryFilters.project_id
    }
  }

  debugLog.info('mandatory-filters', 'Mandatory filters applied', {
    originalFilters: userFilters,
    resultFilters: mandatoryFilters,
    scopeLevel: scope.level,
  })

  return mandatoryFilters
}
