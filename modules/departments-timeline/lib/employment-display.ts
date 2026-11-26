import type { Department, Employee, EmploymentSegment, Loading } from '../types'

// Legacy workload view represents a missing organization reference with this UUID.
const EMPTY_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000000'

export function isCurrentEmployeeMembership(employee: Employee, departmentId: string, teamId: string): boolean {
  const currentDepartmentId = employee.currentDepartmentId === EMPTY_ORGANIZATION_ID ? null : employee.currentDepartmentId
  if (currentDepartmentId !== undefined && currentDepartmentId !== departmentId) return false
  const currentTeamId = employee.currentTeamId === EMPTY_ORGANIZATION_ID ? null : employee.currentTeamId
  if (currentTeamId !== undefined && (currentTeamId ?? `unassigned-${departmentId}`) !== teamId) return false
  return true
}

/** Filter visible rows only; dated totals still include the original historical work. */
export function filterCurrentEmployeeRows(departments: Department[], finishedEmployeeIds: readonly string[]): Department[] {
  const finished = new Set(finishedEmployeeIds)
  let changed = false
  const result = departments.map(department => {
    let departmentChanged = false
    const teams = department.teams.map(team => {
      const employees = team.employees.filter(employee => {
        if (employee.isShortage) return true
        if (finished.has(employee.id)) return false
        // Guests legitimately appear outside their home department via access grants.
        if (employee.isGuest || team.isGuestTeam) return true
        // Legacy snapshots without current membership metadata remain visible.
        return isCurrentEmployeeMembership(employee, department.id, team.id)
      })
      if (employees.length === team.employees.length) return team
      changed = true
      departmentChanged = true
      return { ...team, employees }
    })
    return departmentChanged ? { ...department, teams } : department
  })
  return changed ? result : departments
}

export interface EmploymentDisplayLoading extends Loading {
  /** Display fragments have independent render keys but always resolve to the original loading. */
  sourceLoadingId: string
}

function nextDay(date: string): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

/** Clip presentation only. Adjacent staffing periods are one visible loading interval. */
export function clipLoadingsToEmployment(
  loadings: Loading[],
  segments: EmploymentSegment[] | undefined,
): EmploymentDisplayLoading[] {
  if (segments === undefined) return loadings.map(loading => ({ ...loading, sourceLoadingId: loading.id }))

  const intervals: Array<{ startDate: string; endDate: string }> = []
  for (const segment of [...segments].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const previous = intervals.at(-1)
    if (previous && segment.startDate <= nextDay(previous.endDate)) {
      if (segment.endDate > previous.endDate) previous.endDate = segment.endDate
    } else {
      intervals.push({ startDate: segment.startDate, endDate: segment.endDate })
    }
  }

  return loadings.flatMap(loading => intervals.flatMap(interval => {
    const startDate = loading.startDate.slice(0, 10) > interval.startDate ? loading.startDate.slice(0, 10) : interval.startDate
    const endDate = loading.endDate.slice(0, 10) < interval.endDate ? loading.endDate.slice(0, 10) : interval.endDate
    if (startDate > endDate) return []
    return [{
      ...loading,
      id: `${loading.id}:employment:${startDate}:${endDate}`,
      sourceLoadingId: loading.id,
      startDate,
      endDate,
    }]
  }))
}
