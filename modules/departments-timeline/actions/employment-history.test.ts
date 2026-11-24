// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(), getUser: vi.fn(),
  getContext: vi.fn(), status: vi.fn(), restricted: vi.fn(), captureException: vi.fn(),
}))
vi.mock('@/utils/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/modules/users/lib/employment-client', () => ({ getEmploymentStatus: mocks.status }))
vi.mock('@/modules/permissions/server/restricted-projects', () => ({ getRestrictedProjectIds: mocks.restricted }))
vi.mock('@/modules/permissions', async () => ({
  ...(await import('@/modules/permissions/utils/mandatory-filters')),
  getFilterContextForTasksTabs: mocks.getContext,
  getFilterContext: vi.fn(), assertCanEditLoading: vi.fn(), canBulkShiftDepartment: vi.fn(),
}))
vi.mock('@/modules/inline-filter', async () => ({
  getNegatedParams: (await import('@/modules/inline-filter/parser')).getNegatedParams,
}))
vi.mock('@sentry/nextjs', () => ({
  startSpan: (_options: unknown, callback: () => unknown) => callback(),
  captureException: mocks.captureException, captureMessage: vi.fn(), addBreadcrumb: vi.fn(),
}))

import { getDepartmentsData } from './index'
import type { Department } from '../types'

const ids = {
  actor: '10000000-0000-4000-8000-000000000001',
  employee: '10000000-0000-4000-8000-000000000002',
  guest: '10000000-0000-4000-8000-000000000003',
  department: '20000000-0000-4000-8000-000000000001',
  otherDepartment: '20000000-0000-4000-8000-000000000002',
  team: '30000000-0000-4000-8000-000000000001',
  otherTeam: '30000000-0000-4000-8000-000000000002',
  project: '40000000-0000-4000-8000-000000000001',
  restricted: '40000000-0000-4000-8000-000000000002',
}
const range = { startDate: '2026-11-18', endDate: '2026-11-20' }
type Row = Record<string, unknown>
type ClientKind = 'session' | 'admin'
type QueryResult = { data: Row[] | null; error: { message: string } | null }
type Constraint = { operation: string; column: string; value: unknown }
let tables: Record<string, Row[]>
let failures: Record<string, string>
let calls: Query[]
let failEmployeeId: string | undefined

// A small data fixture adapter applies actual requested equality/membership/range
// predicates. Unsupported expressions fail the test instead of silently matching.
class Query implements PromiseLike<QueryResult> {
  readonly constraints: Constraint[] = []
  private predicates: ((row: Row) => boolean)[] = []
  private offset = 0
  private end = Number.POSITIVE_INFINITY
  constructor(readonly client: ClientKind, readonly table: string) { calls.push(this) }
  select() { return this }
  order() { return this }
  eq(column: string, value: unknown) {
    this.constraints.push({ operation: 'eq', column, value })
    this.predicates.push(row => row[column] === value)
    return this
  }
  in(column: string, value: unknown[]) {
    this.constraints.push({ operation: 'in', column, value })
    this.predicates.push(row => value.includes(row[column]))
    return this
  }
  lte(column: string, value: string) {
    this.constraints.push({ operation: 'lte', column, value })
    this.predicates.push(row => typeof row[column] === 'string' && row[column] <= value)
    return this
  }
  gte(column: string, value: string) {
    this.constraints.push({ operation: 'gte', column, value })
    this.predicates.push(row => typeof row[column] === 'string' && row[column] >= value)
    return this
  }
  or(expression: string) {
    this.constraints.push({ operation: 'or', column: '', value: expression })
    const restricted = /^project_id\.is\.null,project_id\.not\.in\.\(([^)]*)\)$/.exec(expression)
    const period = /^valid_to\.is\.null,valid_to\.gt\.(\d{4}-\d{2}-\d{2})$/.exec(expression)
    if (restricted) {
      const excluded = restricted[1].split(',')
      this.predicates.push(row => row.project_id == null || !excluded.includes(String(row.project_id)))
    } else if (period) {
      this.predicates.push(row => row.valid_to == null || String(row.valid_to) > period[1])
    } else {
      throw new Error(`Unsupported fixture expression: ${expression}`)
    }
    return this
  }
  range(offset: number, end: number) { this.offset = offset; this.end = end; return this }
  then<TResult1 = QueryResult, TResult2 = never>(
    resolve?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const idFilter = this.constraints.find(item => item.operation === 'in' && item.column === 'user_id')
    const requestedIds = (idFilter?.value ?? []) as string[]
    const oversized = requestedIds.length > 100
    const error = failures[`${this.client}/${this.table}`]
      || (oversized ? 'HeadersOverflowError' : undefined)
      || (failEmployeeId && requestedIds.includes(failEmployeeId) ? 'Failed batch' : undefined)
    const result: QueryResult = error
      ? { data: null, error: { message: error } }
      : { data: (tables[this.table] ?? []).filter(row => this.predicates.every(test => test(row)))
        .slice(this.offset, this.end + 1), error: null }
    return Promise.resolve(result).then(resolve, reject)
  }
}

