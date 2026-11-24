// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db'

const mocks = vi.hoisted(() => ({ status: vi.fn(), admin: vi.fn(), permissions: ['loadings.edit.scope.all'] as string[] }))
vi.mock('server-only', () => ({}))
vi.mock('./employment-client', () => ({ getEmploymentStatus: mocks.status }))
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/modules/permissions/server/get-filter-context', () => ({
  getFilterContext: async () => ({ success: true, data: {
    userId: other, permissions: mocks.permissions,
    grantedAccessDepartmentIds: ['20000000-0000-4000-8000-000000000001'],
  } }),
}))
import { assertEmploymentAvailable, assertEmploymentReassignment, getAvailableEmployeeIds, getAssignableEmployeeIds } from './employment-availability.server'

const employee = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const cutover = '2026-11-19'
type Period = { employee_id: string; valid_from: string; valid_to: string | null }

function setup(periods: Period[] = [], baseline: string[] = [], failedId?: string,
  grants: { employee_id: string; granted_to_department_id: string }[] = []) {
  const inCalls = vi.fn()
  const rangeCalls = vi.fn()
  const from = vi.fn((table: string) => {
    const rows = table === 'employee_employment_baseline' ? baseline.map(employee_id => ({ employee_id })) : periods
    const query = {
      select: vi.fn(() => query),
      in: vi.fn((column: string, ids: string[]) => { inCalls(table, column, ids); return query }),
      lte: vi.fn(() => query), or: vi.fn(() => query), order: vi.fn(() => query),
      range: vi.fn(async (start: number, end: number) => { rangeCalls(start, end); return { data: rows.slice(start, end + 1), error: null } }),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve(resolve({ data: rows, error: null })),
    }
    return query
  })
  mocks.admin.mockReturnValue({ from })
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: other } }, error: null })
  const supabase = {
    auth: { getUser },
    from: (table: string) => {
      let selectedIds: string[] = []
      const query = {
        select: () => query,
        in: (_column: string, ids: string[]) => { selectedIds = ids; inCalls(table, _column, ids); return query },
        order: () => query,
        range: async (start: number, end: number) => ({
          data: table === 'view_users' ? selectedIds.slice(start, end + 1).map(user_id => ({ user_id, department_id: null, team_id: null }))
            : grants.filter(grant => selectedIds.includes(grant.employee_id)).slice(start, end + 1),
          error: selectedIds.length > 100 || (failedId && selectedIds.includes(failedId)) ? { message: 'Request failed' } : null,
        }),
      }
      return query
    },
  } as unknown as SupabaseClient<Database>
  return { supabase, inCalls, rangeCalls, from, getUser }
}

