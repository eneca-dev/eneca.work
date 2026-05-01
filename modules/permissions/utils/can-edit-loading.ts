/**
 * Loadings Permissions — Pure utilities
 *
 * Pure-функции для проверки прав на редактирование загрузок.
 * Используются и на сервере (в Server Actions перед мутацией), и на клиенте
 * (в хуках для UI gating). Идентичная логика — без drift между уровнями.
 */

import type { UserFilterContext } from '../types'

/**
 * Метаданные загрузки, нужные для проверки прав.
 * Берутся из view_employee_workloads (server) или из иерархии данных вкладки (client).
 */
export interface LoadingPermissionContext {
  /** ID исполнителя загрузки (loading_responsible) */
  responsibleId: string
  /** Команда исполнителя (final_team_id) */
  teamId: string | null
  /** Отдел исполнителя (final_department_id) */
  departmentId: string | null
  /** Подразделение исполнителя (через team→department→subdivision) */
  subdivisionId: string | null
  /** Проект загрузки */
  projectId: string | null
}

const EDIT_SCOPE_PERMISSIONS = [
  'loadings.edit.scope.all',
  'loadings.edit.scope.subdivision',
  'loadings.edit.scope.department',
  'loadings.edit.scope.team',
  'loadings.edit.scope.managed_projects',
  'loadings.edit.scope.own',
] as const

/**
 * Проверяет, может ли пользователь редактировать данную загрузку.
 *
 * Логика OR между всеми scope-permissions: достаточно одного совпадения.
 *
 * Stale-cache fallback: если в ctx.permissions нет ни одного из 6
 * `loadings.edit.scope.*`, считаем что юзер вошёл до миграции.
 * Возвращаем true (RLS защищает от реальных нарушений).
 */
export function canEditLoading(
  loading: LoadingPermissionContext,
  ctx: UserFilterContext
): boolean {
  const permissions = ctx.permissions
  const has = (perm: string) => permissions.includes(perm)

  // Stale-cache fallback (см. spec §5.5)
  const hasAnyEditScope = EDIT_SCOPE_PERMISSIONS.some(has)
  if (!hasAnyEditScope) return true

  // 1. Admin — без ограничений
  if (has('loadings.edit.scope.all')) return true

  // 2. Subdivision head
  if (
    has('loadings.edit.scope.subdivision') &&
    !!ctx.ownSubdivisionId &&
    loading.subdivisionId === ctx.ownSubdivisionId
  ) {
    return true
  }

  // 3. Department head
  if (
    has('loadings.edit.scope.department') &&
    !!ctx.ownDepartmentId &&
    loading.departmentId === ctx.ownDepartmentId
  ) {
    return true
  }

  // 4. Team lead
  if (
    has('loadings.edit.scope.team') &&
    !!ctx.ownTeamId &&
    loading.teamId === ctx.ownTeamId
  ) {
    return true
  }

  // 5. Project manager
  if (
    has('loadings.edit.scope.managed_projects') &&
    !!loading.projectId &&
    !!ctx.managedProjectIds?.length &&
    ctx.managedProjectIds.includes(loading.projectId)
  ) {
    return true
  }

  // 6. Self
  if (has('loadings.edit.scope.own') && loading.responsibleId === ctx.userId) {
    return true
  }

  return false
}

/**
 * Может ли юзер запустить bulk shift для данного отдела.
 * Admin — для любого отдела, остальные с `loadings.bulk_shift.department` —
 * только для своего отдела.
 */
export function canBulkShiftDepartment(
  departmentId: string,
  ctx: UserFilterContext
): boolean {
  if (!ctx.permissions.includes('loadings.bulk_shift.department')) return false

  if (ctx.permissions.includes('loadings.edit.scope.all')) return true

  return !!ctx.ownDepartmentId && departmentId === ctx.ownDepartmentId
}

/**
 * Применяется ли к юзеру правило "строго в своём отделе".
 * True для user/team_lead/department_head — их max scope = department/team/own.
 * False для admin/subdivision_head/project_manager.
 */
export function isRestrictedToOwnDepartment(ctx: UserFilterContext): boolean {
  const has = (p: string) => ctx.permissions.includes(p)
  if (has('loadings.edit.scope.all')) return false
  if (has('loadings.edit.scope.subdivision')) return false
  if (has('loadings.edit.scope.managed_projects')) return false
  return true
}

/**
 * Минимальная информация о пользователе для фильтрации списков сотрудников.
 */
interface UserScopeInfo {
  user_id: string
  team_id: string | null | undefined
  department_id: string | null | undefined
}

/**
 * Можно ли назначить загрузку на этого пользователя (для select'ов в модалке).
 * Логика идентична canEditLoading, но работает на минимальных полях
 * CachedUser (без projectId/subdivisionId — на клиенте обычно недоступны).
 *
 * Для admin/subdivision_head/managed_projects возвращает true для всех —
 * server-side финально гейтит. Для department/team/own — точная проверка.
 */
export function canAssignLoadingToUser(
  user: UserScopeInfo,
  ctx: UserFilterContext
): boolean {
  const has = (p: string) => ctx.permissions.includes(p)

  // Admin / subdivision / managed_projects — широкий scope, доверяем server-side
  if (has('loadings.edit.scope.all')) return true
  if (has('loadings.edit.scope.subdivision')) return true
  if (has('loadings.edit.scope.managed_projects')) return true

  // Department / team / own — точная проверка по полям пользователя
  if (
    has('loadings.edit.scope.department') &&
    !!ctx.ownDepartmentId &&
    user.department_id === ctx.ownDepartmentId
  ) {
    return true
  }
  if (
    has('loadings.edit.scope.team') &&
    !!ctx.ownTeamId &&
    user.team_id === ctx.ownTeamId
  ) {
    return true
  }
  if (has('loadings.edit.scope.own') && user.user_id === ctx.userId) {
    return true
  }

  // Stale-cache fallback: если ни одного scope-permission — RLS защищает на сервере
  const EDIT_SCOPES = [
    'loadings.edit.scope.all',
    'loadings.edit.scope.subdivision',
    'loadings.edit.scope.department',
    'loadings.edit.scope.team',
    'loadings.edit.scope.managed_projects',
    'loadings.edit.scope.own',
  ]
  if (!EDIT_SCOPES.some(has)) return true

  return false
}
