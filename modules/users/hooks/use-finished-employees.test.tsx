import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/modules/cache/keys/query-keys'
import { useFinishedEmployees } from './use-finished-employees'

const mocks = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('../actions/employment-roster', () => ({ getFinishedEmployees: mocks.read }))
let client: QueryClient
function setup(enabled = true) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return renderHook(() => useFinishedEmployees(enabled), { wrapper })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.read.mockResolvedValue({ success: true, data: { enabled: true, today: '2026-11-25', finishedEmployeeIds: ['finished'] } })
})
afterEach(() => { client?.clear(); vi.useRealTimers() })

describe('current employment roster query', () => {
  it('shares the users namespace so personnel invalidation refreshes the hidden roster', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.finishedEmployeeIds).toEqual(['finished'])
    mocks.read.mockResolvedValue({ success: true, data: { enabled: true, today: '2026-11-25', finishedEmployeeIds: ['finished', 'newly-finished'] } })
    await act(async () => { await client.invalidateQueries({ queryKey: queryKeys.users.all }) })
    await waitFor(() => expect(result.current.data?.finishedEmployeeIds).toEqual(['finished', 'newly-finished']))
  })

  it('does not fetch for an unopened board', () => {
    setup(false)
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it('uses a new key after Minsk midnight and does not reuse the previous day roster', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-25T20:59:50Z'))
    const { result } = setup()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(result.current.isSuccess).toBe(true)
    let resolve!: (value: unknown) => void
    mocks.read.mockReturnValue(new Promise(done => { resolve = done }))
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(client.getQueryState(queryKeys.users.finishedEmployees('2026-11-26'))).toBeDefined()
    expect(result.current.data).toBeUndefined()
    expect(result.current.isPending).toBe(true)
    await act(async () => { resolve({ success: true, data: { enabled: true, today: '2026-11-26', finishedEmployeeIds: ['today-ended'] } }); await vi.advanceTimersByTimeAsync(1) })
    expect(result.current.data?.finishedEmployeeIds).toEqual(['today-ended'])
  })
})
