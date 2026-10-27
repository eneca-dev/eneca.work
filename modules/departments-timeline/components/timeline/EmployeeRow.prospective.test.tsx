import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { DayCell, Employee } from '../../types'
import { EmployeeRow } from './EmployeeRow'
import type { MonthCell } from '@/modules/resource-graph/utils/monthly-cell-utils'

const { openEdit } = vi.hoisted(() => ({ openEdit: vi.fn() }))
vi.mock('@/modules/modals', () => ({ openLoadingModalNewEdit: openEdit, openLoadingModalNewCreate: vi.fn() }))
vi.mock('@/modules/permissions', () => ({ useCanEditLoading: () => false }))
vi.mock('@/modules/users/hooks/use-loading-access-grants', () => ({ useAllLoadingAccessGrantsIndex: () => ({ data: {} }) }))
vi.mock('@/modules/modals/hooks/useLoadingMutations', () => ({ useLoadingMutations: () => ({ split: { mutate: vi.fn() } }) }))
vi.mock('../../hooks', () => ({ useUpdateLoadingDates: () => ({ mutate: vi.fn() }) }))
vi.mock('@/modules/resource-graph/hooks', () => ({ useTimelineResize: () => ({ wasRecentlyDragging: () => false }) }))
vi.mock('@/hooks/useScissorsInteraction', () => ({ useScissorsInteraction: () => ({ cutLinePosition: null, handlers: {} }) }))
vi.mock('@/stores', () => ({ useScissorsModeStore: () => false }))
vi.mock('../../stores', () => ({
  useBulkShiftSelectionStore: (selector: (s: object) => unknown) => selector({
    activeDepartmentId: null, activeProjectId: null, toggle: vi.fn(), selectedLoadingIds: new Set(),
  }),
}))

const employee: Employee = {
  id: 'employee-1', name: 'Иван Иванов', workload: 0.5,
  loadings: [{
    id: 'loading-1', employeeId: 'employee-1', projectId: 'project-1', projectName: 'Прочие работы',
    sectionId: 'section-1', sectionName: 'Раздел', stageId: 'stage-1',
    startDate: '2026-10-27', endDate: '2026-10-31', rate: 0.5, comment: 'Кировск', isProspective: true,
  }],
}
const dayCells: DayCell[] = Array.from({ length: 7 }, (_, i) => ({
  date: new Date(2026, 9, 27 + i), dayOfMonth: 27 + i, dayOfWeek: 'Вт',
  isWeekend: false, isToday: false, isMonthStart: false, monthName: 'Октябрь',
  isHoliday: false, holidayName: null, isWorkday: true, isTransferredWorkday: false,
  isTransferredDayOff: false, monthIndex: 0,
}))
const monthCells: MonthCell[] = [{
  year: 2026, month: 9, label: 'Октябрь 2026', shortLabel: 'Окт', startDate: '2026-10-01',
  endDate: '2026-10-31', isCurrentMonth: true, workingDays: 22, workingDates: [],
}]

describe('EmployeeRow prospective loading', () => {
  it.each(['day', 'month'] as const)('shows the marker and preserves it in edit preload in %s scale', timelineScale => {
    openEdit.mockClear()
    render(<EmployeeRow employee={employee} employeeIndex={0} dayCells={dayCells}
      isTeamLead={false} timelineScale={timelineScale} monthCells={monthCells} monthCellWidth={400} />)
    const marker = screen.getByRole('img', { name: /^Перспектива/ })
    fireEvent.click(marker)
    expect(openEdit).toHaveBeenCalledWith('loading-1', 'section-1', expect.objectContaining({
      loading: expect.objectContaining({ isProspective: true, rate: 0.5, comment: 'Кировск' }),
    }))
  })

  it('does not mark an ordinary loading based on its project or comment', () => {
    const ordinary: Employee = { ...employee, loadings: employee.loadings?.map(l => ({ ...l, isProspective: false })) }
    render(<EmployeeRow employee={ordinary} employeeIndex={0} dayCells={dayCells}
      isTeamLead={false} timelineScale="day" monthCells={monthCells} monthCellWidth={400} />)
    expect(screen.queryByRole('img', { name: /^Перспектива/ })).not.toBeInTheDocument()
    expect(screen.getByText('Кировск')).toBeInTheDocument()
  })

  it('keeps a missing legacy flag unknown when opening edit', () => {
    openEdit.mockClear()
    const legacy: Employee = {
      ...employee,
      loadings: employee.loadings?.map(({ isProspective: _missing, ...loading }) => loading),
    }
    render(<EmployeeRow employee={legacy} employeeIndex={0} dayCells={dayCells}
      isTeamLead={false} timelineScale="day" monthCells={monthCells} monthCellWidth={400} />)
    fireEvent.click(screen.getByText('0.5'))
    expect(openEdit).toHaveBeenCalledWith('loading-1', 'section-1', expect.objectContaining({
      loading: expect.objectContaining({ isProspective: undefined }),
    }))
  })
})
