import type { Department, Employee, EmploymentSegment, Team } from '../types'
import { aggregateMonthlyWorkload, type MonthCell } from '@/modules/resource-graph/utils/monthly-cell-utils'
import type { DayInfo } from '@/modules/resource-graph/types'

interface CapacityRow {
  dailyCapacity?: Record<string, number>
  dailyWorkloads?: Record<string, number>
}

export function getDailyCapacity(row: CapacityRow, date: string, fallback: number): number {
  return row.dailyCapacity === undefined ? fallback : (row.dailyCapacity[date] ?? 0)
}

/** Both averages use exactly the same working days, so their ratio is the ratio of sums. */
export function getMonthlyCapacityPercentage(
  row: CapacityRow,
  month: MonthCell,
  calendarMap?: Map<string, Partial<DayInfo>>,
  fallbackCapacity = 0,
): number | null {
  const capacity = row.dailyCapacity === undefined
    ? fallbackCapacity
    : aggregateMonthlyWorkload(row.dailyCapacity, month, calendarMap)
  if (capacity <= 0) return null
  return Math.round(aggregateMonthlyWorkload(row.dailyWorkloads, month, calendarMap) / capacity * 100)
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = []
  const cursor = new Date(`${start}T00:00:00Z`)
  const finish = new Date(`${end}T00:00:00Z`).getTime()
  while (cursor.getTime() <= finish) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

function projectEmployee(employee: Employee, segments: EmploymentSegment[], today: string, allSegments = segments): Employee {
  const dailyCapacity: Record<string, number> = {}
  for (const segment of segments) {
    for (const date of datesBetween(segment.startDate, segment.endDate)) {
      // A person has one employment state per day; duplicated membership never doubles capacity.
      dailyCapacity[date] = segment.employmentRate
    }
  }
  const loadings = (employee.loadings ?? []).filter(loading => segments.some(segment =>
    loading.startDate.slice(0, 10) <= segment.endDate && loading.endDate.slice(0, 10) >= segment.startDate,
  ))
  const dailyWorkloads: Record<string, number> = {}
  const employmentDates = Object.keys(dailyCapacity)
  for (const loading of loadings) {
    const start = loading.startDate.slice(0, 10)
    const end = loading.endDate.slice(0, 10)
    for (const date of employmentDates) {
      if (start <= date && date <= end) dailyWorkloads[date] = (dailyWorkloads[date] ?? 0) + loading.rate
    }
  }
  return {
    ...employee,
    currentDepartmentId: employee.currentDepartmentId === undefined ? (employee.departmentId ?? null) : employee.currentDepartmentId,
    currentTeamId: employee.currentTeamId === undefined ? (employee.teamId ?? null) : employee.currentTeamId,
    employmentSegments: segments,
    employmentConflicts: (employee.loadings ?? []).filter(loading => !allSegments.some(segment =>
      loading.startDate.slice(0, 10) <= segment.endDate && loading.endDate.slice(0, 10) >= segment.startDate,
    )),
    employmentRate: dailyCapacity[today] ?? 0,
    dailyCapacity,
    dailyWorkloads,
    loadings,
    hasLoadings: loadings.length > 0,
    loadingsCount: loadings.length,
    workload: dailyWorkloads[today] ?? 0,
  }
}

function aggregate(rows: CapacityRow[], field: 'dailyCapacity' | 'dailyWorkloads'): Record<string, number> {
  const result: Record<string, number> = {}
  for (const row of rows) {
    for (const [date, value] of Object.entries(row[field] ?? {})) {
      result[date] = (result[date] ?? 0) + value
    }
  }
  return result
}

/** Project saved employment membership without changing the underlying loading intervals. */
export function projectEmploymentHistory(
  departments: Department[],
  employees: Employee[],
  segments: EmploymentSegment[],
  today: string,
  allowedMemberships?: ReadonlySet<string>,
): Department[] {
  const employeeById = new Map(employees.map(employee => [employee.id, employee]))
  const segmentsByEmployee = new Map<string, EmploymentSegment[]>()
  for (const segment of segments) {
    const saved = segmentsByEmployee.get(segment.employeeId) ?? []
    saved.push(segment)
    segmentsByEmployee.set(segment.employeeId, saved)
  }
  const knownTeams = new Map(departments.flatMap(department => department.teams)
    .filter(team => !team.isGuestTeam).map(team => [team.id, team]))
  const result = departments.map(department => ({
    ...department,
    teams: department.teams.map(team => ({ ...team, employees: [] as Employee[] })),
  }))
  const departmentsById = new Map(result.map(department => [department.id, department]))
  const originalsById = new Map(departments.map(department => [department.id, department]))

  for (const [employeeId, employeeSegments] of segmentsByEmployee) {
    const employee = employeeById.get(employeeId)
    if (!employee || employee.isShortage) continue
    const memberships = new Map<Team, EmploymentSegment[]>()
    for (const segment of employeeSegments) {
      if (allowedMemberships && !allowedMemberships.has(`${segment.departmentId}/${segment.teamId}`)) continue
      const department = segment.departmentId ? departmentsById.get(segment.departmentId) : undefined
      if (!department) continue
      const teamId = segment.teamId ?? `unassigned-${department.id}`
      let team = department.teams.find(candidate => candidate.id === teamId && !candidate.isGuestTeam)
      if (!team) {
        team = {
          ...knownTeams.get(teamId),
          id: teamId,
          name: segment.teamId ? (knownTeams.get(teamId)?.name ?? 'Команда') : 'Без команды',
          departmentId: department.id,
          departmentName: department.name,
          employees: [],
        }
        department.teams.push(team)
      }
      const saved = memberships.get(team) ?? []
      saved.push(segment)
      memberships.set(team, saved)
    }
    for (const [team, membership] of memberships) {
      const department = departmentsById.get(team.departmentId)!
      team.employees.push({
        ...projectEmployee(employee, membership, today, employeeSegments),
        departmentId: department.id,
        departmentName: department.name,
        teamId: team.id,
        teamName: team.name,
        teamCode: team.code,
        isGuest: false,
      })
    }
  }

  for (const department of result) {
    const original = originalsById.get(department.id)
    for (const team of department.teams) {
      const originalTeam = original?.teams.find(candidate => candidate.id === team.id)
      if (team.isGuestTeam) {
        const guests = new Map((originalTeam?.employees ?? []).map(employee => [employee.id, employee]))
        team.employees = [...guests.values()].map(employee =>
          projectEmployee(employee, segmentsByEmployee.get(employee.id) ?? [], today),
        )
      } else {
        team.employees.push(...(originalTeam?.employees ?? [])
          .filter(employee => employee.isShortage)
          .map(employee => ({ ...employee, employmentRate: 0, dailyCapacity: {} })))
      }
      team.dailyCapacity = aggregate(team.employees, 'dailyCapacity')
      team.dailyWorkloads = aggregate(team.employees, 'dailyWorkloads')
      team.totalEmployees = team.employees.filter(employee => !employee.isShortage).length
    }
    const ownTeams = department.teams.filter(team => !team.isGuestTeam)
    department.dailyCapacity = aggregate(ownTeams, 'dailyCapacity')
    department.dailyWorkloads = aggregate(ownTeams, 'dailyWorkloads')
    department.totalEmployees = new Set(ownTeams.flatMap(team => team.employees
      .filter(employee => !employee.isShortage).map(employee => employee.id))).size
  }
  return result
}
