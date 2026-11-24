import { describe, expect, it } from 'vitest'
import type { Department, Employee, EmploymentSegment, Loading } from '../types'
import type { MonthCell } from '@/modules/resource-graph/utils/monthly-cell-utils'
import { getDailyCapacity, getMonthlyCapacityPercentage, projectEmploymentHistory, previewLoadingDates } from './employment-history'

const loading: Loading = {
  id: 'loading', sectionId: 'section', stageId: 'stage',
  startDate: '2026-10-01', endDate: '2026-11-30', rate: 1,
}
const employee: Employee = {
  id: 'employee', name: 'Сотрудник', workload: 0, employmentRate: 1,
  departmentId: 'new', teamId: 'new-team', loadings: [loading],
}
const departments = (): Department[] => ['old', 'new'].map(id => ({
  id, name: id, totalEmployees: 0,
  teams: [{ id: `${id}-team`, name: `Команда ${id}`, departmentId: id, employees: [] }],
}))
const segment = (overrides: Partial<EmploymentSegment> = {}): EmploymentSegment => ({
  employeeId: employee.id, departmentId: 'old', teamId: 'old-team',
  startDate: '2026-11-01', endDate: '2026-11-30', employmentRate: 1, ...overrides,
})
const project = (segments: EmploymentSegment[], today = '2026-11-19') =>
  projectEmploymentHistory(departments(), [employee], segments, today)
const month: MonthCell = {
  year: 2026, month: 10, label: 'Ноябрь 2026', shortLabel: 'Ноя',
  startDate: '2026-11-02', endDate: '2026-11-03', isCurrentMonth: false,
  workingDays: 2, workingDates: ['2026-11-02', '2026-11-03'],
}

