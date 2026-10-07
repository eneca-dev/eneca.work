import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmploymentBoardInternal } from './EmploymentBoardInternal'

const state = vi.hoisted(() => ({
  dateMode: 'dated' as 'today' | 'dated',
  loadError: false,
}))

vi.mock('@/modules/permissions', () => ({
  useHasPermission: () => true,
}))

vi.mock('../hooks/useEmploymentBoardDate', () => ({
  useEmploymentBoardDate: () => ({
    selectedDate: state.dateMode === 'today' ? '2026-10-07' : '2026-10-08',
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
    useEmploymentBoard: () => ({
      data: state.loadError ? undefined : {
        selectedDate: state.dateMode === 'today' ? '2026-10-07' : '2026-10-08',
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
      isLoading: false,
      error: state.loadError ? new Error('Ошибка загрузки') : null,
    }),
    useBoardPresence: () => ({ data: [] }),
    usePinProject: mutation,
    usePlaceEmployee: mutation,
    useRemovePlacement: mutation,
    useUnpinProject: mutation,
  }
})

vi.mock('../hooks/useEmploymentBoardRealtime', () => ({
  useEmploymentBoardRealtime: () => ({
    beginMutation: vi.fn(),
    finishMutation: vi.fn(),
  }),
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
    state.loadError = false
  })

  it('keeps project management enabled and limits placements to today', () => {
    const view = render(<EmploymentBoardInternal />)

    expect(screen.getByTestId('side-panel-capabilities')).toHaveAttribute('data-projects', 'true')
    expect(screen.getByTestId('side-panel-capabilities')).toHaveAttribute('data-placements', 'false')
    expect(screen.getByTestId('project-card-capabilities')).toHaveAttribute('data-placements', 'false')

    state.dateMode = 'today'
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
})
