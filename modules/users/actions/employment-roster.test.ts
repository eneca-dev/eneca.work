// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(), getUser: vi.fn(),
  status: vi.fn(), captureException: vi.fn(),
}))
vi.mock('@/utils/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('../lib/employment-client', () => ({ getEmploymentStatus: mocks.status }))
vi.mock('@sentry/nextjs', () => ({
  startSpan: (_options: unknown, run: () => unknown) => run(), captureException: mocks.captureException,
}))

import { getFinishedEmployees } from './employment-roster'

type Period = { employee_id: string; valid_from: string; valid_to: string | null }
type QueryCall = { client: 'session' | 'admin'; table: string; ids: string[]; from: number }
const id = (index: number) => `50000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const today = '2026-11-25'
let visibleIds: (string | null)[]
let periods: Period[]
let calls: QueryCall[]
let failBatchId: string | undefined
let failSession: boolean
let leakOutsideScope: boolean

function query(client: QueryCall['client'], table: string) {
  let ids: string[] = []
  const builder = {
    select: () => builder,
    order: () => builder,
    in: (_column: string, batch: string[]) => { ids = batch; return builder },
    range: async (from: number, to: number) => {
      calls.push({ client, table, ids: [...ids], from })
      if ((client === 'session' && failSession)
        || (client === 'admin' && failBatchId && ids.includes(failBatchId))) {
        return { data: null, error: { message: 'private database failure' } }
      }
      if (client === 'session') {
        return { data: visibleIds.map(user_id => ({ user_id })).slice(from, to + 1), error: null }
      }
      if (ids.length > 100) return { data: null, error: { message: 'Headers overflow' } }
      const rows = periods.filter(row => ids.includes(row.employee_id))
        .sort((a, b) => a.employee_id.localeCompare(b.employee_id) || a.valid_from.localeCompare(b.valid_from))
      if (leakOutsideScope) rows.push({ employee_id: id(999999), valid_from: '2026-11-01', valid_to: today })
      return { data: rows.slice(from, to + 1), error: null }
    },
  }
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  visibleIds = [id(1)]
  periods = []
  calls = []
  failBatchId = undefined
  failSession = false
  leakOutsideScope = false
  mocks.getUser.mockResolvedValue({ data: { user: { id: id(10) } }, error: null })
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from: (table: string) => query('session', table) })
  mocks.createAdminClient.mockImplementation(() => ({ from: (table: string) => query('admin', table) }))
  mocks.status.mockResolvedValue({ enabled: true, today, cutoverDate: '2026-11-24' })
})

describe('finished employees roster', () => {
  it('requires authentication before status or privileged reading', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await getFinishedEmployees()).toEqual({ success: false, error: 'Необходимо войти в систему' })
    expect(mocks.status).not.toHaveBeenCalled()
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
    expect(calls).toEqual([])
  })

  it('keeps legacy behavior when employment history is disabled', async () => {
    mocks.status.mockResolvedValue({ enabled: false, today, cutoverDate: null })
    expect(await getFinishedEmployees()).toEqual({ success: true, data: { today, enabled: false, finishedEmployeeIds: [], finishedOnByEmployeeId: {} } })
    expect(calls).toEqual([])
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('keeps unknown employees visible and treats valid_to as the first non-working day', async () => {
    visibleIds = [id(1), id(2), id(3), id(4), null]
    periods = [
      { employee_id: id(1), valid_from: '2026-11-24', valid_to: today },
      { employee_id: id(2), valid_from: '2026-11-24', valid_to: '2026-11-26' },
      { employee_id: id(3), valid_from: '2026-11-24', valid_to: null },
    ]
    expect(await getFinishedEmployees()).toEqual({ success: true, data: { today, enabled: true,
      finishedEmployeeIds: [id(1)], finishedOnByEmployeeId: { [id(1)]: '2026-11-24' } } })
  })

  it('returns the inclusive last working day across a month boundary', async () => {
    mocks.status.mockResolvedValue({ enabled: true, today: '2026-12-02', cutoverDate: '2026-11-24' })
    periods = [{ employee_id: id(1), valid_from: '2026-11-24', valid_to: '2026-12-01' }]
    expect(await getFinishedEmployees()).toMatchObject({ success: true, data: {
      finishedOnByEmployeeId: { [id(1)]: '2026-11-30' },
    } })
  })

  it('does not classify a transfer or rate change as finishing when a later open period exists', async () => {
    periods = [
      { employee_id: id(1), valid_from: '2026-11-01', valid_to: '2026-11-24' },
      { employee_id: id(1), valid_from: '2026-11-24', valid_to: null },
    ]
    expect(await getFinishedEmployees()).toMatchObject({ success: true, data: { finishedEmployeeIds: [] } })
  })

  it('reads all 596 authorized employees in bounded ID lists and never reads outsiders', async () => {
    visibleIds = Array.from({ length: 596 }, (_, index) => id(index + 1))
    periods = [...visibleIds.map(employee_id => ({ employee_id: employee_id!, valid_from: '2026-11-24', valid_to: today })),
      { employee_id: id(9999), valid_from: '2026-11-24', valid_to: today }]
    expect(await getFinishedEmployees()).toMatchObject({ success: true, data: { finishedEmployeeIds: visibleIds } })
    const batches = calls.filter(call => call.client === 'admin').map(call => call.ids)
    expect(batches.map(batch => batch.length)).toEqual([100, 100, 100, 100, 100, 96])
    expect(batches.flat()).toEqual(visibleIds)
    expect(calls.filter(call => call.client === 'admin').every(call => call.table === 'employee_employment_periods')).toBe(true)
  })

  it('reads identities past the first API page', async () => {
    visibleIds = Array.from({ length: 1001 }, (_, index) => id(index + 1))
    periods = [{ employee_id: id(1001), valid_from: '2026-11-24', valid_to: today }]
    expect(await getFinishedEmployees()).toMatchObject({ success: true, data: { finishedEmployeeIds: [id(1001)] } })
    expect(calls.filter(call => call.client === 'session').map(call => call.from)).toEqual([0, 1000])
  })

  it('finds the latest open period beyond the first 1000 history rows', async () => {
    function day(offset: number) {
      const date = new Date('2020-01-01T00:00:00Z')
      date.setUTCDate(date.getUTCDate() + offset)
      return date.toISOString().slice(0, 10)
    }
    periods = Array.from({ length: 1001 }, (_, index) => ({ employee_id: id(1), valid_from: day(index), valid_to: day(index + 1) }))
    periods.push({ employee_id: id(1), valid_from: day(1001), valid_to: null })
    expect(await getFinishedEmployees()).toMatchObject({ success: true, data: { finishedEmployeeIds: [] } })
    expect(calls.filter(call => call.client === 'admin').map(call => call.from)).toEqual([0, 1000])
  })

  it('does not open a privileged client for an empty visible roster', async () => {
    visibleIds = []
    expect(await getFinishedEmployees()).toMatchObject({ success: true, data: { finishedEmployeeIds: [] } })
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('fails without returning a partial roster if a later employee batch fails', async () => {
    visibleIds = Array.from({ length: 101 }, (_, index) => id(index + 1))
    periods = [{ employee_id: id(1), valid_from: '2026-11-24', valid_to: today }]
    failBatchId = id(101)
    const result = await getFinishedEmployees()
    expect(result.success).toBe(false)
    expect(JSON.stringify(result)).not.toContain('private database failure')
    expect(result).not.toHaveProperty('data')
    expect(mocks.captureException).toHaveBeenCalledOnce()
  })

  it('fails before reading history if the session-visible roster is unavailable', async () => {
    failSession = true
    expect((await getFinishedEmployees()).success).toBe(false)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('rejects malformed history and unexpected out-of-scope rows without leaking identities', async () => {
    periods = [{ employee_id: id(1), valid_from: '2026-02-30', valid_to: today }]
    expect((await getFinishedEmployees()).success).toBe(false)
    periods = []
    leakOutsideScope = true
    const result = await getFinishedEmployees()
    expect(result.success).toBe(false)
    expect(JSON.stringify(result)).not.toContain(id(999999))
  })
})