describe('loading resize preview with employment history', () => {
  it('updates dates and daily/monthly totals immediately without changing saved capacity or the previous snapshot', () => {
    const original = project([segment()])
    const serialized = JSON.stringify(original)
    const result = previewLoadingDates(original, employee.id, loading.id, '2026-11-03', '2026-11-03', '2026-11-19')
    const department = result[0]
    const row = department.teams[0].employees[0]
    expect(row.loadings?.[0]).toMatchObject({ startDate: '2026-11-03', endDate: '2026-11-03' })
    expect(row.dailyWorkloads?.['2026-11-02']).toBeUndefined()
    expect(row.dailyWorkloads?.['2026-11-03']).toBe(1)
    expect(department.teams[0].dailyWorkloads).toEqual(row.dailyWorkloads)
    expect(department.dailyWorkloads).toEqual(row.dailyWorkloads)
    expect(getMonthlyCapacityPercentage(department, month)).toBe(50)
    expect(department.dailyCapacity).toEqual(original[0].dailyCapacity)
    expect(JSON.stringify(original)).toBe(serialized)
  })

  it('updates both sides of a transfer and can bring work back into a previously empty membership row', () => {
    const segments = [segment({ endDate: '2026-11-10' }),
      segment({ departmentId: 'new', teamId: 'new-team', startDate: '2026-11-11' })]
    const original = projectEmploymentHistory(departments(), [{ ...employee,
      loadings: [{ ...loading, startDate: '2026-11-01', endDate: '2026-11-05' }] }], segments, '2026-11-19')
    expect(original[1].teams[0].employees[0].loadings).toEqual([])
    const result = previewLoadingDates(original, employee.id, loading.id, '2026-11-01', '2026-11-15', '2026-11-19')
    expect(result[0].dailyWorkloads?.['2026-11-10']).toBe(1)
    expect(result[0].dailyWorkloads?.['2026-11-11']).toBeUndefined()
    expect(result[1].dailyWorkloads?.['2026-11-11']).toBe(1)
    expect(result[1].dailyWorkloads?.['2026-11-16']).toBeUndefined()
    expect(result[1].teams[0].employees[0].loadings?.[0].endDate).toBe('2026-11-15')
  })

  it('updates guest workload without adding it to the host department total', () => {
    const original = departments()
    original[1].teams.push({ id: 'guests', name: 'Guests', departmentId: 'new', isGuestTeam: true,
      employees: [{ ...employee, isGuest: true }] })
    const projected = projectEmploymentHistory(original, [employee], [segment()], '2026-11-19')
    const result = previewLoadingDates(projected, employee.id, loading.id, '2026-11-01', '2026-11-02', '2026-11-19')
    const guest = result[1].teams.find(team => team.isGuestTeam)!
    expect(guest.dailyWorkloads?.['2026-11-02']).toBe(1)
    expect(guest.dailyWorkloads?.['2026-11-03']).toBeUndefined()
    expect(result[1].dailyWorkloads).toEqual({})
    expect(guest.employees[0].isGuest).toBe(true)
  })

  it('retains an out-of-employment loading as a conflict and restores it when resized into employment', () => {
    const original = project([segment()])
    const outside = previewLoadingDates(original, employee.id, loading.id, '2026-12-01', '2026-12-02', '2026-11-19')
    expect(outside[0].teams[0].employees[0].loadings).toEqual([])
    expect(outside[0].teams[0].employees[0].employmentConflicts?.[0].id).toBe(loading.id)
    const restored = previewLoadingDates(outside, employee.id, loading.id, '2026-11-01', '2026-11-02', '2026-11-19')
    expect(restored[0].teams[0].employees[0].loadings?.[0].id).toBe(loading.id)
    expect(restored[0].teams[0].employees[0].employmentConflicts).toEqual([])
  })

  it('keeps legacy snapshots supported and ignores unknown loading ids', () => {
    const original = departments()
    original[0].teams[0].employees = [employee]
    expect(previewLoadingDates(original, employee.id, 'missing', '2026-11-01', '2026-11-02', '2026-11-19')).toBe(original)
    const result = previewLoadingDates(original, employee.id, loading.id, '2026-11-01', '2026-11-02', '2026-11-19')
    expect(result[0].teams[0].employees[0].loadings?.[0].endDate).toBe('2026-11-02')
    expect(result[0].dailyCapacity).toBeUndefined()
  })
})

