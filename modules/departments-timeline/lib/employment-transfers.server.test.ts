// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Department, Employee } from '../types'

const mocks = vi.hoisted(() => ({ admin: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: mocks.admin }))
import { annotateEmployeeTransfers } from './employment-transfers.server'

type Period = {
  employee_id: string; department_id: string | null; team_id: string | null
  valid_from: string; valid_to: string | null
}
const uuid = (index: number) => `50000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const oldDepartment = uuid(10000)
const newDepartment = uuid(10001)
const oldTeam = uuid(20000)
const newTeam = uuid(20001)
const employeeId = uuid(1)
let periods: Period[]
let calls: { table: string; ids: string[]; offset: number }[]
let failedId: string | undefined
let outOfScope: boolean

function person(overrides: Partial<Employee> = {}): Employee {
  return { id: employeeId, name: 'Transferred', workload: 0,
    currentDepartmentId: newDepartment, currentTeamId: newTeam,
    employmentSegments: [{ employeeId, departmentId: oldDepartment, teamId: oldTeam,
      startDate: '2026-10-01', endDate: '2026-10-05', employmentRate: 1 }],
    ...overrides }
}
function fixture(people = [person()]): Department[] {
  return [{ id: oldDepartment, name: 'Old', totalEmployees: people.length,
    dailyCapacity: { '2026-10-01': 1 }, dailyWorkloads: { '2026-10-01': 0.5 },
    teams: [{ id: oldTeam, name: 'Old team', departmentId: oldDepartment,
      employees: people, dailyCapacity: { '2026-10-01': 1 }, dailyWorkloads: { '2026-10-01': 0.5 } }] }]
}
function period(overrides: Partial<Period> = {}): Period {
  return { employee_id: employeeId, department_id: oldDepartment, team_id: oldTeam,
    valid_from: '2026-10-01', valid_to: '2026-11-25', ...overrides }
}
function successor(overrides: Partial<Period> = {}): Period {
  return period({ department_id: newDepartment, team_id: newTeam,
    valid_from: '2026-11-25', valid_to: null, ...overrides })
}

beforeEach(() => {
  vi.clearAllMocks()
  periods = []; calls = []; failedId = undefined; outOfScope = false
  mocks.admin.mockReturnValue({ from: (table: string) => {
    let ids: string[] = []
    const query = {
      select: () => query,
      in: (_column: string, selected: string[]) => { ids = selected; return query },
      order: () => query,
      range: async (offset: number, end: number) => {
        calls.push({ table, ids: [...ids], offset })
        if (ids.length > 100 || (failedId && ids.includes(failedId))) return { data: null, error: { message: 'private error' } }
        const data = periods.filter(row => ids.includes(row.employee_id))
          .sort((a, b) => a.employee_id.localeCompare(b.employee_id) || a.valid_from.localeCompare(b.valid_from))
          .slice(offset, end + 1)
        if (outOfScope) data.push(period({ employee_id: uuid(999999) }))
        return { data, error: null }
      },
    }
    return query
  } })
})

describe('transfer date enrichment', () => {
  it('finds the actual transfer after rate-only periods outside the clipped viewport', async () => {
    periods = [period({ valid_to: '2026-10-10' }),
      period({ valid_from: '2026-10-10' }), successor()]
    const source = fixture()
    const before = JSON.stringify(source)
    const result = await annotateEmployeeTransfers(source)
    expect(result[0].teams[0].employees[0].transferredOn).toBe('2026-11-25')
    expect(result[0].dailyCapacity).toBe(source[0].dailyCapacity)
    expect(result[0].dailyWorkloads).toBe(source[0].dailyWorkloads)
    expect(result[0].teams[0].dailyCapacity).toBe(source[0].teams[0].dailyCapacity)
    expect(JSON.stringify(source)).toBe(before)
    expect(calls.every(call => call.table === 'employee_employment_periods')).toBe(true)
  })

  it('recognizes a team-only transfer and supports the unassigned source team', async () => {
    periods = [period({ team_id: null }), successor({ department_id: oldDepartment })]
    const source = fixture([person({ currentDepartmentId: oldDepartment })])
    source[0].teams[0].id = `unassigned-${oldDepartment}`
    expect((await annotateEmployeeTransfers(source))[0].teams[0].employees[0].transferredOn).toBe('2026-11-25')
  })

  it('does not mistake a rate-only change, a final finish, a gap or baseline for a transfer', async () => {
    for (const rows of [
      [period(), successor({ department_id: oldDepartment, team_id: oldTeam })],
      [period()],
      [period({ valid_to: '2026-11-24' }), successor()],
      [],
    ]) {
      periods = rows
      expect((await annotateEmployeeTransfers(fixture()))[0].teams[0].employees[0].transferredOn).toBeUndefined()
    }
    expect(calls.some(call => call.table === 'employee_employment_baseline')).toBe(false)
  })

  it('uses the most recent departure from a repeated former membership', async () => {
    periods = [period({ valid_to: '2026-10-10' }),
      successor({ valid_from: '2026-10-10', valid_to: '2026-10-20' }),
      period({ valid_from: '2026-10-20' }), successor()]
    expect((await annotateEmployeeTransfers(fixture()))[0].teams[0].employees[0].transferredOn).toBe('2026-11-25')
  })

  it('does not read periods for current, guest, shortage or legacy rows', async () => {
    const source = fixture([
      person({ currentDepartmentId: oldDepartment, currentTeamId: oldTeam }),
      person({ id: uuid(2), isGuest: true }), person({ id: uuid(3), isShortage: true }),
      person({ id: uuid(4), currentDepartmentId: undefined, currentTeamId: undefined }),
    ])
    expect(await annotateEmployeeTransfers(source)).toBe(source)
    expect(mocks.admin).not.toHaveBeenCalled()
    const guestTeam = fixture()
    guestTeam[0].teams[0].isGuestTeam = true
    expect(await annotateEmployeeTransfers(guestTeam)).toBe(guestTeam)
  })

  it('does not annotate the current row or expose private successor membership metadata', async () => {
    const privateDepartment = uuid(70000)
    const privateTeam = uuid(70001)
    periods = [period(), successor({ department_id: privateDepartment, team_id: privateTeam })]
    const source = fixture()
    source.push({ id: newDepartment, name: 'Current', totalEmployees: 1,
      teams: [{ id: newTeam, name: 'Current team', departmentId: newDepartment, employees: [person()] }] })
    const result = await annotateEmployeeTransfers(source)
    expect(result[0].teams[0].employees[0].transferredOn).toBe('2026-11-25')
    expect(result[1].teams[0].employees[0].transferredOn).toBeUndefined()
    expect(JSON.stringify(result)).not.toContain(privateDepartment)
    expect(JSON.stringify(result)).not.toContain(privateTeam)
  })

  it('bounds candidate UUIDs, deduplicates repeated rows and ignores non-candidate identities', async () => {
    const people = Array.from({ length: 201 }, (_, index) => person({ id: uuid(index + 1) }))
    const source = fixture([...people, people[0]])
    periods = people.flatMap(employee => [period({ employee_id: employee.id }), successor({ employee_id: employee.id })])
    periods.push(period({ employee_id: uuid(99999) }))
    const result = await annotateEmployeeTransfers(source)
    expect(result[0].teams[0].employees.every(employee => employee.transferredOn === '2026-11-25')).toBe(true)
    expect(calls.map(call => call.ids.length)).toEqual([100, 100, 1])
    expect(calls.flatMap(call => call.ids)).toEqual(people.map(employee => employee.id))
  })

  it('follows a successor on the second API page', async () => {
    const day = (offset: number) => {
      const date = new Date('2020-01-01T00:00:00Z')
      date.setUTCDate(date.getUTCDate() + offset)
      return date.toISOString().slice(0, 10)
    }
    periods = Array.from({ length: 1000 }, (_, index) => period({ valid_from: day(index), valid_to: day(index + 1) }))
    periods.push(successor({ valid_from: day(1000) }))
    const result = await annotateEmployeeTransfers(fixture())
    expect(result[0].teams[0].employees[0].transferredOn).toBe(day(1000))
    expect(calls.map(call => call.offset)).toEqual([0, 1000])
  })

  it('fails the whole enrichment on a later batch error without mutating the input', async () => {
    const source = fixture(Array.from({ length: 101 }, (_, index) => person({ id: uuid(index + 1) })))
    periods = [period(), successor()]
    failedId = uuid(101)
    const before = JSON.stringify(source)
    await expect(annotateEmployeeTransfers(source)).rejects.toThrow('Не удалось прочитать даты перевода')
    expect(JSON.stringify(source)).toBe(before)
  })

  it('rejects malformed history or an unexpected identity without exposing it', async () => {
    periods = [period({ valid_from: '2026-02-30' })]
    await expect(annotateEmployeeTransfers(fixture())).rejects.toThrow('Не удалось прочитать даты перевода')
    periods = []
    outOfScope = true
    await expect(annotateEmployeeTransfers(fixture())).rejects.toThrow('Не удалось прочитать даты перевода')
  })
})
