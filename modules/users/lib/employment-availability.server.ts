import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@/types/db'
import { createAdminClient } from '@/utils/supabase/admin'
import { isValidEmploymentBoardDate } from '@/modules/employment-board/lib/board-date'
import { getEmploymentStatus } from './employment-client'
import { getFilterContext } from '@/modules/permissions/server/get-filter-context'

export interface EmploymentDateRange { startDate: string; endDate: string }
const baselineSchema = z.object({ employee_id: z.string().uuid() })
const periodSchema = baselineSchema.extend({ valid_from: z.string(), valid_to: z.string().nullable() })
type Period = z.infer<typeof periodSchema>

/** Only narrows an existing authorized employee set; it never grants visibility. */
export async function getAvailableEmployeeIds(
  supabase: SupabaseClient<Database>, alreadyAuthorizedIds: readonly string[], range: EmploymentDateRange,
): Promise<string[]> {
  if (!range || !isValidEmploymentBoardDate(range.startDate) || !isValidEmploymentBoardDate(range.endDate) || range.startDate > range.endDate) {
    throw new Error('Некорректный диапазон занятости')
  }
  const ids = [...new Set(z.array(z.string().uuid()).parse(alreadyAuthorizedIds))]
  const status = await getEmploymentStatus(supabase)
  if (!status?.enabled || ids.length === 0) return ids
  if (!status.cutoverDate || !isValidEmploymentBoardDate(status.cutoverDate)) throw new Error('Некорректная дата начала кадрового учёта')
  const cutoverDate = status.cutoverDate
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Необходимо войти в систему')

  const admin = createAdminClient()
  const baseline = new Set<string>()
  const periods: Period[] = []
  // Keep PostgREST URLs bounded and read every page, not just the API's first 1000 rows.
  for (let offset = 0; offset < ids.length; offset += 200) {
    const batch = ids.slice(offset, offset + 200)
    if (range.startDate < cutoverDate) {
      const result = await admin.from('employee_employment_baseline').select('employee_id').in('employee_id', batch)
      if (result.error) throw new Error('Не удалось проверить исходный состав сотрудников')
      for (const row of z.array(baselineSchema).parse(result.data)) baseline.add(row.employee_id)
    }
    if (range.endDate >= cutoverDate) {
      for (let from = 0; ; from += 1000) {
        const result = await admin.from('employee_employment_periods')
          .select('employee_id, valid_from, valid_to').in('employee_id', batch)
          .lte('valid_from', range.endDate)
          .or(`valid_to.is.null,valid_to.gt.${range.startDate}`)
          .order('employee_id').order('valid_from').range(from, from + 999)
        if (result.error) throw new Error('Не удалось проверить периоды работы сотрудников')
        const page = z.array(periodSchema).parse(result.data)
        if (page.some(row => !isValidEmploymentBoardDate(row.valid_from) || (row.valid_to !== null && (!isValidEmploymentBoardDate(row.valid_to) || row.valid_to <= row.valid_from)))) {
          throw new Error('Некорректный период работы сотрудника')
        }
        periods.push(...page)
        if (page.length < 1000) break
      }
    }
  }
  const periodsByEmployee = new Map<string, Period[]>()
  for (const period of periods) {
    const list = periodsByEmployee.get(period.employee_id) ?? []
    list.push(period)
    periodsByEmployee.set(period.employee_id, list)
  }
  return ids.filter(id => {
    let nextUncovered = range.startDate
    if (nextUncovered < cutoverDate) {
      if (!baseline.has(id)) return false
      if (range.endDate < cutoverDate) return true
      nextUncovered = cutoverDate
    }
    for (const period of (periodsByEmployee.get(id) ?? []).sort((a, b) => a.valid_from.localeCompare(b.valid_from))) {
      if (period.valid_from > nextUncovered) return false
      if (period.valid_to === null || period.valid_to > range.endDate) return true
      if (period.valid_to > nextUncovered) nextUncovered = period.valid_to
    }
    return false
  })
}

export async function assertEmploymentAvailable(
  supabase: SupabaseClient<Database>, employeeIds: readonly string[], range: EmploymentDateRange,
): Promise<void> {
  const assignable = await getAssignableEmployeeIds(supabase, employeeIds)
  const available = new Set(await getAvailableEmployeeIds(supabase, assignable, range))
  if (employeeIds.some(id => !available.has(id))) {
    throw new Error('Сотрудник не работает в течение всего выбранного периода. Проверьте даты загрузки.')
  }
}

