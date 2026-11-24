import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { DayCell, Employee } from '../types'
import type { MonthCell } from '@/modules/resource-graph/utils/monthly-cell-utils'
import { EmployeeRow } from '../components/timeline/EmployeeRow'

const { openEdit, permission, resize } = vi.hoisted(() => ({
  openEdit: vi.fn(), permission: vi.fn(() => true), resize: vi.fn(() => ({ wasRecentlyDragging: () => false })),
}))
vi.mock('@/modules/modals', () => ({ openLoadingModalNewEdit: openEdit, openLoadingModalNewCreate: vi.fn() }))
vi.mock('@/modules/permissions', () => ({ useCanEditLoading: permission }))
vi.mock('@/modules/users/hooks/use-loading-access-grants', () => ({ useAllLoadingAccessGrantsIndex: () => ({ data: {} }) }))
vi.mock('@/modules/modals/hooks/useLoadingMutations', () => ({ useLoadingMutations: () => ({ split: { mutate: vi.fn() } }) }))
vi.mock('../hooks', () => ({ useUpdateLoadingDates: () => ({ mutate: vi.fn() }) }))
vi.mock('@/modules/resource-graph/hooks', () => ({ useTimelineResize: resize }))
vi.mock('@/hooks/useScissorsInteraction', () => ({ useScissorsInteraction: () => ({ cutLinePosition: null, handlers: {} }) }))
vi.mock('@/stores', () => ({ useScissorsModeStore: () => false }))
vi.mock('../stores', () => ({
  useBulkShiftSelectionStore: (selector: (s: object) => unknown) => selector({
    activeDepartmentId: null, activeProjectId: null, toggle: vi.fn(), selectedLoadingIds: new Set(),
  }),
}))

const employee: Employee = {
  id: 'employee', name: 'Сотрудник', workload: 0, employmentRate: 0,
  teamId: 'old-team', departmentId: 'old-department', currentTeamId: 'current-team', currentDepartmentId: 'current-department',
  employmentSegments: [{ employeeId: 'employee', teamId: 'old-team', departmentId: 'old-department',
    startDate: '2026-11-10', endDate: '2026-11-12', employmentRate: 1 }],
  loadings: [{ id: 'loading', sectionId: 'section', stageId: 'stage', projectId: 'project',
    projectName: 'Объект', startDate: '2026-11-01', endDate: '2026-11-30', rate: 0.5, isProspective: true }],
}
const dayCells: DayCell[] = Array.from({ length: 7 }, (_, i) => ({
  date: new Date(2026, 10, 9 + i), dayOfMonth: 9 + i, dayOfWeek: 'Пн',
  isWeekend: false, isToday: false, isMonthStart: false, monthName: 'Ноябрь',
  isHoliday: false, holidayName: null, isWorkday: true, isTransferredWorkday: false,
  isTransferredDayOff: false, monthIndex: 0,
}))
const monthCells: MonthCell[] = [{
  year: 2026, month: 10, label: 'Ноябрь 2026', shortLabel: 'Ноя', startDate: '2026-11-01',
  endDate: '2026-11-30', isCurrentMonth: true, workingDays: 21, workingDates: [],
}]

describe('employee historical loading display', () => {
  it.each(['day', 'month'] as const)('opens original dates and checks current membership in %s view', timelineScale => {
    openEdit.mockClear()
    resize.mockClear()
    render(<EmployeeRow employee={employee} employeeIndex={0} dayCells={dayCells}
      isTeamLead={false} timelineScale={timelineScale} monthCells={monthCells} monthCellWidth={400} />)
    fireEvent.click(screen.getByRole('img', { name: /^Перспектива/ }))
    expect(openEdit).toHaveBeenCalledWith('loading', 'section', expect.objectContaining({
      loading: expect.objectContaining({
        start_date: '2026-11-01', end_date: '2026-11-30',
        employee_team_id: 'current-team', employee_department_id: 'current-department',
      }),
    }))
    expect(permission).toHaveBeenCalledWith(expect.objectContaining({ teamId: 'current-team', departmentId: 'current-department' }))
    expect(screen.getByText('0')).toBeInTheDocument()
    if (timelineScale === 'day') expect(resize).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }))
  })

  it('opens the original conflicting loading from its indicator', () => {
    openEdit.mockClear()
    render(<EmployeeRow employee={{ ...employee, loadings: [], employmentConflicts: employee.loadings }} employeeIndex={0} dayCells={dayCells}
      isTeamLead={false} timelineScale="day" monthCells={monthCells} monthCellWidth={400} />)
    fireEvent.click(screen.getByRole('button', { name: 'Загрузок вне периодов работы: 1' }))
    expect(openEdit).toHaveBeenCalledWith('loading', 'section', expect.objectContaining({
      loading: expect.objectContaining({ start_date: '2026-11-01', end_date: '2026-11-30' }),
    }))
  })
})
