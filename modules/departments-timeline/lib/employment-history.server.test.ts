import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const db = vi.hoisted(() => ({ from: vi.fn(), rows: {} as Record<string, unknown[]>, calls: [] as unknown[][], error: false }))
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => ({ from: db.from }) }))
import { employmentRangeSchema, readEmploymentSegments } from './employment-history.server'

const employee = '00000000-0000-4000-8000-000000000001'
const guest = '00000000-0000-4000-8000-000000000002'
const dept = '00000000-0000-4000-8000-000000000003'
const team = '00000000-0000-4000-8000-000000000004'
const otherTeam = '00000000-0000-4000-8000-000000000005'
const row = { employee_id: employee, department_id: dept, team_id: team, employment_rate: 1 }
beforeEach(() => {
  db.calls = []; db.rows = {}; db.error = false
  db.from.mockImplementation((table: string) => {
    let filtered: unknown[] = db.rows[table] ?? []
    const query = {
      select: (fields: string) => { db.calls.push([table, 'select', fields]); return query },
      in: (column: string, ids: string[]) => {
        db.calls.push([table, 'in', column, ids])
        filtered = filtered.filter(value => ids.includes((value as Record<string, string>)[column])); return query
      },
      lte: (column: string, value: string) => { db.calls.push([table, 'lte', column, value]); return query },
      or: (value: string) => { db.calls.push([table, 'or', value]); return query },
      order: () => query,
      range: async (from: number, to: number) => ({ data: filtered.slice(from, to + 1), error: db.error ? { message: 'DB failure' } : null }),
    }
    return query
  })
})
describe('history reading contract', () => {
  it('joins immutable baseline and half-open periods without a duplicate cutover day', async () => {
    db.rows.employee_employment_baseline = [row]
    db.rows.employee_employment_periods = [{ ...row, employment_rate: 0.5, valid_from: '2026-11-19', valid_to: '2026-11-21' }]
    const result = await readEmploymentSegments({ startDate: '2026-11-01', endDate: '2026-11-30' }, '2026-11-19',
      [{ department_id: dept, team_id: team }], [], false)
    expect(result).toEqual([
      { employeeId: employee, departmentId: dept, teamId: team, employmentRate: 1, startDate: '2026-11-01', endDate: '2026-11-18' },
      { employeeId: employee, departmentId: dept, teamId: team, employmentRate: 0.5, startDate: '2026-11-19', endDate: '2026-11-20' },
    ])
    expect(db.calls).toContainEqual(['employee_employment_periods', 'lte', 'valid_from', '2026-11-30'])
    expect(db.calls).toContainEqual(['employee_employment_periods', 'or', 'valid_to.is.null,valid_to.gt.2026-11-01'])
  })
  it('scopes native teams, keeps granted guest periods and deduplicates overlapping scopes', async () => {
    db.rows.employee_employment_periods = [
      { ...row, valid_from: '2026-11-19', valid_to: null },
      { ...row, employee_id: guest, team_id: otherTeam, valid_from: '2026-11-19', valid_to: null },
    ]
    const result = await readEmploymentSegments({ startDate: '2026-11-19', endDate: '2026-11-30' }, '2026-11-19',
      [{ department_id: dept, team_id: team }], [guest], true)
    expect(result).toHaveLength(2)
    expect(result.filter(segment => segment.employeeId === guest)).toHaveLength(1)
    expect(db.calls.some(call => call[0] === 'employee_employment_baseline')).toBe(false)
  })
  it('does not replace a failed history read with current profiles', async () => {
    db.error = true
    await expect(readEmploymentSegments({ startDate: '2026-11-19', endDate: '2026-11-30' }, '2026-11-19',
      [{ department_id: dept, team_id: team }], [], false)).rejects.toThrow('Не удалось прочитать')
  })
  it.each([
    { startDate: '2026-02-30', endDate: '2026-03-01' },
    { startDate: '2026-11-30', endDate: '2026-11-01' },
    { startDate: '2020-01-01', endDate: '2030-01-01' },
    { startDate: '2026-11-19T00:00:00Z', endDate: '2026-11-30' },
  ])('rejects invalid or unbounded range %o', range => {
    expect(employmentRangeSchema.safeParse(range).success).toBe(false)
  })
})
