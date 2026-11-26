import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { Department, Team } from '../types'
import type { DeptFlatRow } from './timeline/flatten-departments'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  departments: vi.fn(), roster: vi.fn(), rosterRefetch: vi.fn(), prefetch: vi.fn(), teamRow: vi.fn(), departmentRow: vi.fn(),
  customRange: null as { startDate: string; endDate: string } | null,
}))
vi.mock('../hooks', () => ({
  useDepartmentsData: mocks.departments,
  useTeamsFreshness: () => ({ data: {} }), useCompanyCalendarEvents: () => ({ data: [] }),
}))
vi.mock('@/modules/users/hooks/use-finished-employees', () => ({ useFinishedEmployees: mocks.roster }))
vi.mock('../stores', () => ({
  useDepartmentsTimelineUIStore: (selector: (state: object) => unknown) => selector({
    customDateRange: mocks.customRange, timelineScale: 'day',
    expandedNodes: { department: new Set(['department', 'other-department']), team: new Set(['team', 'other-team']), employee: new Set() },
    collapseAll: vi.fn(), expandAll: vi.fn(), setCustomDateRange: vi.fn(), setTimelineScale: vi.fn(),
  }),
}))
vi.mock('@/modules/permissions', () => ({ useIsAdmin: () => true }))
vi.mock('@/modules/modals', () => ({ usePrefetchProjectsList: () => mocks.prefetch }))
vi.mock('@/modules/resource-graph/components/timeline', () => ({
  TimelineHeader: () => null, MonthlyHeader: () => null,
  resolveTimelineRange: (custom: { startDate: string; endDate: string } | null) => ({
    start: new Date(`${custom?.startDate ?? '2026-11-24'}T00:00:00Z`),
    end: new Date(`${custom?.endDate ?? '2026-11-26'}T00:00:00Z`),
  }),
  generateDayCells: (range: { start: Date; end: Date }) => [{ date: range.start }, { date: range.end }],
}))
vi.mock('@/modules/resource-graph/utils', () => ({ buildCalendarMap: () => new Map() }))
vi.mock('@/modules/resource-graph/utils/monthly-cell-utils', () => ({ generateMonthCells: () => [] }))
vi.mock('@/components/shared/timeline', () => ({ ScissorsToggle: () => null, ScaleToggle: () => null }))
vi.mock('./timeline/EmployeeRow', () => ({ EmployeeRow: ({ employee, lastWorkingDate }: { employee: { name: string }; lastWorkingDate?: string }) => <span data-last-working-day={lastWorkingDate}>{employee.name}</span> }))
vi.mock('./timeline/TeamRow', () => ({ TeamRowContent: ({ team }: { team: Team }) => {
  mocks.teamRow(team)
  return <div>{team.name}</div>
} }))
vi.mock('./timeline/DepartmentRow', () => ({ DepartmentRowContent: ({ department }: { department: Department }) => {
  mocks.departmentRow(department)
  return <div>{department.name}</div>
} }))
vi.mock('./timeline/DepartmentGroupDivider', () => ({ DepartmentGroupDivider: () => null }))
vi.mock('./timeline/TeamSubgroupDivider', () => ({ TeamSubgroupDivider: () => null }))
vi.mock('@/components/ui/skeleton', () => ({ Skeleton: () => <div data-testid="loading-row" /> }))
vi.mock('@/modules/shared/virtualized-tree', () => ({ VirtualList: ({ items, renderItem, getKey }: {
  items: DeptFlatRow[]; renderItem: (row: DeptFlatRow, index: number) => ReactNode; getKey: (row: DeptFlatRow) => string
}) => <div data-testid="timeline-rows">{items.map((item, index) => <div key={getKey(item)}>{renderItem(item, index)}</div>)}</div> }))

import { DepartmentsTimelineInternal } from './DepartmentsTimeline'

const fixture: Department[] = [{
  id: 'department', name: 'Тестовый отдел', totalEmployees: 2,
  dailyCapacity: { '2026-11-24': 2, '2026-11-25': 1 },
  dailyWorkloads: { '2026-11-24': 2, '2026-11-25': 1 },
  teams: [{ id: 'team', name: 'Тестовая команда', departmentId: 'department', totalEmployees: 2,
    dailyCapacity: { '2026-11-24': 2, '2026-11-25': 1 },
    dailyWorkloads: { '2026-11-24': 2, '2026-11-25': 1 },
    employees: [
      { id: 'active', name: 'Действующий', workload: 1, employmentRate: 1 },
      { id: 'finished', name: 'Завершивший', workload: 0, employmentRate: 0 },
    ],
  }],
}]
const roster = { enabled: true, today: '2026-11-25', finishedEmployeeIds: ['finished'], finishedOnByEmployeeId: { finished: '2026-11-24' } }
function show() {
  return render(<DepartmentsTimelineInternal queryParams={{}} loadAllEnabled onLoadAll={vi.fn()} />)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-25T09:00:00Z'))
  vi.clearAllMocks()
  mocks.customRange = null
  mocks.departments.mockReturnValue({ data: fixture, isLoading: false, error: null })
  mocks.roster.mockReturnValue({ data: roster, isPending: false, isError: false, error: null, refetch: mocks.rosterRefetch })
})
afterEach(() => vi.useRealTimers())

