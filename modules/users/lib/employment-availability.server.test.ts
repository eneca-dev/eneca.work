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
  } }),
}))
import { assertEmploymentAvailable, assertEmploymentReassignment, getAvailableEmployeeIds } from './employment-availability.server'

const employee = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const cutover = '2026-11-19'
type Period = { employee_id: string; valid_from: string; valid_to: string | null }

function setup(periods: Period[] = [], baseline: string[] = []) {
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
    from: (table: string) => ({
      select: () => ({ in: (_column: string, ids: string[]) => Promise.resolve({
        data: table === 'view_users' ? ids.map(user_id => ({ user_id, department_id: null, team_id: null })) : [],
        error: null,
      }) }),
    }),
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
