// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), finish: vi.fn(), captureException: vi.fn() }))
vi.mock('@/utils/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('../lib/employment-client', () => ({ finishEmployment: mocks.finish }))
vi.mock('@sentry/nextjs', () => ({
  startSpan: (_options: unknown, callback: () => unknown) => callback(),
  captureException: mocks.captureException,
}))
import { finishEmployeeEmployment } from './employment'

const actorId = '00000000-0000-4000-8000-000000000001'
const employeeId = '00000000-0000-4000-8000-000000000002'
describe('finish employee action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: actorId } }, error: null }) } })
    mocks.finish.mockResolvedValue(undefined)
  })

  it('validates before opening a client', async () => {
    expect((await finishEmployeeEmployment('invalid')).success).toBe(false)
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('rejects self completion without mutation', async () => {
    expect((await finishEmployeeEmployment(actorId)).success).toBe(false)
    expect(mocks.finish).not.toHaveBeenCalled()
  })

  it('uses the authenticated RPC and reports successful completion', async () => {
    expect(await finishEmployeeEmployment(employeeId)).toEqual({ success: true, data: { employeeId } })
    expect(mocks.finish).toHaveBeenCalledWith(await mocks.createClient.mock.results[0].value, employeeId)
  })

  it('returns a safe error and records failures without pretending success', async () => {
    mocks.finish.mockRejectedValue(new Error('No permission to finish employment'))
    const result = await finishEmployeeEmployment(employeeId)
    expect(result.success).toBe(false)
    expect(mocks.captureException).toHaveBeenCalledOnce()
  })

  it('rejects missing authentication', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } })
    expect((await finishEmployeeEmployment(employeeId)).success).toBe(false)
    expect(mocks.finish).not.toHaveBeenCalled()
  })
})
