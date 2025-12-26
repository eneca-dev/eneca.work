/**
 * Mandatory Filters
 *
 * Принудительно добавляет ограничения к фильтрам на основе scope пользователя.
 * Это второй уровень защиты (после UI), работает на уровне Server Actions.
 */

import type { FilterQueryParams } from '@/modules/inline-filter'
import type { FilterScope, UserFilterContext } from '../types'
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

/**
 * Проверяет, является ли фильтр валидным для данного scope
 */
export function validateFilterForScope(
  filterKey: string,
  filterValue: string | string[],
  scope: FilterScope
): boolean {
  // Admin может всё
  if (scope.level === 'all') return true

  const values = Array.isArray(filterValue) ? filterValue : [filterValue]

  switch (filterKey) {
    case 'subdivision_id':
      // Можно фильтровать только если scope = subdivision
      if (scope.level !== 'subdivision') return false
      return values.every((v) => scope.subdivisionIds?.includes(v))

    case 'department_id':
      // Можно если scope = subdivision или department
      if (!['subdivision', 'department'].includes(scope.level)) return false
      if (scope.level === 'department') {
        return values.every((v) => scope.departmentIds?.includes(v))
      }
      // Для subdivision - нужно проверить что отдел входит в подразделение
      // (это делается на уровне БД)
      return true

    case 'team_id':
      // Можно если scope = subdivision, department или team
      if (!['subdivision', 'department', 'team'].includes(scope.level)) {
        return false
      }
      if (scope.level === 'team') {
        return values.every((v) => scope.teamIds?.includes(v))
      }
      return true

    case 'project_id':
      // Если есть проектный scope - проверяем
      if (scope.projectIds?.length) {
        return values.every((v) => scope.projectIds?.includes(v))
      }
      // Если нет проектного scope - можно любой проект
      // (фильтрация будет по сотрудникам орг. структуры)
      return true

    default:
      // Остальные фильтры (ответственный, метка) - всегда разрешены
      return true
  }
}

/**
 * Генерирует SQL условие для scope
 * Используется в RLS политиках
 */
export function getScopeSqlCondition(
  scope: FilterScope,
  tableAlias: string = ''
): string {
  const prefix = tableAlias ? `${tableAlias}.` : ''

  if (scope.level === 'all') {
    return 'TRUE'
  }

  const conditions: string[] = []

  // Орг. структура
  if (scope.subdivisionIds?.length) {
    const ids = scope.subdivisionIds.map((id) => `'${id}'`).join(', ')
    conditions.push(`${prefix}subdivision_id IN (${ids})`)
  }

  if (scope.departmentIds?.length) {
    const ids = scope.departmentIds.map((id) => `'${id}'`).join(', ')
    conditions.push(`${prefix}department_id IN (${ids})`)
  }

  if (scope.teamIds?.length) {
    const ids = scope.teamIds.map((id) => `'${id}'`).join(', ')
    conditions.push(`${prefix}team_id IN (${ids})`)
  }

  // Проекты (ортогонально)
  if (scope.projectIds?.length) {
    const ids = scope.projectIds.map((id) => `'${id}'`).join(', ')
    conditions.push(`${prefix}project_id IN (${ids})`)
  }

  if (conditions.length === 0) {
    return 'FALSE' // Нет доступа
  }

  // Объединяем OR (комбинация ролей)
  return `(${conditions.join(' OR ')})`
}