describe('employment history projection', () => {
  it('does not recreate a filtered native team from the full history of a guest', () => {
    const source = departments().filter(department => department.id === 'new')
    source[0].teams.push({
      id: 'guests-new', name: 'Гости', departmentId: 'new', isGuestTeam: true,
      employees: [{ ...employee, isGuest: true }],
    })
    const [department] = projectEmploymentHistory(source, [employee], [
      segment({ departmentId: 'new', teamId: 'not-allowed', endDate: '2026-11-10' }),
      segment({ departmentId: 'old', teamId: 'old-team', startDate: '2026-11-11', employmentRate: 0.5 }),
    ], '2026-11-19', new Set(['new/new-team']))
    expect(department.teams.some(team => team.id === 'not-allowed')).toBe(false)
    expect(department.dailyCapacity).toEqual({})
    const guests = department.teams.find(team => team.isGuestTeam)!
    expect(guests.employees).toHaveLength(1)
    expect(guests.dailyCapacity?.['2026-11-10']).toBe(1)
    expect(guests.dailyCapacity?.['2026-11-11']).toBe(0.5)
  })

  it('matches the explicit null-team permission pair before creating an unassigned row', () => {
    const [denied] = projectEmploymentHistory(departments(), [employee], [segment({ teamId: null })],
      '2026-11-19', new Set(['old/old-team']))
    expect(denied.teams.some(team => team.id === 'unassigned-old')).toBe(false)
    const [allowed] = projectEmploymentHistory(departments(), [employee], [segment({ teamId: null })],
      '2026-11-19', new Set(['old/null']))
    expect(allowed.teams.find(team => team.id === 'unassigned-old')?.employees).toHaveLength(1)
  })
  it('preserves shortage rows without adding employment capacity', () => {
    const source = departments()
    source[0].teams[0].employees.push({
      id: 'shortage', name: 'Дефицит', workload: 1, isShortage: true,
      dailyWorkloads: { '2026-11-19': 1 }, loadings: [loading],
    })
    const [department] = projectEmploymentHistory(source, [employee], [segment()], '2026-11-19')
    const shortage = department.teams[0].employees.find(row => row.isShortage)!
    expect(shortage.loadings).toEqual([loading])
    expect(shortage.dailyCapacity).toEqual({})
    expect(shortage.employmentRate).toBe(0)
    expect(department.dailyCapacity?.['2026-11-19']).toBe(1)
    expect(department.totalEmployees).toBe(1)
  })
  it('uses saved membership rather than the current employee department', () => {
    const result = project([segment()])
    const row = result[0].teams[0].employees[0]
    expect(row.departmentId).toBe('old')
    expect(row.currentDepartmentId).toBe('new')
    expect(row.currentTeamId).toBe('new-team')
    expect(result[1].teams[0].employees).toEqual([])
  })

  it('starts capacity and workload on the hire date, preserving original loading dates', () => {
    const [department] = project([segment({ startDate: '2026-11-10' })])
    expect(getDailyCapacity(department, '2026-11-09', 99)).toBe(0)
    expect(department.dailyCapacity?.['2026-11-10']).toBe(1)
    expect(department.dailyWorkloads?.['2026-11-09']).toBeUndefined()
    expect(department.dailyWorkloads?.['2026-11-10']).toBe(1)
    expect(department.teams[0].employees[0].loadings?.[0]).toBe(loading)
  })

  it('splits transfer capacity and loading visibility at inclusive boundaries', () => {
    const result = project([
      segment({ endDate: '2026-11-10' }),
      segment({ departmentId: 'new', teamId: 'new-team', startDate: '2026-11-11' }),
    ])
    expect(result[0].dailyCapacity?.['2026-11-10']).toBe(1)
    expect(result[0].dailyWorkloads?.['2026-11-11']).toBeUndefined()
    expect(result[1].dailyCapacity?.['2026-11-10']).toBeUndefined()
    expect(result[1].dailyWorkloads?.['2026-11-11']).toBe(1)
    expect(result[0].teams[0].employees[0].employmentRate).toBe(0)
    expect(result[1].teams[0].employees[0].employmentRate).toBe(1)
  })

  it('keeps rate changes and repeated membership in a single employee row', () => {
    const [department] = project([
      segment({ endDate: '2026-11-10' }),
      segment({ startDate: '2026-11-11', employmentRate: 0.5 }),
    ])
    expect(department.teams[0].employees).toHaveLength(1)
    expect(department.dailyCapacity?.['2026-11-10']).toBe(1)
    expect(department.dailyCapacity?.['2026-11-11']).toBe(0.5)
    expect(department.teams[0].employees[0].employmentRate).toBe(0.5)
  })

  it('retains terminated employees only for their employment interval', () => {
    const [department] = project([segment({ endDate: '2026-11-15' })])
    expect(department.teams[0].employees).toHaveLength(1)
    expect(department.dailyCapacity?.['2026-11-15']).toBe(1)
    expect(department.dailyCapacity?.['2026-11-16']).toBeUndefined()
    expect(department.teams[0].employees[0].employmentRate).toBe(0)
  })

  it('uses supplied frozen baseline intervals across month boundaries', () => {
    const [department] = project([segment({ startDate: '2026-10-01', endDate: '2026-11-18', employmentRate: 0.75 })])
    expect(department.dailyCapacity?.['2026-10-31']).toBe(0.75)
    expect(department.dailyCapacity?.['2026-11-01']).toBe(0.75)
    expect(department.dailyCapacity?.['2026-11-18']).toBe(0.75)
    expect(department.dailyCapacity?.['2026-11-19']).toBeUndefined()
  })

  it('creates unassigned and historical team rows without inventing names', () => {
    const [department] = project([
      segment({ teamId: null, endDate: '2026-11-10' }),
      segment({ teamId: 'deleted-team', startDate: '2026-11-11' }),
    ])
    expect(department.teams.find(team => team.id === 'unassigned-old')?.name).toBe('Без команды')
    expect(department.teams.find(team => team.id === 'deleted-team')?.name).toBe('Команда')
    expect(department.totalEmployees).toBe(1)
  })

  it('filters nonintersecting loadings without changing input objects or creating unauthorized departments', () => {
    const source = departments()
    const outside = { ...loading, id: 'outside', startDate: '2026-12-01', endDate: '2026-12-02' }
    const employees = [{ ...employee, loadings: [loading, outside] }]
    const segments = [segment(), segment({ departmentId: 'not-permitted' })]
    const before = JSON.stringify({ source, employees, segments })
    const result = projectEmploymentHistory(source, employees, segments, '2026-11-19')
    expect(result).toHaveLength(2)
    expect(result[0].teams[0].employees[0].loadings).toEqual([loading])
    expect(JSON.stringify({ source, employees, segments })).toBe(before)
  })

  it('preserves guests with all employment intervals without doubling department totals', () => {
    const source = departments()
    source[1].teams.push({
      id: 'guests-new', name: 'Гости', departmentId: 'new', isGuestTeam: true,
      employees: [{ ...employee, isGuest: true }, { ...employee, isGuest: true }],
    })
    const result = projectEmploymentHistory(source, [employee], [
      segment({ endDate: '2026-11-10' }),
      segment({ departmentId: 'new', teamId: 'new-team', startDate: '2026-11-11', employmentRate: 0.5 }),
    ], '2026-11-19')
    const guestTeam = result[1].teams.find(team => team.isGuestTeam)!
    expect(guestTeam.employees).toHaveLength(1)
    expect(guestTeam.dailyCapacity?.['2026-11-10']).toBe(1)
    expect(guestTeam.dailyCapacity?.['2026-11-11']).toBe(0.5)
    expect(result[1].dailyCapacity?.['2026-11-10']).toBeUndefined()
    expect(result[1].dailyCapacity?.['2026-11-11']).toBe(0.5)
    expect(result[1].dailyWorkloads?.['2026-11-11']).toBe(1)
  })
})

