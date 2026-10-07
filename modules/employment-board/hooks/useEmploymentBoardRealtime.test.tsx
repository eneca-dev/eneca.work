import { createElement, createRef, type PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionResult } from '@/modules/cache/types'
import type { EmploymentBoard } from '../types'
import { emitEmploymentBoardLoadingChange, type LoadingRealtimePayload } from '../lib/realtime-events'
import {
  dispatchRealtimeChange,
  removeInactiveEmploymentBoardSnapshots,
} from '@/modules/cache/realtime/dispatch-change'
import { queryKeys } from '@/modules/cache/keys/query-keys'

const mocks = vi.hoisted(() => ({
  getBoard: vi.fn(),
  placeEmployee: vi.fn(),
  localCallbacks: [] as Array<() => void>,
  removeChannel: vi.fn(),
}))

vi.mock('../actions', () => ({
  getDepartmentEmploymentBoard: mocks.getBoard,
  placeEmployee: mocks.placeEmployee,
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/utils/supabase/client', () => ({
  createClient: () => {
    const channel = {
      on: vi.fn((_kind, _config, callback: () => void) => {
        mocks.localCallbacks.push(callback)
        return channel
      }),
      subscribe: vi.fn(() => channel),
    }
    return { channel: vi.fn(() => channel), removeChannel: mocks.removeChannel }
  },
}))

import { useEmploymentBoardRealtime } from './useEmploymentBoardRealtime'
import { usePlaceEmployee } from './useEmploymentBoard'

function board(): EmploymentBoard {
  return {
    selectedDate: '2026-10-07',
    dateMode: 'today',
    departmentId: 'department',
    departmentName: 'Отдел',
    projects: [],
    employees: [],
    unassignedEmployeeIds: [],
  }
}

function loadingPayload(
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  row: Record<string, unknown> = {},
): LoadingRealtimePayload {
  return { eventType, new: row, old: {}, schema: 'public', table: 'loadings', commit_timestamp: '' } as LoadingRealtimePayload
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => { resolve = promiseResolve })
  return { promise, resolve }
}

