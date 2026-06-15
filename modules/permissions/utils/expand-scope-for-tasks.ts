/**
 * Pure-функция расширения scope для вкладок Разделы/Отделы на /tasks.
 *
 * Используется и на сервере (в getFilterContextForTasksTabs), и на клиенте
 * (в useTasksFilterOptions для согласованности locked-badge и filter-options
 * с реальной логикой видимости). Без drift между уровнями.
 */

import type { UserFilterContext } from '../types'

/**
 * Расширяет scope с team до department, если у юзера есть permission
 * `tasks.tabs.view.department` и текущий scope = team.
 *
 * Также добавляет `filters.scope.department` в filterPermissions (синтетически),
 * чтобы applyMandatoryFilters не заблокировал расширение из-за security check.
 *
 * Для всех других scope-уровней возвращает контекст без изменений.
 */
export function expandScopeForTasksTabs(
  ctx: UserFilterContext
): UserFilterContext {
  const hasExpandPermission = ctx.permissions.includes('tasks.tabs.view.department')
  const isTeamScoped = ctx.scope?.level === 'team'
  const hasOwnDept = !!ctx.ownDepartmentId

  if (!hasExpandPermission || !isTeamScoped || !hasOwnDept) {
    return ctx
  }

  return {
    ...ctx,
    filterPermissions: ctx.filterPermissions.includes('filters.scope.department')
      ? ctx.filterPermissions
      : [...ctx.filterPermissions, 'filters.scope.department'],
    scope: {
      ...ctx.scope,
      level: 'department',
      teamIds: undefined,
      departmentIds: [ctx.ownDepartmentId],
    },
  }
}