describe('department timeline finished employee visibility', () => {
  it('shows a transferred employee only in the current department until roster history is enabled', () => {
    const source = structuredClone(fixture)
    const moved = { id: 'moved', name: 'Переведённый', workload: 0, employmentRate: 0,
      currentDepartmentId: 'other-department', currentTeamId: 'other-team' }
    source[0].teams[0].employees.push(moved)
    source.push({ id: 'other-department', name: 'Другой отдел', totalEmployees: 1,
      teams: [{ id: 'other-team', name: 'Другая команда', departmentId: 'other-department',
        employees: [{ ...moved, workload: 1, employmentRate: 1 }] }] })
    const before = JSON.stringify(source)
    mocks.departments.mockReturnValue({ data: source, isLoading: false, error: null })
    show()
    expect(screen.getAllByText('Переведённый')).toHaveLength(1)
    const oldTeam = mocks.teamRow.mock.calls.find(([team]) => team.id === 'team')![0] as Team
    expect(oldTeam.employees.some(person => person.id === 'moved')).toBe(false)
    expect(oldTeam.dailyCapacity).toEqual(source[0].teams[0].dailyCapacity)
    expect(oldTeam.dailyWorkloads).toEqual(source[0].teams[0].dailyWorkloads)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Показывать историю состава' }))
    expect(screen.getAllByText('Переведённый')).toHaveLength(2)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Показывать историю состава' }))
    expect(screen.getAllByText('Переведённый')).toHaveLength(1)
    expect(JSON.stringify(source)).toBe(before)
  })

  it('shows the former membership automatically for a fully historical range', () => {
    const source = structuredClone(fixture)
    source[0].teams[0].employees.push({ id: 'moved', name: 'Переведённый', workload: 0,
      currentDepartmentId: 'other-department', currentTeamId: 'other-team' })
    mocks.customRange = { startDate: '2026-11-01', endDate: '2026-11-24' }
    mocks.departments.mockReturnValue({ data: source, isLoading: false, error: null })
    show()
    expect(screen.getByText('Переведённый')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /^Показывать историю состава/ })).not.toBeChecked()
  })

  it('hides finished rows in the current range without changing historical team and department totals', () => {
    const before = JSON.stringify(fixture)
    show()
    expect(screen.getByText('Действующий')).toBeInTheDocument()
    expect(screen.queryByText('Завершивший')).not.toBeInTheDocument()
    const team = mocks.teamRow.mock.lastCall![0] as Team
    const department = mocks.departmentRow.mock.lastCall![0] as Department
    expect(team.employees.map(employee => employee.id)).toEqual(['active'])
    expect(team.dailyCapacity).toEqual(fixture[0].teams[0].dailyCapacity)
    expect(team.dailyWorkloads).toEqual(fixture[0].teams[0].dailyWorkloads)
    expect(department.dailyCapacity).toEqual(fixture[0].dailyCapacity)
    expect(department.dailyWorkloads).toEqual(fixture[0].dailyWorkloads)
    expect(JSON.stringify(fixture)).toBe(before)
  })

  it('restores finished rows on explicit toggle', () => {
    show()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Показывать историю состава' }))
    expect(screen.getByText('Завершивший')).toBeInTheDocument()
    expect(screen.getByText('Завершивший')).toHaveAttribute('data-last-working-day', '2026-11-24')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Показывать историю состава' }))
    expect(screen.queryByText('Завершивший')).not.toBeInTheDocument()
  })

  it('automatically retains historical employees when the entire selected range is in the past', () => {
    mocks.customRange = { startDate: '2026-11-01', endDate: '2026-11-24' }
    show()
    expect(screen.getByText('Завершивший')).toBeInTheDocument()
    expect(screen.getByText('В прошлом диапазоне показан исторический состав.')).toBeInTheDocument()
  })

  it('does not flash employee rows while roster membership is loading', () => {
    mocks.roster.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: mocks.rosterRefetch })
    show()
    expect(screen.getAllByTestId('loading-row')).toHaveLength(5)
    expect(screen.queryByTestId('timeline-rows')).not.toBeInTheDocument()
    expect(screen.queryByText('Завершивший')).not.toBeInTheDocument()
  })

  it('blocks stale roster rows on error and offers a retry', () => {
    mocks.roster.mockReturnValue({ data: roster, isPending: false, isError: true, error: new Error('Проверка состава недоступна'), refetch: mocks.rosterRefetch })
    show()
    expect(screen.queryByTestId('timeline-rows')).not.toBeInTheDocument()
    expect(screen.getByText('Проверка состава недоступна')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить проверку состава' }))
    expect(mocks.rosterRefetch).toHaveBeenCalledOnce()
  })
})
