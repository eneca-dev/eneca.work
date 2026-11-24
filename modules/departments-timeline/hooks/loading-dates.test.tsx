import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { ActionResult } from '@/modules/cache/types'
import type { Department } from '../types'

const mocks = vi.hoisted(() => ({ updateLoadingDates: vi.fn() }))
vi.mock('../actions', () => ({
  updateLoadingDates: mocks.updateLoadingDates,
  getDepartmentsData: vi.fn(), getTeamsFreshness: vi.fn(),
  confirmTeamActivity: vi.fn(), confirmMultipleTeamsActivity: vi.fn(), bulkShiftLoadings: vi.fn(),
}))
vi.mock('@/modules/cache', async () => ({
  ...(await import('@/modules/cache/hooks/use-cache-query')),
  ...(await import('@/modules/cache/hooks/use-cache-mutation')),
  ...(await import('@/modules/cache/keys/query-keys')),
}))
vi.mock('@/modules/resource-graph/hooks', () => ({ useCompanyCalendarEvents: vi.fn() }))

import { useUpdateLoadingDates } from './index'
import { queryKeys } from '@/modules/cache/keys/query-keys'

type SaveResult = ActionResult<{ loadingId: string; startDate: string; finishDate: string }>
function deferred() {
  let resolve!: (value: SaveResult) => void
  const promise = new Promise<SaveResult>(done => { resolve = done })
  return { promise, resolve }
}
const day1 = '2026-11-24'
const day2 = '2026-11-25'
const day3 = '2026-11-26'
const input = { loadingId: 'loading', employeeId: 'employee', startDate: day1, finishDate: day3 }
const key = queryKeys.departmentsTimeline.list({}, { startDate: day1, endDate: day3, today: day1 })

function snapshot(): Department[] {
  const dailyCapacity = { [day1]: 1, [day2]: 1, [day3]: 1 }
  const dailyWorkloads = { [day1]: 1, [day2]: 1 }
  return [{ id: 'department', name: 'Test', totalEmployees: 1, dailyCapacity, dailyWorkloads,
    teams: [{ id: 'team', name: 'Test team', departmentId: 'department', dailyCapacity, dailyWorkloads,
      employees: [{ id: 'employee', name: 'Test employee', workload: 1, employmentRate: 1,
        departmentId: 'department', teamId: 'team', dailyCapacity, dailyWorkloads,
        employmentSegments: [{ employeeId: 'employee', departmentId: 'department', teamId: 'team',
          startDate: day1, endDate: day3, employmentRate: 1 }],
        employmentConflicts: [],
        loadings: [{ id: 'loading', sectionId: 'section', stageId: 'stage',
          startDate: day1, endDate: day2, rate: 1 }],
      }],
    }],
  }]
}

const clients: QueryClient[] = []
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  const original = snapshot()
  const freshness = { team: { confirmedAt: 'unchanged' } }
  client.setQueryData(key, original)
  client.setQueryData(queryKeys.departmentsTimeline.freshness(), freshness)
  const wrapper = ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, original, freshness, ...renderHook(() => useUpdateLoadingDates(), { wrapper }) }
}
afterEach(() => { clients.splice(0).forEach(client => client.clear()); vi.clearAllMocks() })

describe('loading resize optimistic cache lifecycle', () => {
  it('updates the historical bar and dated totals before save resolves, retaining them on success', async () => {
    const save = deferred()
    mocks.updateLoadingDates.mockReturnValue(save.promise)
    const { client, result, freshness } = setup()
    act(() => result.current.mutate(input))
    await waitFor(() => expect(mocks.updateLoadingDates).toHaveBeenCalledWith('loading', day1, day3))
    expect(result.current.isPending).toBe(true)
    const pending = client.getQueryData<Department[]>(key)!
    const team = pending[0].teams[0]
    expect(team.employees[0].loadings?.[0].endDate).toBe(day3)
    expect(team.employees[0].dailyWorkloads?.[day3]).toBe(1)
    expect(team.dailyWorkloads?.[day3]).toBe(1)
    expect(pending[0].dailyWorkloads?.[day3]).toBe(1)
    expect(pending[0].dailyCapacity?.[day3]).toBe(1)
    expect(client.getQueryData(queryKeys.departmentsTimeline.freshness())).toEqual(freshness)
    await act(async () => { save.resolve({ success: true, data: input }) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(client.getQueryData<Department[]>(key)?.[0].teams[0].employees[0].loadings?.[0].endDate).toBe(day3)
    expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  })

  it('restores the original historical bar and all totals if the save fails', async () => {
    const save = deferred()
    mocks.updateLoadingDates.mockReturnValue(save.promise)
    const { client, original, result } = setup()
    act(() => result.current.mutate(input))
    await waitFor(() => expect(client.getQueryData<Department[]>(key)?.[0].dailyWorkloads?.[day3]).toBe(1))
    await act(async () => { save.resolve({ success: false, error: 'Save rejected' }) })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Save rejected')
    expect(client.getQueryData(key)).toEqual(original)
    expect(client.getQueryData<Department[]>(key)?.[0].dailyWorkloads?.[day3]).toBeUndefined()
  })
})
