import { describe, expect, it } from 'vitest'
import type { Department, EmploymentSegment, Loading } from '../types'
import { clipLoadingsToEmployment, filterCurrentEmployeeRows } from './employment-display'
import { flattenDepartments } from '../components/timeline/flatten-departments'

const loading: Loading = {
  id: 'loading', sectionId: 'section', stageId: 'stage',
  startDate: '2026-10-01', endDate: '2026-11-30', rate: 1,
}
const segment = (startDate: string, endDate: string): EmploymentSegment => ({
  employeeId: 'employee', departmentId: 'department', teamId: 'team',
  startDate, endDate, employmentRate: 1,
})

describe('current roster display', () => {
  it('hides former department/team memberships while preserving the current row and historical aggregates', () => {
    const historical = { id: 'moved', name: 'Moved', workload: 0, currentDepartmentId: 'new', currentTeamId: 'new-team' }
    const totals = { '2026-11-24': 1 }
    const source: Department[] = [
      { id: 'old', name: 'Old', totalEmployees: 1, dailyCapacity: totals, dailyWorkloads: totals,
        teams: [{ id: 'old-team', name: 'Old', departmentId: 'old', employees: [historical], dailyCapacity: totals, dailyWorkloads: totals }] },
      { id: 'new', name: 'New', totalEmployees: 1,
        teams: [{ id: 'previous-team', name: 'Previous', departmentId: 'new', employees: [historical] },
          { id: 'new-team', name: 'Current', departmentId: 'new', employees: [historical] }] },
    ]
    const before = JSON.stringify(source)
    const result = filterCurrentEmployeeRows(source, [])
    expect(result[0].teams[0].employees).toEqual([])
    expect(result[1].teams[0].employees).toEqual([])
    expect(result[1].teams[1].employees).toEqual([historical])
    expect(result[0].dailyCapacity).toBe(totals)
    expect(result[0].dailyWorkloads).toBe(totals)
    expect(result[0].teams[0].dailyCapacity).toBe(totals)
    expect(JSON.stringify(source)).toBe(before)
  })

  it('preserves granted guests, shortage and legacy rows, and understands unassigned current teams', () => {
    const source: Department[] = [{ id: 'host', name: 'Host', totalEmployees: 1, teams: [
      { id: 'old-team', name: 'Old', departmentId: 'host', employees: [
        { id: 'guest', name: 'Guest', workload: 1, isGuest: true, currentDepartmentId: 'home', currentTeamId: 'home-team' },
        { id: 'legacy', name: 'Legacy', workload: 0 },
        { id: 'left', name: 'Left', workload: 0, currentDepartmentId: null },
        { id: 'no-team', name: 'No team', workload: 0, currentDepartmentId: 'host', currentTeamId: null },
        { id: 'shortage', name: 'Shortage', workload: 1, isShortage: true, currentDepartmentId: null },
      ] },
      { id: 'unassigned-host', name: 'Unassigned', departmentId: 'host', employees: [
        { id: 'no-team', name: 'No team', workload: 0, currentDepartmentId: 'host', currentTeamId: null },
        { id: 'legacy-empty-team', name: 'Empty team from workload view', workload: 0,
          currentDepartmentId: 'host', currentTeamId: '00000000-0000-0000-0000-000000000000' },
      ] },
    ] }]
    const result = filterCurrentEmployeeRows(source, [])
    expect(result[0].teams[0].employees.map(employee => employee.id)).toEqual(['guest', 'legacy', 'shortage'])
    expect(result[0].teams[1].employees.map(employee => employee.id)).toEqual(['no-team', 'legacy-empty-team'])
  })

  it('hides finished own/guest rows without changing historical totals, capacity or the cached input', () => {
    const departed = { id: 'finished', name: 'Finished', workload: 0 }
    const active = { id: 'active', name: 'Active', workload: 1 }
    const shortage = { id: 'shortage', name: 'Shortage', workload: 1, isShortage: true }
    const totals = { '2026-11-24': 2, '2026-11-25': 1 }
    const original: Department[] = [{ id: 'dept', name: 'Dept', totalEmployees: 2,
      dailyWorkloads: totals, dailyCapacity: totals, teams: [
        { id: 'own', name: 'Own', departmentId: 'dept', employees: [departed, active, shortage], dailyWorkloads: totals, dailyCapacity: totals },
        { id: 'guest', name: 'Guest', departmentId: 'dept', isGuestTeam: true, employees: [departed] },
      ] }]
    const before = JSON.stringify(original)
    const displayed = filterCurrentEmployeeRows(original, ['finished', 'shortage'])
    expect(displayed[0].teams[0].employees.map(person => person.id)).toEqual(['active', 'shortage'])
    expect(displayed[0].teams[1].employees).toEqual([])
    expect(displayed[0].dailyCapacity).toBe(original[0].dailyCapacity)
    expect(displayed[0].dailyWorkloads).toBe(original[0].dailyWorkloads)
    expect(displayed[0].teams[0].dailyWorkloads).toBe(original[0].teams[0].dailyWorkloads)
    expect(JSON.stringify(original)).toBe(before)
    expect(filterCurrentEmployeeRows(original, [])).toBe(original)
  })
})

