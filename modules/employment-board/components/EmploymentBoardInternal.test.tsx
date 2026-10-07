import { useEffect } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emitEmploymentBoardLoadingChange,
  subscribeEmploymentBoardLoadingChanges,
  type LoadingRealtimePayload,
} from '@/modules/cache/realtime'
import { EmploymentBoardInternal } from './EmploymentBoardInternal'

const state = vi.hoisted(() => ({
  dateMode: 'dated' as 'today' | 'dated',
  selectedDate: '2026-10-08',
  loadError: false,
  isLoading: false,
  boardAvailable: true,
  refreshError: null as Error | null,
  retryRefresh: vi.fn(),
  boardCalls: [] as Array<{ cachePolicy?: 'cache-aside' | 'fresh' }>,
}))

function loadingInsert(row: Record<string, unknown>): LoadingRealtimePayload {
  return {
    eventType: 'INSERT',
    new: row,
    old: {},
    schema: 'public',
    table: 'loadings',
    commit_timestamp: '',
  } as LoadingRealtimePayload
}

vi.mock('@/modules/permissions', () => ({
  useHasPermission: () => true,
}))

vi.mock('../hooks/useEmploymentBoardDate', () => ({
  useEmploymentBoardDate: () => ({
    selectedDate: state.selectedDate,
    currentMinskDate: '2026-10-07',
    followsToday: state.dateMode === 'today',
    mode: state.dateMode,
    selectDate: vi.fn(),
    selectToday: vi.fn(),
    refreshCurrentMinskDate: vi.fn(),
  }),
}))

vi.mock('../hooks/useEmploymentBoard', () => {
  const mutation = () => ({ mutate: vi.fn() })

  return {
    useEmploymentBoard: (options: { cachePolicy?: 'cache-aside' | 'fresh' }) => {
      state.boardCalls.push(options)
      return {
        data: state.loadError || !state.boardAvailable ? undefined : {
          selectedDate: state.selectedDate,
          dateMode: state.dateMode,
          departmentId: 'department',
          departmentName: 'Отдел',
          projects: [{
            id: 'project',
            name: 'Проект',
            isPinned: true,
            employees: [],
          }],
          employees: [],
          unassignedEmployeeIds: [],
        },
        isLoading: state.isLoading,
        error: state.loadError ? new Error('Ошибка загрузки') : null,
      }
    },
    useBoardPresence: () => ({ data: [] }),
    usePinProject: mutation,
    usePlaceEmployee: mutation,
    useRemovePlacement: mutation,
    useUnpinProject: mutation,
  }
})

vi.mock('../hooks/useEmploymentBoardRealtime', () => ({
  useEmploymentBoardRealtime: (options: { onMarkDateChangeStale: () => void }) => {
    useEffect(() => subscribeEmploymentBoardLoadingChanges(() => {
      options.onMarkDateChangeStale()
    }), [options.onMarkDateChangeStale])
    return {
      beginMutation: vi.fn(),
      finishMutation: vi.fn(),
      refreshError: state.refreshError,
      retryRefresh: state.retryRefresh,
    }
  },
}))

vi.mock('../hooks/useBoardDnd', () => ({
  useBoardDnd: () => ({
    handleDragStart: vi.fn(),
    handleDragEnd: vi.fn(),
    handleBoardDragOver: vi.fn(),
    handleBoardDrop: vi.fn(),
    handleProjectDragOver: vi.fn(),
    handleProjectDragLeave: vi.fn(),
    handleProjectDrop: vi.fn(),
  }),
}))

vi.mock('./BoardDatePicker', () => ({
  BoardDatePicker: () => <div data-testid="date-picker" />,
}))

vi.mock('./SidePanel', () => ({
  SidePanel: ({
    canManageProjects,
    canManagePlacements,
  }: {
    canManageProjects: boolean
    canManagePlacements: boolean
  }) => (
    <div
      data-testid="side-panel-capabilities"
      data-projects={String(canManageProjects)}
      data-placements={String(canManagePlacements)}
    />
  ),
}))

vi.mock('./ProjectCard', () => ({
  ProjectCard: ({
    canManageProjects,
    canManagePlacements,
  }: {
    canManageProjects: boolean
    canManagePlacements: boolean
  }) => (
    <div
      data-testid="project-card-capabilities"
      data-projects={String(canManageProjects)}
      data-placements={String(canManagePlacements)}
    />
  ),
}))

describe('EmploymentBoardInternal capabilities', () => {
  beforeEach(() => {
    state.dateMode = 'dated'
    state.selectedDate = '2026-10-08'
    state.loadError = false
    state.isLoading = false
    state.boardAvailable = true
    state.refreshError = null
    state.retryRefresh.mockReset()
    state.boardCalls.length = 0
  })

  it('keeps project management enabled and limits placements to today', () => {
    const view = render(<EmploymentBoardInternal />)

    expect(screen.getByTestId('side-panel-capabilities')).toHaveAttribute('data-projects', 'true')
    expect(screen.getByTestId('side-panel-capabilities')).toHaveAttribute('data-placements', 'false')
    expect(screen.getByTestId('project-card-capabilities')).toHaveAttribute('data-placements', 'false')

    state.dateMode = 'today'
    state.selectedDate = '2026-10-07'
    view.rerender(<EmploymentBoardInternal />)

    expect(screen.getByTestId('side-panel-capabilities')).toHaveAttribute('data-projects', 'true')
    expect(screen.getByTestId('side-panel-capabilities')).toHaveAttribute('data-placements', 'true')
    expect(screen.getByTestId('project-card-capabilities')).toHaveAttribute('data-placements', 'true')
  })

  it('keeps the date picker available when the selected date fails to load', () => {
    state.loadError = true

    render(<EmploymentBoardInternal />)

    expect(screen.getByTestId('date-picker')).toBeInTheDocument()
    expect(screen.getByText('Ошибка загрузки')).toBeInTheDocument()
  })

  it('keeps saved board data visible and offers a manual retry after refresh failure', () => {
    state.refreshError = new Error('refresh failed')

    render(<EmploymentBoardInternal />)

    expect(screen.getByTestId('employment-board-projects')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Не удалось обновить доску. Показаны последние сохранённые данные.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(state.retryRefresh).toHaveBeenCalledTimes(1)
  })

  it('offers a manual retry when the first fresh read fails before a board is available', () => {
    state.boardAvailable = false
    state.isLoading = true
    state.refreshError = new Error('refresh failed')

    render(<EmploymentBoardInternal />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Не удалось загрузить актуальные данные доски.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(state.retryRefresh).toHaveBeenCalledTimes(1)
  })

  it('uses fresh when returning 8 October after an irrelevant insert while viewing today', () => {
    const view = render(<EmploymentBoardInternal />)
    expect(state.boardCalls[state.boardCalls.length - 1]?.cachePolicy).toBe('cache-aside')

    state.dateMode = 'today'
    state.selectedDate = '2026-10-07'
    view.rerender(<EmploymentBoardInternal />)

    act(() => emitEmploymentBoardLoadingChange(loadingInsert({
      loading_status: 'active',
      is_shortage: false,
      loading_start: '2026-10-08',
      loading_finish: '2026-10-08',
    })))

    state.dateMode = 'dated'
    state.selectedDate = '2026-10-08'
    view.rerender(<EmploymentBoardInternal />)

    expect(state.boardCalls[state.boardCalls.length - 1]?.cachePolicy).toBe('fresh')
  })
})
