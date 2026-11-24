import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/modules/cache/keys/query-keys'
import { useLoadingMutations, type UseLoadingMutationsOptions } from './useLoadingMutations'
import type { Department } from '@/modules/departments-timeline/types'

const actions = vi.hoisted(() => ({ updateLoading: vi.fn(), createLoading: vi.fn(), splitLoading: vi.fn() }))
vi.mock('@/modules/cache', async () => ({ queryKeys: (await import('@/modules/cache/keys/query-keys')).queryKeys }))
vi.mock('../actions/loadings', () => ({
  ...actions, archiveLoading: vi.fn(), deleteLoading: vi.fn(),
}))

const key = [...queryKeys.departmentsTimeline.lists(), 'prospective-test']
const fixture = [{
  id: 'department', name: 'Отдел', totalEmployees: 1,
  dailyWorkloads: { '2026-10-27': 0.5 },
  teams: [{ id: 'team', name: 'Команда', departmentId: 'department', dailyWorkloads: { '2026-10-27': 0.5 }, employees: [{
    id: 'employee', name: 'Сотрудник', workload: 0.5, dailyWorkloads: { '2026-10-27': 0.5 },
    loadings: [{ id: 'loading', stageId: 'stage', sectionId: 'section', employeeId: 'employee',
      startDate: '2026-10-27', endDate: '2026-10-28', rate: 0.5, comment: 'Работа', isProspective: false }],
  }] }],
}] satisfies Department[]

function setup(options?: UseLoadingMutationsOptions) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  client.setQueryData(key, structuredClone(fixture))
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, ...renderHook(() => useLoadingMutations(options), { wrapper }) }
}

beforeEach(() => vi.clearAllMocks())

describe('server-confirmed scissors', () => {
  it('does not draw two parts while pending and uses server records only after success', async () => {
    let finish!: (value: unknown) => void
    actions.splitLoading.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const onSplitSuccess = vi.fn()
    const { client, result, unmount } = setup({ optimisticSplit: false, onSplitSuccess })
    act(() => result.current.split.mutate({ loadingId: 'loading', splitDate: '2026-10-28' }))
    await waitFor(() => expect(actions.splitLoading).toHaveBeenCalledOnce())
    expect(result.current.split.isPending).toBe(true)
    expect(client.getQueryData(key)).toEqual(fixture)
    expect(onSplitSuccess).not.toHaveBeenCalled()
    await act(async () => finish({ success: true, data: {
      original: { id: 'loading', startDate: '2026-10-27', endDate: '2026-10-27' },
      created: { id: 'persisted-new-id', startDate: '2026-10-28', endDate: '2026-10-28' },
    } }))
    await waitFor(() => expect(result.current.split.isSuccess).toBe(true))
    const loadings = client.getQueryData<Department[]>(key)![0].teams[0].employees[0].loadings!
    expect(loadings.map(({ id, startDate, endDate }) => ({ id, startDate, endDate }))).toEqual([
      { id: 'loading', startDate: '2026-10-27', endDate: '2026-10-27' },
      { id: 'persisted-new-id', startDate: '2026-10-28', endDate: '2026-10-28' },
    ])
    expect(onSplitSuccess).toHaveBeenCalledOnce()
    expect(client.getQueryState(key)?.isInvalidated).toBe(true)
    unmount(); client.clear()
  })

  it('keeps the original intact and reports a failed save', async () => {
    actions.splitLoading.mockResolvedValue({ success: false, error: 'Save rejected' })
    const onError = vi.fn()
    const onSplitSuccess = vi.fn()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client, result, unmount } = setup({ optimisticSplit: false, onError, onSplitSuccess })
    act(() => result.current.split.mutate({ loadingId: 'loading', splitDate: '2026-10-28' }))
    await waitFor(() => expect(result.current.split.isError).toBe(true))
    expect(client.getQueryData(key)).toEqual(fixture)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Save rejected' }))
    expect(onSplitSuccess).not.toHaveBeenCalled()
    unmount(); client.clear(); log.mockRestore()
  })
})

describe('prospective loading optimistic update', () => {
  it('changes only the marker and rolls back on failure', async () => {
    let finish!: (value: { success: false; error: string }) => void
    actions.updateLoading.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client, result, unmount } = setup()
    act(() => result.current.update.mutate({ loadingId: 'loading', isProspective: true }))
    await waitFor(() => expect(actions.updateLoading).toHaveBeenCalledOnce())
    const expected = structuredClone(fixture)
    const data = client.getQueryData<Department[]>(key)!
    expect(data[0].teams[0].employees[0].loadings![0]).toMatchObject({ ...expected[0].teams[0].employees[0].loadings[0], isProspective: true })
    expect(data[0].dailyWorkloads).toEqual(fixture[0].dailyWorkloads)
    expect(data[0].teams[0].dailyWorkloads).toEqual(fixture[0].teams[0].dailyWorkloads)
    expect(data[0].teams[0].employees[0].dailyWorkloads).toEqual(fixture[0].teams[0].employees[0].dailyWorkloads)
    await act(async () => finish({ success: false, error: 'Нет доступа' }))
    await waitFor(() => expect(result.current.update.isError).toBe(true))
    expect(client.getQueryData(key)).toEqual(fixture)
    unmount(); client.clear(); log.mockRestore()
  })

  it('optimistically removes a marker and invalidates for authoritative reload', async () => {
    actions.updateLoading.mockResolvedValue({ success: true, data: { id: 'loading', isProspective: false } })
    const { client, result, unmount } = setup()
    const marked = structuredClone(fixture) as Department[]
    marked[0].teams[0].employees[0].loadings![0].isProspective = true
    client.setQueryData(key, marked)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await act(async () => { await result.current.update.mutateAsync({ loadingId: 'loading', isProspective: false }) })
    expect(client.getQueryData<Department[]>(key)![0].teams[0].employees[0].loadings![0].isProspective).toBe(false)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.departmentsTimeline.lists() })
    unmount(); client.clear()
  })
})
