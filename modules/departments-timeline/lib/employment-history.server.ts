import 'server-only'
import { z } from 'zod'
import { createAdminClient } from '@/utils/supabase/admin'
import type { EmploymentSegment } from '../types'

export interface EmploymentRange { startDate: string; endDate: string }

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
})
export const employmentRangeSchema = z.object({ startDate: date, endDate: date })
  .refine(value => value.startDate <= value.endDate, 'Некорректный диапазон')
  .refine(value => Date.parse(value.endDate) - Date.parse(value.startDate) <= 366 * 5 * 86400000,
    'Диапазон не должен превышать пять лет')

const savedRow = z.object({
  employee_id: z.string().uuid(), department_id: z.string().uuid().nullable(),
  team_id: z.string().uuid().nullable(), employment_rate: z.coerce.number().positive().finite(),
  valid_from: date.optional(), valid_to: date.nullable().optional(),
})

function previousDay(value: string): string {
  const day = new Date(`${value}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}

/** Caller must resolve authorized organization rows and grants using the session client first. */
export async function readEmploymentSegments(
  range: EmploymentRange, cutover: string,
  organization: { department_id: string | null; team_id: string | null }[],
  guestIds: string[], restrictTeams: boolean,
): Promise<EmploymentSegment[]> {
  const admin = createAdminClient()
  const departments = [...new Set(organization.map(row => row.department_id).filter((id): id is string => !!id))]
  const pairs = new Set(organization.map(row => `${row.department_id}/${row.team_id}`))
  const guests = new Set(guestIds)
  const rows: z.infer<typeof savedRow>[] = []
  for (const table of ['employee_employment_baseline', 'employee_employment_periods'] as const) {
    if (table === 'employee_employment_baseline' && range.startDate >= cutover) continue
    if (table === 'employee_employment_periods' && range.endDate < cutover) continue
    // Two bounded scopes instead of interpolated PostgREST expressions.
    for (const [column, ids] of [['department_id', departments], ['employee_id', guestIds]] as const) {
      if (!ids.length) continue
      let query = admin.from(table).select(table === 'employee_employment_periods'
        ? 'employee_id,department_id,team_id,employment_rate,valid_from,valid_to'
        : 'employee_id,department_id,team_id,employment_rate').in(column, ids)
      if (table === 'employee_employment_periods') {
        query = query.lte('valid_from', range.endDate).or(`valid_to.is.null,valid_to.gt.${range.startDate}`)
      }
      query = query.order('employee_id')
      if (table === 'employee_employment_periods') query = query.order('valid_from')
      for (let offset = 0; ; offset += 1000) {
        const result = await query.range(offset, offset + 999)
        if (result.error) throw new Error('Не удалось прочитать историю сотрудников')
        const page = z.array(savedRow).parse(result.data)
        rows.push(...page.map(row => table === 'employee_employment_baseline'
          ? { ...row, valid_from: range.startDate, valid_to: cutover } : row))
        if (page.length < 1000) break
      }
    }
  }
  const unique = new Map<string, EmploymentSegment>()
  for (const row of rows) {
    if (!guests.has(row.employee_id) && restrictTeams && !pairs.has(`${row.department_id}/${row.team_id}`)) continue
    const startDate = row.valid_from! > range.startDate ? row.valid_from! : range.startDate
    const finish = row.valid_to ? previousDay(row.valid_to) : range.endDate
    const endDate = finish < range.endDate ? finish : range.endDate
    if (startDate > endDate) continue
    const segment: EmploymentSegment = {
      employeeId: row.employee_id, departmentId: row.department_id, teamId: row.team_id,
      startDate, endDate, employmentRate: row.employment_rate,
    }
    unique.set(`${row.employee_id}/${startDate}/${endDate}`, segment)
  }
  return [...unique.values()]
}
