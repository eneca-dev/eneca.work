import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { act, render, screen } from '@testing-library/react'
import type { DayCell, Employee } from '../../types'
import { EmployeeRow } from './EmployeeRow'
import { Toaster } from '@/components/ui/toaster'

const mocks = vi.hoisted(() => ({
  permission: true, scissorsActive: false, resize: vi.fn(), scissors: vi.fn(),
  update: vi.fn(), split: vi.fn(),
  mutationOptions: vi.fn(), toast: vi.fn(),
}))
vi.mock('@/modules/modals', () => ({ openLoadingModalNewEdit: vi.fn(), openLoadingModalNewCreate: vi.fn() }))
vi.mock('@/modules/permissions', () => ({ useCanEditLoading: () => mocks.permission }))
vi.mock('@/modules/users/hooks/use-loading-access-grants', () => ({ useAllLoadingAccessGrantsIndex: () => ({ data: {} }) }))
vi.mock('@/hooks/use-toast', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/use-toast')>('@/hooks/use-toast')
  return { ...actual, toast: (...args: Parameters<typeof actual.toast>) => {
    mocks.toast(...args)
    return actual.toast(...args)
  } }
})
vi.mock('@/modules/modals/hooks/useLoadingMutations', () => ({ useLoadingMutations: (options: unknown) => {
  mocks.mutationOptions(options)
  return { split: { mutate: mocks.split } }
} }))
vi.mock('../../hooks', () => ({ useUpdateLoadingDates: () => ({ mutate: mocks.update }) }))
vi.mock('@/modules/resource-graph/hooks', () => ({ useTimelineResize: (options: unknown) => {
  mocks.resize(options)
  return { wasRecentlyDragging: () => false, leftHandleProps: { 'data-testid': 'resize-left' }, rightHandleProps: { 'data-testid': 'resize-right' } }
} }))
vi.mock('@/hooks/useScissorsInteraction', () => ({ useScissorsInteraction: (options: unknown) => {
  mocks.scissors(options)
  return { cutLinePosition: null, handlers: {} }
} }))
vi.mock('@/stores', () => ({ useScissorsModeStore: () => mocks.scissorsActive }))
vi.mock('../../stores', () => ({ useBulkShiftSelectionStore: (selector: (s: object) => unknown) => selector({
  activeDepartmentId: null, activeProjectId: null, toggle: vi.fn(), selectedLoadingIds: new Set(),
}) }))