/** Authorize raw assignment IDs before any service-role history query. */
export async function getAssignableEmployeeIds(
  supabase: SupabaseClient<Database>, candidateIds: readonly string[],
): Promise<string[]> {
  const ids = [...new Set(z.array(z.string().uuid()).parse(candidateIds))]
  if (!ids.length || !(await getEmploymentStatus(supabase))?.enabled) return ids
  const context = await getFilterContext()
  if (!context.success || !context.data) throw new Error('Недостаточно прав для назначения сотрудника')
  const ctx = context.data
  const editScopes = [
    'loadings.edit.scope.all', 'loadings.edit.scope.subdivision',
    'loadings.edit.scope.managed_projects', 'loadings.edit.scope.department',
    'loadings.edit.scope.team', 'loadings.edit.scope.own',
  ]
  if (!editScopes.some(permission => ctx.permissions.includes(permission))) {
    throw new Error('Недостаточно прав для назначения сотрудника')
  }
  const [{ data: people, error: peopleError }, { data: grants, error: grantsError }] = await Promise.all([
    supabase.from('view_users').select('user_id,department_id,team_id').in('user_id', ids),
    supabase.from('employee_loading_access_grants')
      .select('employee_id,granted_to_department_id').in('employee_id', ids),
  ])
  if (peopleError || grantsError || !people || !grants) throw new Error('Не удалось проверить право назначения')
  const grantMap = new Map<string, string[]>()
  for (const grant of grants) {
    if (!grant.employee_id || !grant.granted_to_department_id) continue
    grantMap.set(grant.employee_id, [...(grantMap.get(grant.employee_id) ?? []), grant.granted_to_department_id])
  }
  const subdivisionIds = [ctx.ownSubdivisionId, ctx.headSubdivisionId].filter((id): id is string => !!id)
  const departmentIds = [...new Set(people.map(person => person.department_id).filter((id): id is string => !!id))]
  const { data: departments, error: departmentError } = departmentIds.length
    ? await supabase.from('departments').select('department_id,subdivision_id').in('department_id', departmentIds)
    : { data: [], error: null }
  if (departmentError || !departments) throw new Error('Не удалось проверить право назначения')
  const departmentSubdivisions = new Map(departments.map(dept => [dept.department_id, dept.subdivision_id]))
  return people.flatMap(person => {
    if (!person.user_id || !ids.includes(person.user_id)) return []
    const allowedBySubdivision = ctx.permissions.includes('loadings.edit.scope.subdivision')
      && !!person.department_id && subdivisionIds.includes(departmentSubdivisions.get(person.department_id) ?? '')
    const has = (permission: string) => ctx.permissions.includes(permission)
    const allowedOtherwise = has('loadings.edit.scope.all') || has('loadings.edit.scope.managed_projects')
      || (has('loadings.edit.scope.own') && person.user_id === ctx.userId)
      || (has('loadings.edit.scope.department') && !!person.department_id
        && [ctx.ownDepartmentId, ctx.headDepartmentId].includes(person.department_id))
      || (has('loadings.edit.scope.team') && !!person.team_id
        && [ctx.ownTeamId, ctx.leadTeamId].includes(person.team_id))
      || ((has('loadings.edit.scope.department') || has('loadings.edit.scope.team'))
        && (grantMap.get(person.user_id) ?? []).some(departmentId =>
          (ctx.grantedAccessDepartmentIds ?? []).includes(departmentId)))
    return allowedBySubdivision || allowedOtherwise ? [person.user_id] : []
  })
}

/** Preserve edits to existing historical work; validate only a newly assigned person. */
export async function assertEmploymentReassignment(
  supabase: SupabaseClient<Database>, loadingId: string, employeeId: string | undefined,
  dates: { startDate?: string; endDate?: string },
): Promise<void> {
  if (employeeId === undefined) return
  const { data, error } = await supabase.from('loadings')
    .select('loading_responsible,loading_start,loading_finish').eq('loading_id', loadingId).single()
  if (error || !data) throw new Error('Загрузка не найдена')
  if (data.loading_responsible === employeeId) return
  const startDate = dates.startDate ?? data.loading_start
  const endDate = dates.endDate ?? data.loading_finish
  if (!startDate || !endDate) throw new Error('Не удалось определить даты загрузки')
  await assertEmploymentAvailable(supabase, [employeeId], { startDate, endDate })
}