function context(scope: Row = { level: 'team', teamIds: [ids.team], isLocked: true }) {
  return {
    success: true,
    data: { userId: ids.actor, permissions: [], filterPermissions: [], scope },
  }
}

function loading(id: string, start: string, finish = start, projectId = ids.project, employeeId = ids.employee): Row {
  return {
    user_id: employeeId, full_name: 'Employee', first_name: 'Test', last_name: 'Employee',
    final_department_id: ids.otherDepartment, final_team_id: ids.otherTeam,
    final_department_name: 'Other', final_team_name: 'Other team',
    email: 'employee@example.test', position_name: 'Engineer', category_name: 'Specialist',
    employment_rate: 3, loading_id: id, loading_start: start, loading_finish: finish,
    loading_status: 'active', loading_rate: 1, project_id: projectId, project_name: projectId,
  }
}

function resultData(result: Awaited<ReturnType<typeof getDepartmentsData>>): Department[] {
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(result.error)
  return result.data
}

describe('dated department reader security and data contract', () => {
  afterEach(() => { vi.restoreAllMocks() })
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    calls = []
    failures = {}
    failEmployeeId = undefined
    tables = {
      projects: [{ project_id: ids.restricted, is_restricted: true }],
      view_organizational_structure: [
        { department_id: ids.department, department_name: 'Allowed', team_id: ids.team, team_name: 'Allowed team' },
        { department_id: ids.otherDepartment, department_name: 'Other', team_id: ids.otherTeam, team_name: 'Other team' },
      ],
      employee_loading_access_grants: [],
      employee_employment_baseline: [{ employee_id: ids.employee, department_id: ids.department, team_id: ids.team, employment_rate: 1 }],
      employee_employment_periods: [{ employee_id: ids.employee, department_id: ids.department, team_id: ids.team,
        employment_rate: 2, valid_from: '2026-11-19', valid_to: null }],
      view_users: [{ user_id: ids.employee, full_name: 'Employee', department_id: ids.otherDepartment,
        team_id: ids.otherTeam, employment_rate: 3 }],
      view_employee_workloads: [],
    }
    mocks.getUser.mockResolvedValue({ data: { user: { id: ids.actor } }, error: null })
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from: (table: string) => new Query('session', table) })
    mocks.createAdminClient.mockImplementation(() => ({ from: (table: string) => new Query('admin', table) }))
    mocks.getContext.mockResolvedValue(context())
    mocks.status.mockResolvedValue({ enabled: true, cutoverDate: '2026-11-19', today: '2026-11-19' })
    // Session RLS may hide restricted projects entirely; authoritative read must still exclude them.
    mocks.restricted.mockResolvedValue([])
  })

  it('rejects unauthenticated callers before status, scope or admin reads', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await getDepartmentsData({}, range)).success).toBe(false)
    expect(mocks.status).not.toHaveBeenCalled()
    expect(mocks.getContext).not.toHaveBeenCalled()
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it.each([
    { level: 'team', teamIds: [] }, { level: 'team' },
    { level: 'department', departmentIds: [] },
    { level: 'subdivision', subdivisionIds: [] },
    { level: 'projects', projectIds: [] },
  ])('rejects empty $level scope before admin access', async scope => {
    mocks.getContext.mockResolvedValue(context(scope))
    expect((await getDepartmentsData({}, range)).success).toBe(false)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
    expect(calls).toHaveLength(0)
  })

  it('does not read workloads or history if authoritative restricted lookup fails', async () => {
    failures['admin/projects'] = 'Permission database unavailable'
    expect((await getDepartmentsData({}, range)).success).toBe(false)
    expect(calls.map(call => call.table)).toEqual(['projects'])
    expect(mocks.captureException).toHaveBeenCalled()
  })

  it('retains saved capacity when the employee only has restricted loadings', async () => {
    tables.view_employee_workloads = [loading('secret', '2026-11-18', '2026-11-20', ids.restricted)]
    const [department] = resultData(await getDepartmentsData({}, range))
    expect(department.id).toBe(ids.department)
    expect(department.dailyCapacity).toEqual({ '2026-11-18': 1, '2026-11-19': 2, '2026-11-20': 2 })
    const employee = department.teams[0].employees[0]
    expect(employee.id).toBe(ids.employee)
    expect(employee.loadings).toEqual([])
    expect(employee.employmentConflicts).toEqual([])
    expect(JSON.stringify(department)).not.toContain(ids.restricted)
    expect(calls.find(call => call.table === 'view_users')?.constraints).toContainEqual({
      operation: 'in', column: 'user_id', value: [ids.employee],
    })
  })

  it('does not return post-transfer or out-of-range loadings as conflicts to a team reader', async () => {
    tables.employee_employment_periods[0] = {
      ...tables.employee_employment_periods[0], department_id: ids.otherDepartment, team_id: ids.otherTeam,
    }
    tables.view_employee_workloads = [loading('allowed', '2026-11-18'),
      loading('other-team-work', '2026-11-20'), loading('outside-range', '2026-12-01')]
    const [department] = resultData(await getDepartmentsData({ team_id: ids.otherTeam }, range))
    const employee = department.teams[0].employees[0]
    expect(department.id).toBe(ids.department)
    expect(employee.loadings?.map(item => item.id)).toEqual(['allowed'])
    expect(employee.employmentConflicts).toEqual([])
    expect(employee.dailyCapacity).toEqual({ '2026-11-18': 1 })
    expect(JSON.stringify(department)).not.toContain('other-team-work')
    expect(JSON.stringify(department)).not.toContain('outside-range')
  })

  it('uses baseline before cutover and dated rate after it rather than current profile rate', async () => {
    tables.view_employee_workloads = [loading('spans-cutover', '2026-11-18', '2026-11-20')]
    const [department] = resultData(await getDepartmentsData({}, range))
    expect(department.dailyCapacity).toEqual({ '2026-11-18': 1, '2026-11-19': 2, '2026-11-20': 2 })
    expect(department.dailyWorkloads).toEqual({ '2026-11-18': 1, '2026-11-19': 1, '2026-11-20': 1 })
    const periods = calls.find(call => call.table === 'employee_employment_periods')!
    expect(periods.constraints).toContainEqual({ operation: 'lte', column: 'valid_from', value: range.endDate })
    expect(periods.constraints).toContainEqual({ operation: 'or', column: '', value: `valid_to.is.null,valid_to.gt.${range.startDate}` })
    expect(calls.filter(call => call.table === 'employee_employment_baseline')).toHaveLength(1)
  })

  it('does not read baseline for a wholly post-cutover range', async () => {
    const [department] = resultData(await getDepartmentsData({}, { startDate: '2026-11-19', endDate: '2026-11-20' }))
    expect(department.dailyCapacity).toEqual({ '2026-11-19': 2, '2026-11-20': 2 })
    expect(calls.some(call => call.table === 'employee_employment_baseline')).toBe(false)
  })

  it('does not replace visible employee metadata with the minimal identity fallback', async () => {
    tables.view_employee_workloads = [loading('visible', '2026-11-19')]
    const [department] = resultData(await getDepartmentsData({}, range))
    expect(department.teams[0].employees[0]).toMatchObject({
      email: 'employee@example.test', position: 'Engineer', categoryName: 'Specialist',
    })
  })

  it('uses only frozen baseline for a wholly pre-cutover range', async () => {
    const [department] = resultData(await getDepartmentsData({}, { startDate: '2026-11-17', endDate: '2026-11-18' }))
    expect(department.dailyCapacity).toEqual({ '2026-11-17': 1, '2026-11-18': 1 })
    expect(calls.some(call => call.table === 'employee_employment_periods')).toBe(false)
  })

  it('fails instead of returning a partial capacity denominator when the identity read fails', async () => {
    failures['admin/view_users'] = 'Identity lookup unavailable'
    const result = await getDepartmentsData({}, range)
    expect(result.success).toBe(false)
    expect(mocks.captureException).toHaveBeenCalled()
  })

  it('rejects malformed dates and overlarge ranges before creating an admin client', async () => {
    expect((await getDepartmentsData({}, { startDate: '2026-02-30', endDate: '2026-03-01' })).success).toBe(false)
    expect((await getDepartmentsData({}, { startDate: '2000-01-01', endDate: '2026-11-20' })).success).toBe(false)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  function largeDepartment(size: number) {
    const employeeIds = Array.from({ length: size }, (_, index) =>
      `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`)
    tables.employee_employment_baseline = employeeIds.map(employee_id => ({
      employee_id, department_id: ids.department, team_id: ids.team, employment_rate: 1,
    }))
    tables.employee_employment_periods = []
    tables.view_users = employeeIds.map(user_id => ({
      user_id, full_name: user_id, department_id: ids.department, team_id: ids.team, employment_rate: 1,
    }))
    tables.view_employee_workloads = employeeIds.map((id, index) =>
      loading(`visible-${index}`, '2026-11-18', '2026-11-18', ids.project, id))
    return employeeIds
  }

  it('reads 596 employees in bounded requests without losing capacity, loadings or restrictions', async () => {
    const employeeIds = largeDepartment(596)
    tables.view_employee_workloads.push(
      loading('secret', '2026-11-18', '2026-11-18', ids.restricted, employeeIds[595]),
      loading('outside-date', '2026-12-01', '2026-12-01', ids.project, employeeIds[595]),
      loading('unauthorized', '2026-11-18', '2026-11-18', ids.project, ids.guest))
    const [department] = resultData(await getDepartmentsData({}, range))
    expect(department.dailyCapacity?.['2026-11-18']).toBe(596)
    expect(department.dailyWorkloads?.['2026-11-18']).toBe(596)
    expect(department.teams.flatMap(team => team.employees)).toHaveLength(596)
    for (const table of ['view_users', 'view_employee_workloads']) {
      const batches = calls.filter(call => call.table === table).map(call =>
        call.constraints.find(item => item.operation === 'in' && item.column === 'user_id')!.value as string[])
      expect(batches.map(batch => batch.length)).toEqual([100, 100, 100, 100, 100, 96])
      expect(batches.flat()).toEqual(employeeIds)
    }
    expect(JSON.stringify(department)).not.toMatch(/secret|outside-date|unauthorized/)
  })

  it('does not return a partial department when a later employee batch fails', async () => {
    const employeeIds = largeDepartment(201)
    failEmployeeId = employeeIds[150]
    expect((await getDepartmentsData({}, range)).success).toBe(false)
  })

  it('continues row pagination within each employee batch', async () => {
    const employeeIds = largeDepartment(101)
    tables.view_employee_workloads = Array.from({ length: 1001 }, (_, index) =>
      loading(`many-${index}`, '2026-11-18', '2026-11-18', ids.project, employeeIds[0]))
    tables.view_employee_workloads.push(loading('last-batch', '2026-11-18', '2026-11-18', ids.project, employeeIds[100]))
    const [department] = resultData(await getDepartmentsData({}, range))
    expect(department.dailyWorkloads?.['2026-11-18']).toBe(1002)
    expect(department.dailyCapacity?.['2026-11-18']).toBe(101)
  })

  it('skips workload and identity requests for an empty authorized historical scope', async () => {
    tables.employee_employment_baseline = []
    tables.employee_employment_periods = []
    resultData(await getDepartmentsData({}, range))
    expect(calls.some(call => ['view_users', 'view_employee_workloads'].includes(call.table))).toBe(false)
  })

  it('applies authoritative restricted filtering to granted guests without adding guest capacity to the host', async () => {
    tables.employee_loading_access_grants = [{ employee_id: ids.guest, granted_to_department_id: ids.department }]
    tables.employee_employment_baseline.push({ employee_id: ids.guest, department_id: ids.otherDepartment, team_id: ids.otherTeam, employment_rate: 1 })
    tables.employee_employment_periods.push({ employee_id: ids.guest, department_id: ids.otherDepartment,
      team_id: ids.otherTeam, employment_rate: 1, valid_from: '2026-11-19', valid_to: null })
    tables.view_users.push({ user_id: ids.guest, full_name: 'Guest', department_id: ids.otherDepartment, team_id: ids.otherTeam, employment_rate: 1 })
    tables.view_employee_workloads = [loading('guest-visible', '2026-11-19', '2026-11-19', ids.project, ids.guest),
      loading('guest-secret', '2026-11-19', '2026-11-19', ids.restricted, ids.guest)]
    const [department] = resultData(await getDepartmentsData({}, range))
    expect(department.dailyCapacity?.['2026-11-19']).toBe(2)
    expect(department.dailyWorkloads?.['2026-11-19'] ?? 0).toBe(0)
    const guest = department.teams.find(team => team.isGuestTeam)?.employees[0]
    expect(guest?.id).toBe(ids.guest)
    expect(guest?.homeDepartmentName).toBe('Other')
    expect(guest?.loadings?.map(item => item.id)).toEqual(['guest-visible'])
    expect(JSON.stringify(department)).not.toContain('guest-secret')
  })
})