describe('useEmploymentBoardRealtime', () => {
  let queryClient: QueryClient
  const onRequireFresh = vi.fn()
  const onMarkDateChangeStale = vi.fn()
  const onDateBoundary = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-10-07T09:00:00+03:00'))
    mocks.localCallbacks.length = 0
    mocks.getBoard.mockReset()
    mocks.removeChannel.mockReset()
    onRequireFresh.mockReset()
    onMarkDateChangeStale.mockReset()
    onDateBoundary.mockReset()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mocks.getBoard.mockResolvedValue({ success: true, data: board() })
  })

  afterEach(() => {
    queryClient.clear()
    vi.useRealTimers()
  })

  function renderRealtime() {
    const epochRef = createRef<number>()
    epochRef.current = 0
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    return renderHook(() => useEmploymentBoardRealtime({
      departmentId: 'department',
      selectedDate: '2026-10-07',
      dateMode: 'today',
      requestEpochRef: epochRef as { current: number },
      onRequireFresh,
      onMarkDateChangeStale,
      onDateBoundary,
      pendingMutationsRef: { current: 0 },
    }), { wrapper })
  }

  it('uses one fresh controller and cancels fallback when local Realtime confirms the mutation', async () => {
    const realtime = renderRealtime()
    expect(mocks.localCallbacks).toHaveLength(2)

    act(() => {
      mocks.localCallbacks[0]()
      realtime.result.current.scheduleFallbackRefresh()
      vi.advanceTimersByTime(150)
    })
    await waitFor(() => expect(mocks.getBoard).toHaveBeenCalledTimes(1))
    expect(mocks.getBoard).toHaveBeenCalledWith({
      filters: undefined,
      selectedDate: '2026-10-07',
      cachePolicy: 'fresh',
    })

    act(() => vi.advanceTimersByTime(2_100))
    expect(mocks.getBoard).toHaveBeenCalledTimes(1)
  })

  it('routes the two-second fallback through the same fresh controller', async () => {
    const realtime = renderRealtime()
    act(() => {
      realtime.result.current.scheduleFallbackRefresh()
      vi.advanceTimersByTime(2_150)
    })
    await waitFor(() => expect(mocks.getBoard).toHaveBeenCalledTimes(1))
    expect(onRequireFresh).toHaveBeenCalledTimes(1)
  })

  it('cancels an already scheduled fallback when local Realtime arrives', async () => {
    const realtime = renderRealtime()
    act(() => {
      realtime.result.current.scheduleFallbackRefresh()
      mocks.localCallbacks[0]()
      vi.advanceTimersByTime(150)
    })
    await waitFor(() => expect(mocks.getBoard).toHaveBeenCalledTimes(1))

    act(() => vi.advanceTimersByTime(2_100))
    expect(mocks.getBoard).toHaveBeenCalledTimes(1)
  })

  it('preserves presence, search and other modules while removing inactive board snapshots', () => {
    renderRealtime()
    const snapshotKey = ['employment-board', 'list', null, '2026-10-08', 'dated']
    const presenceKey = ['employment-board', 'presence', 'department']
    const searchKey = ['employment-board', 'search', 'Проект']
    const otherKey = ['loadings', 'list']
    queryClient.setQueryData(snapshotKey, board())
    queryClient.setQueryData(presenceKey, ['user'])
    queryClient.setQueryData(searchKey, [])
    queryClient.setQueryData(otherKey, ['loading'])

    act(() => emitEmploymentBoardLoadingChange(loadingPayload('UPDATE')))

    expect(queryClient.getQueryData(snapshotKey)).toBeUndefined()
    expect(queryClient.getQueryData(presenceKey)).toEqual(['user'])
    expect(queryClient.getQueryData(searchKey)).toEqual([])
    expect(queryClient.getQueryData(otherKey)).toEqual(['loading'])
  })

  it('marks an irrelevant INSERT for a future fresh date change without refreshing the active date', () => {
    renderRealtime()
    act(() => emitEmploymentBoardLoadingChange(loadingPayload('INSERT', {
      loading_status: 'active',
      is_shortage: false,
      loading_start: '2026-10-08',
      loading_finish: '2026-10-08',
    })))
    act(() => vi.advanceTimersByTime(500))

    expect(onMarkDateChangeStale).toHaveBeenCalledTimes(1)
    expect(onRequireFresh).not.toHaveBeenCalled()
    expect(mocks.getBoard).not.toHaveBeenCalled()
  })

  it.each(['success', 'error'] as const)(
    'does not let a pre-mutation fresh response replace optimistic data during a mutation (%s)',
    async (outcome) => {
      const queryKey = queryKeys.employmentBoard.list(undefined, '2026-10-07', 'today')
      const initial = {
        ...board(),
        employees: [{ id: 'employee', name: 'Employee', avatarUrl: null, positionName: null, teamName: null }],
        unassignedEmployeeIds: ['employee'],
        projects: [{ id: 'project', name: 'Project', isPinned: true, employees: [] }],
      } satisfies EmploymentBoard
      queryClient.setQueryData(queryKey, initial)
      const firstFresh = deferred<ActionResult<EmploymentBoard>>()
      const mutationResponse = deferred<ActionResult<null>>()
      const confirmed = { ...initial, departmentName: 'Confirmed' }
      mocks.getBoard.mockReturnValueOnce(firstFresh.promise).mockResolvedValue({ success: true, data: confirmed })
      mocks.placeEmployee.mockReturnValueOnce(mutationResponse.promise)

      const epochRef = createRef<number>()
      epochRef.current = 0
      const pendingMutationsRef = { current: 0 }
      const wrapper = ({ children }: PropsWithChildren) =>
        createElement(QueryClientProvider, { client: queryClient }, children)
      const { result } = renderHook(() => {
        const realtime = useEmploymentBoardRealtime({
          departmentId: 'department',
          selectedDate: '2026-10-07',
          dateMode: 'today',
          requestEpochRef: epochRef as { current: number },
          pendingMutationsRef,
          onRequireFresh,
          onMarkDateChangeStale,
          onDateBoundary,
        })
        const mutation = usePlaceEmployee({
          onMutationStart: realtime.beginMutation,
          onMutationSettled: realtime.finishMutation,
        })
        return { mutation }
      }, { wrapper })

      act(() => {
        mocks.localCallbacks[0]()
        vi.advanceTimersByTime(150)
      })
      await waitFor(() => expect(mocks.getBoard).toHaveBeenCalledTimes(1))

      act(() => result.current.mutation.mutate({
        departmentId: 'department',
        projectId: 'project',
        employeeId: 'employee',
        selectedDate: '2026-10-07',
      }))
      await waitFor(() => expect(
        queryClient.getQueryData<EmploymentBoard>(queryKey)?.projects[0].employees,
      ).toHaveLength(1))

      await act(async () => {
        firstFresh.resolve({ success: true, data: initial })
        await firstFresh.promise
      })
      expect(queryClient.getQueryData<EmploymentBoard>(queryKey)?.projects[0].employees)
        .toMatchObject([{ id: 'employee', source: 'manual', isPending: true }])

      await act(async () => {
        mutationResponse.resolve(outcome === 'success'
          ? { success: true, data: null }
          : { success: false, error: 'placement failed' })
        await mutationResponse.promise
      })
      await waitFor(() => expect(mocks.getBoard).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(
        queryClient.getQueryData<EmploymentBoard>(queryKey)?.departmentName,
      ).toBe('Confirmed'))
      expect(mocks.getBoard).toHaveBeenCalledTimes(2)
    },
  )

  it('refreshes UPDATE and incomplete payloads conservatively', async () => {
    renderRealtime()
    act(() => {
      emitEmploymentBoardLoadingChange(loadingPayload('UPDATE'))
      emitEmploymentBoardLoadingChange(loadingPayload('INSERT', { loading_status: 'active' }))
      emitEmploymentBoardLoadingChange(loadingPayload('INSERT', {
        loading_status: 'active',
        is_shortage: false,
        loading_start: '2026-10-07',
        loading_finish: '2026-10-07',
        department_id: 'another-department',
      }))
      vi.advanceTimersByTime(150)
    })
    await waitFor(() => expect(mocks.getBoard).toHaveBeenCalledTimes(1))
  })

  it('connects global loadings Realtime to fresh while preserving other module invalidations', async () => {
    renderRealtime()
    const scheduleInvalidation = vi.fn()
    act(() => {
      dispatchRealtimeChange({
        table: 'loadings',
        invalidateKeys: [
          queryKeys.loadings.all,
          queryKeys.employmentBoard.all,
          queryKeys.resourceGraph.all,
        ],
      }, loadingPayload('UPDATE'), scheduleInvalidation, () => {
        removeInactiveEmploymentBoardSnapshots(queryClient)
      })
      vi.advanceTimersByTime(150)
    })

    await waitFor(() => expect(mocks.getBoard).toHaveBeenCalledTimes(1))
    expect(scheduleInvalidation).toHaveBeenCalledWith([
      queryKeys.loadings.all,
      queryKeys.resourceGraph.all,
    ])
  })

  it('removes inactive board snapshots on loadings events even when the board is unmounted', () => {
    const snapshotKey = queryKeys.employmentBoard.list(undefined, '2026-10-08', 'dated')
    const presenceKey = ['employment-board', 'presence', 'department']
    const searchKey = ['employment-board', 'search', 'project']
    queryClient.setQueryData(snapshotKey, board())
    queryClient.setQueryData(presenceKey, ['viewer'])
    queryClient.setQueryData(searchKey, [{ id: 'project', name: 'Project' }])
    const scheduleInvalidation = vi.fn()

    dispatchRealtimeChange({
      table: 'loadings',
      invalidateKeys: [queryKeys.loadings.all, queryKeys.employmentBoard.all],
    }, loadingPayload('UPDATE'), scheduleInvalidation, () => {
      removeInactiveEmploymentBoardSnapshots(queryClient)
    })

    expect(queryClient.getQueryData(snapshotKey)).toBeUndefined()
    expect(queryClient.getQueryData(presenceKey)).toEqual(['viewer'])
    expect(queryClient.getQueryData(searchKey)).toEqual([{ id: 'project', name: 'Project' }])
    expect(scheduleInvalidation).toHaveBeenCalledWith([queryKeys.loadings.all])
  })

  it('allows one in-flight fresh request and at most one trailing refresh', async () => {
    const first = deferred<{ success: true; data: EmploymentBoard }>()
    mocks.getBoard
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue({ success: true, data: board() })
    renderRealtime()

    act(() => {
      emitEmploymentBoardLoadingChange(loadingPayload('UPDATE'))
      vi.advanceTimersByTime(150)
    })
    await waitFor(() => expect(mocks.getBoard).toHaveBeenCalledTimes(1))

    act(() => {
      emitEmploymentBoardLoadingChange(loadingPayload('UPDATE'))
      emitEmploymentBoardLoadingChange(loadingPayload('DELETE'))
      emitEmploymentBoardLoadingChange(loadingPayload('INSERT', { loading_status: 'active' }))
      vi.advanceTimersByTime(150)
    })
    expect(mocks.getBoard).toHaveBeenCalledTimes(1)

    await act(async () => {
      first.resolve({ success: true, data: board() })
      await first.promise
    })
    await waitFor(() => expect(mocks.getBoard).toHaveBeenCalledTimes(2))
    act(() => vi.advanceTimersByTime(500))
    expect(mocks.getBoard).toHaveBeenCalledTimes(2)
  })
})
