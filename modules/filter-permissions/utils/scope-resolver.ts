/**
 * Scope Resolver
 *
 * Определяет область видимости пользователя на основе его permissions.
 * Permissions комбинируются - scope объединяется.
 *
 * Permissions (из БД):
 * - filters.scope.all - полный доступ
 * - filters.scope.subdivision - доступ к подразделению
 * - filters.scope.department - доступ к отделу
 * - filters.scope.team - доступ к команде
 * - filters.scope.managed_projects - доступ к управляемым проектам
 */

import type {
  FilterScope,
  FilterScopeLevel,
  FilterScopePermission,
} from '../types'
import { PERMISSION_PRIORITY, PERMISSION_TO_SCOPE } from '../types'

export interface ScopeContext {
  // Орг. структура пользователя
  ownTeamId?: string
  ownDepartmentId?: string
  ownSubdivisionId?: string

  // Руководящие позиции
  leadTeamId?: string
  headDepartmentId?: string
  headSubdivisionId?: string

  // Проекты
  managedProjectIds?: string[]
}

/**
 * Определяет область видимости на основе permissions пользователя.
 * Permissions комбинируются - результирующий scope является объединением.
 *
 * Примеры:
 * - filters.scope.team + filters.scope.managed_projects = видит команду + проекты
 * - filters.scope.department + filters.scope.managed_projects = видит отдел + проекты
 */
export function resolveFilterScope(
  permissions: FilterScopePermission[],
  context: ScopeContext
): FilterScope {
  // filters.scope.all = полный доступ без ограничений
  if (permissions.includes('filters.scope.all')) {
    return { level: 'all', isLocked: false }
  }

  // Собираем все scope'ы от разных permissions
  const subdivisionIds = new Set<string>()
  const departmentIds = new Set<string>()
  const teamIds = new Set<string>()
  const projectIds = new Set<string>()

  // filters.scope.subdivision
  if (
    permissions.includes('filters.scope.subdivision') &&
    context.headSubdivisionId
  ) {
    subdivisionIds.add(context.headSubdivisionId)
  }

  // filters.scope.department
  if (
    permissions.includes('filters.scope.department') &&
    context.headDepartmentId
  ) {
    departmentIds.add(context.headDepartmentId)
  }

  // filters.scope.team
  if (permissions.includes('filters.scope.team')) {
    // Если тимлид - используем команду которой руководит
    if (context.leadTeamId) {
      teamIds.add(context.leadTeamId)
    }
    // Иначе - своя команда
    else if (context.ownTeamId) {
      teamIds.add(context.ownTeamId)
    }
  }

  // filters.scope.managed_projects - ортогонально орг. структуре
  if (
    permissions.includes('filters.scope.managed_projects') &&
    context.managedProjectIds?.length
  ) {
    for (const projectId of context.managedProjectIds) {
      projectIds.add(projectId)
    }
  }

  // Если нет permissions - fallback на свою команду (locked)
  if (
    subdivisionIds.size === 0 &&
    departmentIds.size === 0 &&
    teamIds.size === 0 &&
    projectIds.size === 0
  ) {
    if (context.ownTeamId) {
      teamIds.add(context.ownTeamId)
    }
  }

  // Определяем итоговый level по приоритету
  const finalLevel = determineScopeLevel(
    subdivisionIds.size > 0,
    departmentIds.size > 0,
    teamIds.size > 0,
    projectIds.size > 0,
    context.ownTeamId
  )

  // Если только projects - добавляем fallback на свою команду
  if (finalLevel === 'projects' && teamIds.size === 0 && context.ownTeamId) {
    teamIds.add(context.ownTeamId)
  }

  return {
    level: finalLevel,
    subdivisionIds:
      subdivisionIds.size > 0 ? Array.from(subdivisionIds) : undefined,
    departmentIds:
      departmentIds.size > 0 ? Array.from(departmentIds) : undefined,
    teamIds: teamIds.size > 0 ? Array.from(teamIds) : undefined,
    projectIds: projectIds.size > 0 ? Array.from(projectIds) : undefined,
    isLocked: true, // Все не-admin имеют заблокированный scope
  }
}

/**
 * Определяет итоговый scope level по приоритету
 */
function determineScopeLevel(
  hasSubdivision: boolean,
  hasDepartment: boolean,
  hasTeam: boolean,
  hasProjects: boolean,
  ownTeamId?: string
): FilterScopeLevel {
  if (hasSubdivision) return 'subdivision'
  if (hasDepartment) return 'department'
  if (hasTeam) return 'team'
  if (hasProjects) return 'projects'

  // Fallback
  return 'team'
}

/**
 * Получить наивысший приоритет permission из списка
 */
export function getHighestPermission(
  permissions: FilterScopePermission[]
): FilterScopePermission | null {
  if (permissions.length === 0) return null

  return permissions.reduce((highest, current) =>
    PERMISSION_PRIORITY[current] < PERMISSION_PRIORITY[highest]
      ? current
      : highest
  )
}

/**
 * Проверяет, может ли пользователь видеть данные указанного scope
 */
export function canAccessScope(
  userScope: FilterScope,
  targetSubdivisionId?: string,
  targetDepartmentId?: string,
  targetTeamId?: string,
  targetProjectId?: string
): boolean {
  // Admin видит всё
  if (userScope.level === 'all') return true

  // Проверяем по проектам (ортогонально)
  if (userScope.projectIds?.length) {
    if (targetProjectId && userScope.projectIds.includes(targetProjectId)) {
      return true
    }
  }

  // Проверяем по орг. структуре
  switch (userScope.level) {
    case 'subdivision':
      if (
        targetSubdivisionId &&
        userScope.subdivisionIds?.includes(targetSubdivisionId)
      ) {
        return true
      }
      break

    case 'department':
      if (
        targetDepartmentId &&
        userScope.departmentIds?.includes(targetDepartmentId)
      ) {
        return true
      }
      break

    case 'team':
      if (targetTeamId && userScope.teamIds?.includes(targetTeamId)) {
        return true
      }
      break

    case 'projects':
      // Только проекты, уже проверили выше
      break
  }

  return false
}
