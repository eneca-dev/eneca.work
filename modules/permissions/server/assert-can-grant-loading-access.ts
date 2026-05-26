'use server'

/**
 * Server-side guard: может ли текущий пользователь выдавать/отзывать
 * cross-department loading access grants на указанного сотрудника.
 *
 * Право имеют:
 *  - admin (loadings.edit.scope.all)
 *  - НО владеющего отдела (departments.department_head_id = user.id, или
 *    user.department_id = employee.department_id с loadings.edit.scope.department)
 *  - ТЛ команды сотрудника (teams.team_lead_id = user.id с loadings.edit.scope.team)
 */

import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/utils/supabase/server'
import { getFilterContext } from './get-filter-context'
import type { ActionResult } from '@/modules/cache'

export async function assertCanGrantLoadingAccess(
  employeeId: string
): Promise<ActionResult<{ employeeId: string }>> {
  const supabase = await createClient()

  // Параллельно: контекст пользователя + базовые поля сотрудника
  const [ctxResult, empRow] = await Promise.all([
    getFilterContext(),
    supabase
      .from('profiles')
      .select('user_id, department_id, team_id')
      .eq('user_id', employeeId)
      .single(),
  ])

  if (!ctxResult.success || !ctxResult.data) {
    return { success: false, error: 'Не удалось получить контекст пользователя' }
  }
  const ctx = ctxResult.data

  if (empRow.error || !empRow.data) {
    return { success: false, error: 'Сотрудник не найден' }
  }
  const emp = empRow.data

  const has = (p: string) => ctx.permissions.includes(p)

  // 1. Admin
  if (has('loadings.edit.scope.all')) {
    return { success: true, data: { employeeId } }
  }

  // 2. НО владеющего отдела (по own или head)
  if (has('loadings.edit.scope.department') && emp.department_id) {
    const myDepts = [ctx.ownDepartmentId, ctx.headDepartmentId].filter(Boolean)
    if (myDepts.includes(emp.department_id)) {
      return { success: true, data: { employeeId } }
    }
  }

  // 3. ТЛ команды сотрудника
  if (has('loadings.edit.scope.team') && emp.team_id) {
    const myTeams = [ctx.ownTeamId, ctx.leadTeamId].filter(Boolean)
    if (myTeams.includes(emp.team_id)) {
      return { success: true, data: { employeeId } }
    }
  }

  Sentry.addBreadcrumb({
    category: 'permissions',
    message: 'assertCanGrantLoadingAccess: denied',
    level: 'info',
    data: {
      userId: ctx.userId,
      employeeId,
      empDept: emp.department_id,
      empTeam: emp.team_id,
    },
  })

  return {
    success: false,
    error: 'Нет прав на управление доступом к загрузкам этого сотрудника',
  }
}