const dayCells: DayCell[] = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 10, i + 1)), dayOfMonth: i + 1, dayOfWeek: 'Пн',
  isWeekend: false, isToday: false, isMonthStart: i === 0, monthName: 'Ноябрь',
  isHoliday: false, holidayName: null, isWorkday: true, isTransferredWorkday: false,
  isTransferredDayOff: false, monthIndex: 0,
}))
const employee: Employee = {
  id: 'employee', name: 'Test', workload: 1,
  loadings: [{ id: 'original-loading', employeeId: 'employee', projectId: 'project',
    sectionId: 'section', stageId: 'stage', startDate: '2026-11-01', endDate: '2026-11-30', rate: 1 }],
  employmentSegments: [{ employeeId: 'employee', departmentId: 'department', teamId: 'team',
    startDate: '2026-11-10', endDate: '2026-11-30', employmentRate: 1 }],
}
function show(person = employee) {
  render(<EmployeeRow employee={person} employeeIndex={0} dayCells={dayCells}
    isTeamLead={false} timelineScale="day" monthCells={[]} monthCellWidth={400} />)
}
describe('employment display loading controls', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.permission = true; mocks.scissorsActive = false })

  it('shows server failures and success through the actual application Toaster', async () => {
    show()
    render(<Toaster />)
    expect(mocks.mutationOptions.mock.lastCall![0]).toEqual(expect.objectContaining({ optimisticSplit: false }))
    const callbacks = mocks.mutationOptions.mock.lastCall![0] as {
      onSplitSuccess: () => void; onError: (error: Error) => void
    }
    expect(mocks.toast).not.toHaveBeenCalled()
    act(() => callbacks.onError(new Error('Загрузка не найдена')))
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'destructive', description: 'Загрузка не найдена',
    }))
    expect(await screen.findByText('Загрузка не найдена')).toBeInTheDocument()
    act(() => callbacks.onSplitSuccess())
    expect(mocks.toast).toHaveBeenLastCalledWith({ title: 'Загрузка разделена', description: 'Обе части сохранены.' })
    expect(await screen.findByText('Обе части сохранены.')).toBeInTheDocument()
  })

  it('enables history resize at the actual endpoint and preserves the hidden source start', () => {
    show()
    expect(mocks.resize.mock.lastCall?.[0].disabled).toBe(false)
    expect(screen.queryByTestId('resize-left')).not.toBeInTheDocument()
    expect(screen.getByTestId('resize-right')).toBeInTheDocument()
    act(() => mocks.resize.mock.lastCall?.[0].onResize('2026-11-10', '2026-11-25'))
    expect(mocks.update).toHaveBeenCalledWith({ loadingId: 'original-loading', employeeId: 'employee',
      startDate: '2026-11-01', finishDate: '2026-11-25' }, expect.objectContaining({ onSettled: expect.any(Function) }))
  })

  it('preserves the hidden source finish when resizing the actual start', () => {
    show({ ...employee, employmentSegments: [{ ...employee.employmentSegments![0],
      startDate: '2026-11-01', endDate: '2026-11-20' }] })
    expect(screen.getByTestId('resize-left')).toBeInTheDocument()
    expect(screen.queryByTestId('resize-right')).not.toBeInTheDocument()
    act(() => mocks.resize.mock.lastCall?.[0].onResize('2026-11-05', '2026-11-20'))
    expect(mocks.update).toHaveBeenCalledWith({ loadingId: 'original-loading', employeeId: 'employee',
      startDate: '2026-11-05', finishDate: '2026-11-30' }, expect.objectContaining({ onSettled: expect.any(Function) }))
  })

  it('splits the original loading instead of its synthetic display ID', () => {
    mocks.scissorsActive = true
    show()
    const config = mocks.scissors.mock.lastCall?.[0]
    expect(config.isActive).toBe(true)
    expect(config.loadingId).toContain(':employment:')
    act(() => config.onSplit(config.loadingId, '2026-11-15'))
    expect(mocks.split).toHaveBeenCalledWith({ loadingId: 'original-loading', splitDate: '2026-11-15' }, expect.objectContaining({ onSettled: expect.any(Function) }))
  })

  it('keeps controls disabled without edit permission', () => {
    mocks.permission = false
    mocks.scissorsActive = true
    show()
    expect(mocks.resize.mock.lastCall?.[0].disabled).toBe(true)
    expect(mocks.scissors.mock.lastCall?.[0].isActive).toBe(false)
    expect(screen.queryByTestId('resize-right')).not.toBeInTheDocument()
    const config = mocks.scissors.mock.lastCall?.[0]
    act(() => config.onSplit(config.loadingId, '2026-11-15'))
    expect(mocks.split).not.toHaveBeenCalled()
  })

  it('blocks a cut and another resize until the previous date save has settled', () => {
    show()
    const resize = mocks.resize.mock.lastCall![0]
    const scissors = mocks.scissors.mock.lastCall![0]
    act(() => resize.onResize('2026-11-10', '2026-11-25'))
    act(() => scissors.onSplit(scissors.loadingId, '2026-11-15'))
    act(() => resize.onResize('2026-11-10', '2026-11-26'))
    expect(mocks.update).toHaveBeenCalledTimes(1)
    expect(mocks.split).not.toHaveBeenCalled()
    act(() => mocks.update.mock.lastCall![1].onSettled())
    act(() => scissors.onSplit(scissors.loadingId, '2026-11-15'))
    expect(mocks.split).toHaveBeenCalledTimes(1)
    act(() => resize.onResize('2026-11-10', '2026-11-26'))
    expect(mocks.update).toHaveBeenCalledTimes(1)
    act(() => mocks.split.mock.lastCall![1].onSettled())
    act(() => resize.onResize('2026-11-10', '2026-11-26'))
    expect(mocks.update).toHaveBeenCalledTimes(2)
  })
})