describe('capacity calculations', () => {
  it('retains the legacy fallback only when history is absent', () => {
    expect(getDailyCapacity({}, '2026-11-19', 3)).toBe(3)
    expect(getDailyCapacity({ dailyCapacity: {} }, '2026-11-19', 3)).toBe(0)
  })

  it('calculates the ratio of sums rather than an average of percentages', () => {
    expect(getMonthlyCapacityPercentage({
      dailyCapacity: { '2026-11-02': 1, '2026-11-03': 3 },
      dailyWorkloads: { '2026-11-02': 1, '2026-11-03': 1 },
    }, month)).toBe(50)
  })

  it('uses the same company calendar for both sums and ignores holidays', () => {
    expect(getMonthlyCapacityPercentage({
      dailyCapacity: { '2026-11-02': 1, '2026-11-03': 3 },
      dailyWorkloads: { '2026-11-02': 1, '2026-11-03': 1 },
    }, month, new Map([['2026-11-03', { isWorkday: false, isHoliday: true }]]))).toBe(100)
  })

  it('returns no calculation base for zero capacity and supports the legacy denominator', () => {
    expect(getMonthlyCapacityPercentage({ dailyCapacity: {}, dailyWorkloads: { '2026-11-02': 1 } }, month)).toBeNull()
    expect(getMonthlyCapacityPercentage({ dailyWorkloads: { '2026-11-02': 1, '2026-11-03': 1 } }, month, undefined, 2)).toBe(50)
  })
})
