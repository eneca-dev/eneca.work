/**
 * Mandatory Filters
 *
 * Принудительно добавляет ограничения к фильтрам на основе scope пользователя.
 * Это второй уровень защиты (после UI), работает на уровне Server Actions.
 *
 * SECURITY: При отсутствии контекста или scope — блокируем доступ полностью.
 */

import type { FilterQueryParams } from '@/modules/inline-filter'
import type { UserFilterContext } from '../types'

/**
 * UUID который гарантированно не существует в БД.
 * Используется для блокировки запросов при отсутствии контекста.
 */
const BLOCKING_UUID = '00000000-0000-0000-0000-000000000000'

/**
 * Применяет обязательные фильтры на основе scope пользователя.
 * Возвращает модифицированные фильтры с принудительными ограничениями.
 *
 * SECURITY: При отсутствии контекста возвращает blocking filter,
 * который гарантированно не вернёт данных.
 *
 * @param userFilters - Фильтры, переданные пользователем
 * @param filterContext - Контекст разрешений пользователя (может быть null)
 * @returns Фильтры с применёнными ограничениями
 */
export function applyMandatoryFilters(
  userFilters: FilterQueryParams,
  filterContext: UserFilterContext | null
): FilterQueryParams {
  // SECURITY: Блокируем доступ при отсутствии контекста
  if (!filterContext) {
    console.error('[SECURITY] applyMandatoryFilters: filterContext is null — BLOCKING')
    return {
      ...userFilters,
      team_id: BLOCKING_UUID,
    }
  }

  const { scope } = filterContext

  // SECURITY: Блокируем доступ при отсутствии scope
  if (!scope) {
    console.error('[SECURITY] applyMandatoryFilters: scope is undefined — BLOCKING')
    return {
      ...userFilters,
      team_id: BLOCKING_UUID,
    }
  }

  // Admin - никаких ограничений, но проверяем permission
  if (scope.level === 'all') {
    // SECURITY: Дополнительная проверка что у пользователя есть admin permission
    if (!filterContext.filterPermissions?.includes('filters.scope.all')) {
      console.error('[SECURITY] applyMandatoryFilters: Admin scope claimed without permission — BLOCKING')
      return {
        ...userFilters,
        team_id: BLOCKING_UUID,
      }
    }
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
      delete mandatoryFilters.project_id
    }
  }

  return mandatoryFilters
}
