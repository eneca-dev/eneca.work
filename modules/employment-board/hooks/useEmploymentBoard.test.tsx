import { createElement, createRef, type PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionResult } from '@/modules/cache/types'
import type { EmploymentBoard } from '../types'
import { useEmploymentBoardDate } from './useEmploymentBoardDate'

const actionMocks = vi.hoisted(() => ({
  getDepartmentEmploymentBoard: vi.fn(),
  placeEmployee: vi.fn(),
  removePlacement: vi.fn(),
}))

vi.mock('../actions', () => ({
  getDepartmentEmploymentBoard: actionMocks.getDepartmentEmploymentBoard,
  pinProject: vi.fn(),
  placeEmployee: actionMocks.placeEmployee,
  reportBoardPresence: vi.fn(),
  removePlacement: actionMocks.removePlacement,
  searchBoardProjects: vi.fn(),
  unpinProject: vi.fn(),
}))

import { useEmploymentBoard, usePlaceEmployee, useRemovePlacement } from './useEmploymentBoard'

function board(selectedDate: string, dateMode: 'today' | 'dated'): EmploymentBoard {
  return {
    selectedDate,
    dateMode,
    departmentId: 'department',
    departmentName: 'Отдел',
    projects: [],
    employees: [],
    unassignedEmployeeIds: [],
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

describe('useEmploymentBoard date boundary', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-10-07T20:59:59.000Z'))
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    queryClient.clear()
    actionMocks.getDepartmentEmploymentBoard.mockReset()
    actionMocks.placeEmployee.mockReset()
    actionMocks.removePlacement.mockReset()
    vi.useRealTimers()
  })

  it('moves to a new key without retrying or exposing the old-key boundary error', async () => {
    const firstResponse = deferred<ActionResult<EmploymentBoard>>()
    actionMocks.getDepartmentEmploymentBoard
      .mockReturnValueOnce(firstResponse.promise)
      .mockResolvedValueOnce({ success: true, data: board('2026-10-08', 'today') })

    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const { result } = renderHook(() => {
      const date = useEmploymentBoardDate()
      const query = useEmploymentBoard({
        selectedDate: date.selectedDate,
        expectedDateMode: date.mode,
        onDateBoundary: date.refreshCurrentMinskDate,
      })
      return { date, query }
    }, { wrapper })

    await waitFor(() => expect(actionMocks.getDepartmentEmploymentBoard).toHaveBeenCalledTimes(1))
    vi.setSystemTime(new Date('2026-10-07T21:00:01.000Z'))

    await act(async () => {
      firstResponse.resolve({ success: true, data: board('2026-10-07', 'today') })
      await firstResponse.promise
    })

    await waitFor(() => expect(actionMocks.getDepartmentEmploymentBoard).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.query.data?.selectedDate).toBe('2026-10-08'))

    expect(result.current.query.error).toBeNull()
    expect(result.current.date.selectedDate).toBe('2026-10-08')
    expect(actionMocks.getDepartmentEmploymentBoard.mock.calls).toEqual([
      [{ filters: undefined, selectedDate: '2026-10-07', cachePolicy: 'cache-aside' }],
      [{ filters: undefined, selectedDate: '2026-10-08', cachePolicy: 'cache-aside' }],
    ])
  })

  it('does not let an ordinary request started before Realtime overwrite fresh data', async () => {
    const ordinary = deferred<ActionResult<EmploymentBoard>>()
    actionMocks.getDepartmentEmploymentBoard.mockReturnValueOnce(ordinary.promise)
    const epochRef = createRef<number>()
    epochRef.current = 0
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const queryKey = ['employment-board', 'list', null, '2026-10-07', 'today']
    const fresh = { ...board('2026-10-07', 'today'), departmentName: 'Свежий отдел' }
    const { result } = renderHook(() => useEmploymentBoard({
      selectedDate: '2026-10-07',
      expectedDateMode: 'today',
      requestEpochRef: epochRef as { current: number },
      onDateBoundary: vi.fn(),
    }), { wrapper })

    await waitFor(() => expect(actionMocks.getDepartmentEmploymentBoard).toHaveBeenCalledTimes(1))
    epochRef.current += 1
    queryClient.setQueryData(queryKey, fresh)
    ordinary.resolve({ success: true, data: { ...fresh, departmentName: 'Старый отдел' } })

    await waitFor(() => expect(result.current.isFetching).toBe(false))
    expect(result.current.error).toBeNull()
    expect(queryClient.getQueryData<EmploymentBoard>(queryKey)?.departmentName).toBe('Свежий отдел')
  })

  it('optimistically places and removes employees only in today snapshots', async () => {
    const today = board('2026-10-07', 'today')
    const dated = board('2026-10-08', 'dated')
    const employee = {
      id: 'employee',
      name: 'Сотрудник',
      avatarUrl: null,
      positionName: null,
      teamName: null,
    }
    const project = { id: 'project', name: 'Проект', isPinned: true, employees: [] }
    today.employees = [employee]
    today.projects = [project]
    today.unassignedEmployeeIds = [employee.id]
    dated.employees = [employee]
    dated.projects = [{ ...project, employees: [] }]
    dated.unassignedEmployeeIds = [employee.id]

    const todayKey = ['employment-board', 'list', null, '2026-10-07', 'today']
    const datedKey = ['employment-board', 'list', null, '2026-10-08', 'dated']
    queryClient.setQueryData(todayKey, today)
    queryClient.setQueryData(datedKey, dated)
    actionMocks.placeEmployee.mockResolvedValue({ success: true, data: null })
    actionMocks.removePlacement.mockResolvedValue({ success: true, data: null })
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const place = renderHook(() => usePlaceEmployee(), { wrapper })

    await act(async () => {
      await place.result.current.mutateAsync({
        departmentId: 'department',
        projectId: project.id,
        employeeId: employee.id,
        selectedDate: '2026-10-07',
      })
    })

    expect(queryClient.getQueryData<EmploymentBoard>(todayKey)).toMatchObject({
      selectedDate: '2026-10-07',
      dateMode: 'today',
      projects: [{ employees: [{ id: employee.id, source: 'manual', isPending: false }] }],
    })
    expect(queryClient.getQueryData<EmploymentBoard>(datedKey)).toEqual(dated)

    const remove = renderHook(() => useRemovePlacement(), { wrapper })
    await act(async () => {
      await remove.result.current.mutateAsync({
        departmentId: 'department',
        projectId: project.id,
        employeeId: employee.id,
        selectedDate: '2026-10-07',
      })
    })

    expect(queryClient.getQueryData<EmploymentBoard>(todayKey)?.projects[0].employees).toEqual([])
    expect(queryClient.getQueryData<EmploymentBoard>(datedKey)).toEqual(dated)
  })

  it('does not recreate a snapshot removed by Realtime during mutation rollback', async () => {
    const snapshot = board('2026-10-07', 'today')
    const employee = { id: 'employee', name: 'Сотрудник', avatarUrl: null, positionName: null, teamName: null }
    snapshot.employees = [employee]
    snapshot.projects = [{ id: 'project', name: 'Проект', isPinned: true, employees: [] }]
    const queryKey = ['employment-board', 'list', null, '2026-10-07', 'today']
    queryClient.setQueryData(queryKey, snapshot)
    const response = deferred<ActionResult<null>>()
    actionMocks.placeEmployee.mockReturnValueOnce(response.promise)
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const mutation = renderHook(() => usePlaceEmployee(), { wrapper })

    act(() => mutation.result.current.mutate({
      departmentId: 'department',
      projectId: 'project',
      employeeId: employee.id,
      selectedDate: '2026-10-07',
    }))
    await waitFor(() => expect(
      queryClient.getQueryData<EmploymentBoard>(queryKey)?.projects[0].employees,
    ).toHaveLength(1))
    queryClient.removeQueries({ queryKey, exact: true })
    response.resolve({ success: false, error: 'failed' })

    await waitFor(() => expect(mutation.result.current.isError).toBe(true))
    expect(queryClient.getQueryData(queryKey)).toBeUndefined()
  })

  it('does not overwrite a fresh active snapshot during mutation rollback', async () => {
    const snapshot = board('2026-10-07', 'today')
    const employee = { id: 'employee', name: 'Сотрудник', avatarUrl: null, positionName: null, teamName: null }
    snapshot.employees = [employee]
    snapshot.projects = [{ id: 'project', name: 'Проект', isPinned: true, employees: [] }]
    const queryKey = ['employment-board', 'list', null, '2026-10-07', 'today']
    queryClient.setQueryData(queryKey, snapshot)
    const response = deferred<ActionResult<null>>()
    actionMocks.placeEmployee.mockReturnValueOnce(response.promise)
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const mutation = renderHook(() => usePlaceEmployee(), { wrapper })

    act(() => mutation.result.current.mutate({
      departmentId: 'department',
      projectId: 'project',
      employeeId: employee.id,
      selectedDate: '2026-10-07',
    }))
    await waitFor(() => expect(
      queryClient.getQueryData<EmploymentBoard>(queryKey)?.projects[0].employees,
    ).toHaveLength(1))
    const fresh = { ...snapshot, departmentName: 'Свежий отдел' }
    queryClient.setQueryData(queryKey, fresh)
    response.resolve({ success: false, error: 'failed' })

    await waitFor(() => expect(mutation.result.current.isError).toBe(true))
    expect(queryClient.getQueryData(queryKey)).toEqual(fresh)
    expect(queryClient.getQueryData<EmploymentBoard>(queryKey)?.departmentName).toBe('Свежий отдел')
  })
})
