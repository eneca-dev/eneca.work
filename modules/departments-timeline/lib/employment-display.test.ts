import { describe, expect, it } from 'vitest'
import type { EmploymentSegment, Loading } from '../types'
import { clipLoadingsToEmployment } from './employment-display'
import { flattenDepartments } from '../components/timeline/flatten-departments'

const loading: Loading = {
  id: 'loading', sectionId: 'section', stageId: 'stage',
  startDate: '2026-10-01', endDate: '2026-11-30', rate: 1,
}
const segment = (startDate: string, endDate: string): EmploymentSegment => ({
  employeeId: 'employee', departmentId: 'department', teamId: 'team',
  startDate, endDate, employmentRate: 1,
})

describe('employment display clipping', () => {
  it('retains the legacy ID and interval without staffing history', () => {
    expect(clipLoadingsToEmployment([loading], undefined)).toEqual([{ ...loading, sourceLoadingId: loading.id }])
  })

  it('clips the visible interval while preserving original ID lookup and source data', () => {
    const before = { ...loading }
    const [display] = clipLoadingsToEmployment([loading], [segment('2026-11-10', '2026-11-15')])
    expect(display.startDate).toBe('2026-11-10')
    expect(display.endDate).toBe('2026-11-15')
    expect(display.sourceLoadingId).toBe(loading.id)
    expect(display.id).not.toBe(loading.id)
    expect(loading).toEqual(before)
  })

  it('merges adjacent rate periods so one loading is not counted twice in monthly layout', () => {
    const result = clipLoadingsToEmployment([loading], [
      segment('2026-11-15', '2026-11-30'),
      { ...segment('2026-11-01', '2026-11-14'), employmentRate: 0.5 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ startDate: '2026-11-01', endDate: '2026-11-30', rate: 1 })
  })

  it('keeps separate fragments across an employment gap with unique display keys', () => {
    const result = clipLoadingsToEmployment([loading], [
      segment('2026-10-25', '2026-10-31'), segment('2026-11-05', '2026-11-10'),
    ])
    expect(result.map(item => [item.startDate, item.endDate])).toEqual([
      ['2026-10-25', '2026-10-31'], ['2026-11-05', '2026-11-10'],
    ])
    expect(new Set(result.map(item => item.id)).size).toBe(2)
    expect(result.every(item => item.sourceLoadingId === loading.id)).toBe(true)
  })

  it('keeps inclusive boundaries and removes wholly outside loadings', () => {
    expect(clipLoadingsToEmployment([loading], [segment('2026-11-30', '2026-12-01')])[0]).toMatchObject({
      startDate: '2026-11-30', endDate: '2026-11-30',
    })
    expect(clipLoadingsToEmployment([loading], [segment('2026-12-01', '2026-12-31')])).toEqual([])
    expect(clipLoadingsToEmployment([loading], [])).toEqual([])
  })

  it('distinguishes historical rows with the same employee and team in different departments', () => {
    const items = ['old', 'new'].map(id => ({
      id, name: id, totalEmployees: 1,
      teams: [{ id: 'same-team', name: 'Команда', departmentId: id, employees: [{ id: 'employee', name: 'Сотрудник', workload: 0 }] }],
    }))
    const rows = flattenDepartments([{ key: 'all', label: 'Все', items }], {
      department: new Set(['old', 'new']), team: new Set(['same-team']), employee: new Set(),
    })
    expect(new Set(rows.map(row => row.key)).size).toBe(rows.length)
    expect(rows.filter(row => row.kind === 'employee').map(row => row.key)).toEqual([
      'emp:old:same-team:employee', 'emp:new:same-team:employee',
    ])
  })
})