describe('employment availability server boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.permissions = ['loadings.edit.scope.all']
    mocks.status.mockResolvedValue({ enabled: true, cutoverDate: cutover, today: cutover })
  })

  it('returns candidates unchanged before activation and never opens admin client', async () => {
    const { supabase } = setup()
    mocks.status.mockResolvedValue(null)
    expect(await getAvailableEmployeeIds(supabase, [employee], { startDate: cutover, endDate: cutover })).toEqual([employee])
    expect(mocks.admin).not.toHaveBeenCalled()
  })

  it('authorizes a full 596-person roster in bounded requests without losing anyone', async () => {
    const { supabase, inCalls } = setup()
    const ids = Array.from({ length: 596 }, (_, index) => `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`)
    expect(await getAssignableEmployeeIds(supabase, [...ids, ids[0]])).toEqual(ids)
    for (const table of ['view_users', 'employee_loading_access_grants']) {
      const batches = inCalls.mock.calls.filter(call => call[0] === table).map(call => call[2] as string[])
      expect(batches.map(batch => batch.length)).toEqual([100, 100, 100, 100, 100, 96])
      expect(batches.flat()).toEqual(ids)
    }
    expect(mocks.admin).not.toHaveBeenCalled()
  })

  it('rejects the complete authorization result when a later batch fails', async () => {
    const ids = Array.from({ length: 101 }, (_, index) => `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`)
    const { supabase } = setup([], [], ids[100])
    await expect(getAssignableEmployeeIds(supabase, ids)).rejects.toThrow('право назначения')
  })

  it('reads a relevant grant beyond the first 1000 rows without granting unrelated access', async () => {
    mocks.permissions = ['loadings.edit.scope.team']
    const grants = Array.from({ length: 1000 }, (_, index) => ({
      employee_id: employee, granted_to_department_id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    }))
    grants.push({ employee_id: employee, granted_to_department_id: '20000000-0000-4000-8000-000000000001' })
    const { supabase } = setup([], [], undefined, grants)
    expect(await getAssignableEmployeeIds(supabase, [employee, other])).toEqual([employee])
  })

  it('rejects malformed and reversed dates before database access', async () => {
    const { supabase } = setup()
    for (const range of [{ startDate: '2026-02-30', endDate: cutover }, { startDate: cutover, endDate: '2026-11-18' }]) {
      await expect(getAvailableEmployeeIds(supabase, [employee], range)).rejects.toThrow('диапазон')
    }
    expect(mocks.status).not.toHaveBeenCalled()
  })

  it('reads only authorized candidates and treats valid_to as exclusive', async () => {
    const { supabase, inCalls } = setup([{ employee_id: employee, valid_from: cutover, valid_to: '2026-11-21' }])
    expect(await getAvailableEmployeeIds(supabase, [employee], { startDate: cutover, endDate: '2026-11-20' })).toEqual([employee])
    expect(await getAvailableEmployeeIds(supabase, [employee], { startDate: cutover, endDate: '2026-11-21' })).toEqual([])
    expect(inCalls).toHaveBeenCalledWith('employee_employment_periods', 'employee_id', [employee])
  })

  it('requires continuous coverage and accepts adjacent transfer/rate periods', async () => {
    const { supabase } = setup([
      { employee_id: employee, valid_from: cutover, valid_to: '2026-11-21' },
      { employee_id: employee, valid_from: '2026-11-21', valid_to: null },
      { employee_id: other, valid_from: cutover, valid_to: '2026-11-20' },
      { employee_id: other, valid_from: '2026-11-21', valid_to: null },
    ])
    expect(await getAvailableEmployeeIds(supabase, [employee, other], { startDate: cutover, endDate: '2026-11-30' })).toEqual([employee])
  })

  it('uses the sealed baseline before cutover and joins it with periods', async () => {
    const { supabase } = setup([{ employee_id: employee, valid_from: cutover, valid_to: null }], [employee])
    expect(await getAvailableEmployeeIds(supabase, [employee, other], { startDate: '2026-10-01', endDate: '2026-11-30' })).toEqual([employee])
    expect(await getAvailableEmployeeIds(supabase, [employee, other], { startDate: '2026-10-01', endDate: '2026-10-31' })).toEqual([employee])
  })

  it('does not treat an unregistered new profile as employed', async () => {
    const { supabase } = setup()
    await expect(assertEmploymentAvailable(supabase, [employee], { startDate: cutover, endDate: cutover })).rejects.toThrow('не работает')
  })

  it('checks the session before privileged reading', async () => {
    const { supabase, getUser } = setup()
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(getAvailableEmployeeIds(supabase, [employee], { startDate: cutover, endDate: cutover })).rejects.toThrow('войти')
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it('rejects raw assignment IDs without edit scope before privileged reading', async () => {
    const { supabase } = setup()
    mocks.permissions = []
    await expect(assertEmploymentAvailable(supabase, [employee], { startDate: cutover, endDate: cutover }))
      .rejects.toThrow('Недостаточно прав')
    expect(mocks.admin).not.toHaveBeenCalled()
  })

  it('fails closed on database errors', async () => {
    const { supabase } = setup()
    mocks.admin.mockReturnValue({ from: () => ({ select: () => ({ in: () => Promise.resolve({ data: null, error: { message: 'private failure' } }) }) }) })
    await expect(getAvailableEmployeeIds(supabase, [employee], { startDate: '2026-10-01', endDate: '2026-10-31' })).rejects.toThrow('исходный состав')
  })

  it('preserves edits to the existing assignee but validates a replacement', async () => {
    const { supabase } = setup()
    const single = vi.fn().mockResolvedValue({ data: { loading_responsible: employee,
      loading_start: cutover, loading_finish: '2026-11-30' }, error: null })
    const client = { ...supabase, from: (table: string) => table === 'loadings'
      ? { select: () => ({ eq: () => ({ single }) }) } : supabase.from(table as 'view_users') } as unknown as SupabaseClient<Database>
    await expect(assertEmploymentReassignment(client, 'loading', employee, {})).resolves.toBeUndefined()
    expect(mocks.status).not.toHaveBeenCalled()
    await expect(assertEmploymentReassignment(client, 'loading', other, {})).rejects.toThrow('не работает')
  })
})
