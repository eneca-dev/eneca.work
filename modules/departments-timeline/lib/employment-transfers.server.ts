import 'server-only'

import { z } from 'zod'
import { createAdminClient } from '@/utils/supabase/admin'
import { employmentDateSchema } from '@/modules/users/lib/employment-dated'
import type { Department, Employee } from '../types'
import { isCurrentEmployeeMembership } from './employment-display'

const ID_BATCH_SIZE = 100
const PAGE_SIZE = 1000
const periodSchema = z.object({
  employee_id: z.string().uuid(),
  department_id: z.string().uuid().nullable(),
  team_id: z.string().uuid().nullable(),
  valid_from: employmentDateSchema,
  valid_to: employmentDateSchema.nullable(),
}).refine(period => period.valid_to === null || period.valid_to > period.valid_from)
type Period = z.infer<typeof periodSchema>

function membershipKey(employeeId: string, departmentId: string | null, teamId: string | null): string {
  return JSON.stringify([employeeId, departmentId, teamId ?? (departmentId ? `unassigned-${departmentId}` : null)])
}

function isFormerRow(employee: Employee, departmentId: string, teamId: string, isGuestTeam?: boolean): boolean {
  return !employee.isShortage && !employee.isGuest && !isGuestTeam
    && !isCurrentEmployeeMembership(employee, departmentId, teamId)
}

/**
 * Caller must pass the already authorized, historically projected timeline.
 * Read successors privately; expose only departure dates for its visible former memberships.
 */
export async function annotateEmployeeTransfers(departments: Department[]): Promise<Department[]> {
  const sourceMemberships = new Set<string>()
  const candidateIds = new Set<string>()
  for (const department of departments) {
    for (const team of department.teams) {
      for (const employee of team.employees) {
        if (!isFormerRow(employee, department.id, team.id, team.isGuestTeam)) continue
        candidateIds.add(employee.id)
        sourceMemberships.add(membershipKey(employee.id, department.id, team.id))
      }
    }
  }
  if (!candidateIds.size) return departments

  const transfers = new Map<string, string>()
  try {
    const ids = z.array(z.string().uuid()).parse([...candidateIds])
    const admin = createAdminClient()
    for (let offset = 0; offset < ids.length; offset += ID_BATCH_SIZE) {
      const batch = ids.slice(offset, offset + ID_BATCH_SIZE)
      const allowedIds = new Set(batch)
      const previousByEmployee = new Map<string, Period>()
      for (let from = 0; ; from += PAGE_SIZE) {
        const result = await admin.from('employee_employment_periods')
          .select('employee_id,department_id,team_id,valid_from,valid_to')
          .in('employee_id', batch)
          .order('employee_id').order('valid_from').range(from, from + PAGE_SIZE - 1)
        if (result.error || !result.data) throw new Error('Employment transfer read failed')
        const page = z.array(periodSchema).parse(result.data)
        for (const period of page) {
          if (!allowedIds.has(period.employee_id)) throw new Error('Employment transfer scope mismatch')
          const previous = previousByEmployee.get(period.employee_id)
          if (previous?.valid_to === period.valid_from
            && (previous.department_id !== period.department_id || previous.team_id !== period.team_id)) {
            const key = membershipKey(previous.employee_id, previous.department_id, previous.team_id)
            if (sourceMemberships.has(key)) transfers.set(key, period.valid_from)
          }
          previousByEmployee.set(period.employee_id, period)
        }
        if (page.length < PAGE_SIZE) break
      }
    }
  } catch {
    throw new Error('Не удалось прочитать даты перевода сотрудников. Обновите данные и повторите попытку.')
  }

  return departments.map(department => ({
    ...department,
    teams: department.teams.map(team => ({
      ...team,
      employees: team.employees.map(employee => {
        if (!isFormerRow(employee, department.id, team.id, team.isGuestTeam)) return employee
        const transferredOn = transfers.get(membershipKey(employee.id, department.id, team.id))
        return transferredOn ? { ...employee, transferredOn } : employee
      }),
    })),
  }))
}
