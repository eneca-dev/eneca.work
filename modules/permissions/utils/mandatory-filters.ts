/**
 * Mandatory Filters
 *
 * Принудительно добавляет ограничения к фильтрам на основе scope пользователя.
 * Это второй уровень защиты (после UI), работает на уровне Server Actions.
 *
 * SECURITY: При отсутствии контекста или scope — блокируем доступ полностью.
 */

import * as Sentry from '@sentry/nextjs'
import type { FilterQueryParams } from '@/modules/inline-filter'
import type { UserFilterContext } from '../types'

/**
 * UUID который гарантированно не существует в БД.
 * Используется для блокировки запросов при отсутствии контекста.
 * NOTE: DB constraints должны предотвращать существование этого UUID в таблицах.
 */
const BLOCKING_UUID = '00000000-0000-0000-0000-000000000000'

/**
 * Regex для валидации UUID v4
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Валидирует массив UUID
 * @returns true если все ID валидны или массив пуст/undefined
 */
function validateUUIDs(ids: string[] | undefined): boolean {
  if (!ids || ids.length === 0) return true
  return ids.every((id) => UUID_REGEX.test(id))
}

/**
 * Логирует security event в Sentry и console
 */
function logSecurityEvent(message: string, extra?: Record<string, unknown>): void {
  console.error(`[SECURITY] ${message}`)
  Sentry.captureMessage(`[SECURITY] ${message}`, {
    level: 'error',
    tags: { security: 'filter_bypass_attempt' },
    extra,
  })
}

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
    logSecurityEvent('applyMandatoryFilters: filterContext is null — BLOCKING', { userFilters })
    return {
      ...userFilters,
      team_id: BLOCKING_UUID,
    }
  }

  const { scope } = filterContext

  // SECURITY: Блокируем доступ при отсутствии scope
  if (!scope) {
    logSecurityEvent('applyMandatoryFilters: scope is undefined — BLOCKING', {
      userId: filterContext.userId,
      userFilters,
    })
    return {
      ...userFilters,
      team_id: BLOCKING_UUID,
    }
  }

  // SECURITY: Валидация UUID массивов в scope
  if (
    !validateUUIDs(scope.teamIds) ||
    !validateUUIDs(scope.departmentIds) ||
    !validateUUIDs(scope.subdivisionIds) ||
    !validateUUIDs(scope.projectIds)
  ) {
    logSecurityEvent('applyMandatoryFilters: Invalid UUIDs in scope — BLOCKING', {
      userId: filterContext.userId,
      scopeLevel: scope.level,
    })
    return {
      ...userFilters,
      team_id: BLOCKING_UUID,
    }
  }

  // Admin - никаких ограничений, но проверяем permission
  if (scope.level === 'all') {
    // SECURITY: Дополнительная проверка что у пользователя есть admin permission
    if (!filterContext.filterPermissions?.includes('filters.scope.all')) {
      logSecurityEvent('applyMandatoryFilters: Admin scope claimed without permission — BLOCKING', {
        userId: filterContext.userId,
        filterPermissions: filterContext.filterPermissions,
      })
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
      // SECURITY: Проверяем permission для subdivision scope
      if (!filterContext.filterPermissions?.includes('filters.scope.subdivision')) {
        logSecurityEvent('applyMandatoryFilters: Subdivision scope without permission — BLOCKING', {
          userId: filterContext.userId,
          filterPermissions: filterContext.filterPermissions,
        })
        return { ...userFilters, team_id: BLOCKING_UUID }
      }
      // Принудительно фильтруем по подразделению
      if (scope.subdivisionIds?.length === 1) {
        mandatoryFilters.subdivision_id = scope.subdivisionIds[0]
      } else if (scope.subdivisionIds?.length) {
        mandatoryFilters.subdivision_id = scope.subdivisionIds
      }
      break

    case 'department':
      // SECURITY: Проверяем permission для department scope
      if (!filterContext.filterPermissions?.includes('filters.scope.department')) {
        logSecurityEvent('applyMandatoryFilters: Department scope without permission — BLOCKING', {
          userId: filterContext.userId,
          filterPermissions: filterContext.filterPermissions,
        })
        return { ...userFilters, team_id: BLOCKING_UUID }
      }
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
      // NOTE: НЕ требуем permission для team scope, т.к. resolveFilterScope()
      // уже безопасно установил teamIds (либо свой team, либо по permission).
      // Это позволяет обычным users видеть свою команду через fallback.

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
      // SECURITY: Проверяем permission для projects scope
      if (!filterContext.filterPermissions?.includes('filters.scope.managed_projects')) {
        logSecurityEvent('applyMandatoryFilters: Projects scope without permission — BLOCKING', {
          userId: filterContext.userId,
          filterPermissions: filterContext.filterPermissions,
        })
        return { ...userFilters, team_id: BLOCKING_UUID }
      }
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
