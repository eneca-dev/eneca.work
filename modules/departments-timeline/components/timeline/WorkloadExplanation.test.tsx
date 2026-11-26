import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DayCell, Department, Team } from '../../types'
import { TeamRowContent } from './TeamRow'
import { DepartmentRowContent } from './DepartmentRow'

vi.mock('../../stores', () => ({ useRowExpanded: () => ({ isExpanded: true, toggle: vi.fn() }) }))
vi.mock('../../hooks', () => ({
  useConfirmTeamActivity: () => ({ mutateAsync: vi.fn() }),
  useConfirmMultipleTeamsActivity: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/modules/permissions', () => ({ useCanBulkShiftDepartment: () => false }))
vi.mock('@/components/shared/timeline', () => ({ FreshnessIndicator: () => null }))
vi.mock('./BulkShiftPopover', () => ({ BulkShiftPopover: () => null }))

const days: DayCell[] = [24, 25].map(day => ({
  date: new Date(Date.UTC(2026, 10, day)), dayOfMonth: day, dayOfWeek: 'Ср',
  isWeekend: false, isToday: day === 25, isMonthStart: false, monthName: 'Ноябрь',
  isHoliday: false, holidayName: null, isWorkday: true, isTransferredWorkday: false,
  isTransferredDayOff: false, monthIndex: 0,
}))
const team: Team = {
  id: 'team', name: 'Тест Команда', departmentId: 'department',
  employees: [0.75, 1, 1, 1, 1, 1, 1].map((employmentRate, index) => ({
    id: `active-${index}`, name: `Employee ${index}`, employmentRate, workload: 0,
  })),
  dailyCapacity: { '2026-11-24': 7.75, '2026-11-25': 6.75 },
  dailyWorkloads: { '2026-11-24': 1, '2026-11-25': 1 },
}
const department: Department = { id: 'department', name: 'Тестовый отдел', totalEmployees: 7,
  teams: [team], dailyCapacity: team.dailyCapacity, dailyWorkloads: team.dailyWorkloads }

describe('dated workload cell tooltips', () => {
  it.each(['team', 'department'] as const)('explains %s day percentages using saved daily capacity', scope => {
    const props = { dayCells: days, timelineScale: 'day' as const, monthCells: [], monthCellWidth: 400 }
    if (scope === 'team') render(<TeamRowContent {...props} team={team} />)
    else render(<DepartmentRowContent {...props} department={department} departmentIndex={0} />)

    // The retired employee is absent from visible rows, but contributes to the 24th.
    const previousDay = screen.getAllByTitle(/24\.11\.2026: 13%/)
    expect(previousDay.length).toBeGreaterThan(0)
    expect(previousDay[0].getAttribute('title')).toContain('1 ÷ 7,75 × 100% ≈ 13%')
    const today = screen.getAllByTitle(/25\.11\.2026: 15%/)
    expect(today[0].getAttribute('title')).toContain('1 ÷ 6,75 × 100% ≈ 15%')
    expect(screen.getByTitle(/Доступная мощность .* на сегодня/).textContent).toBe('6.75')
  })

  it('explains zero capacity without showing a made-up percentage', () => {
    render(<TeamRowContent team={{ ...team, dailyCapacity: { '2026-11-24': 0, '2026-11-25': 0 } }}
      dayCells={days} timelineScale="day" monthCells={[]} monthCellWidth={400} />)
    const cells = screen.getAllByTitle(/Нет базы расчёта: доступная мощность отсутствует/)
    expect(cells).toHaveLength(2)
    expect(cells[0].getAttribute('title')).not.toContain('÷')
  })

  it('explains non-working dates without a percentage', () => {
    render(<TeamRowContent team={team} dayCells={[{ ...days[0], isHoliday: true, isWorkday: false }]}
      timelineScale="day" monthCells={[]} monthCellWidth={400} />)
    expect(screen.getByTitle(/Нерабочий день/).getAttribute('title')).not.toContain('13%')
  })
})