describe('employment display clipping', () => {
  it('retains the legacy ID and interval without staffing history', () => {
    expect(clipLoadingsToEmployment([loading], undefined)).toEqual([{ ...loading, sourceLoadingId: loading.id }])
  })

  it('clips the visible interval while preserving original ID lookup and source data', () => {
    const before = { ...loading }
    const [display] = clipLoadingsToEmployment([loading], [segment('2026-11-10', '2026-11-15')])
    expect(display.startDate).toBe('2026-11-10')
    expect(display.endDate).toBe('2026-11-15')
    expect(display.sourceLoadingId).toBe(loading.id)
    expect(display.id).not.toBe(loading.id)
    expect(loading).toEqual(before)
  })

  it('merges adjacent rate periods so one loading is not counted twice in monthly layout', () => {
    const result = clipLoadingsToEmployment([loading], [
      segment('2026-11-15', '2026-11-30'),
      { ...segment('2026-11-01', '2026-11-14'), employmentRate: 0.5 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ startDate: '2026-11-01', endDate: '2026-11-30', rate: 1 })
  })

  it('keeps separate fragments across an employment gap with unique display keys', () => {
    const result = clipLoadingsToEmployment([loading], [
      segment('2026-10-25', '2026-10-31'), segment('2026-11-05', '2026-11-10'),
    ])
    expect(result.map(item => [item.startDate, item.endDate])).toEqual([
      ['2026-10-25', '2026-10-31'], ['2026-11-05', '2026-11-10'],
    ])
    expect(new Set(result.map(item => item.id)).size).toBe(2)
    expect(result.every(item => item.sourceLoadingId === loading.id)).toBe(true)
  })

  it('keeps inclusive boundaries and removes wholly outside loadings', () => {
    expect(clipLoadingsToEmployment([loading], [segment('2026-11-30', '2026-12-01')])[0]).toMatchObject({
      startDate: '2026-11-30', endDate: '2026-11-30',
    })
    expect(clipLoadingsToEmployment([loading], [segment('2026-12-01', '2026-12-31')])).toEqual([])
    expect(clipLoadingsToEmployment([loading], [])).toEqual([])
  })

  it('distinguishes historical rows with the same employee and team in different departments', () => {
    const items = ['old', 'new'].map(id => ({
      id, name: id, totalEmployees: 1,
      teams: [{ id: 'same-team', name: 'Команда', departmentId: id, employees: [{ id: 'employee', name: 'Сотрудник', workload: 0 }] }],
    }))
    const rows = flattenDepartments([{ key: 'all', label: 'Все', items }], {
      department: new Set(['old', 'new']), team: new Set(['same-team']), employee: new Set(),
    })
    expect(new Set(rows.map(row => row.key)).size).toBe(rows.length)
    expect(rows.filter(row => row.kind === 'employee').map(row => row.key)).toEqual([
      'emp:old:same-team:employee', 'emp:new:same-team:employee',
    ])
  })
})
