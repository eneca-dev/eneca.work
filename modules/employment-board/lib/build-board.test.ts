import { describe, expect, it } from 'vitest'
import type { BoardEmployee } from '../types'
import { buildEmploymentBoard } from './build-board'

const employee: BoardEmployee = {
  id: 'employee-1',
  name: 'Иван Иванов',
  avatarUrl: null,
  positionName: null,
  teamName: null,
}

function build(dateMode: 'today' | 'dated') {
  return buildEmploymentBoard({
    selectedDate: '2026-10-08',
    dateMode,
    departmentId: 'department',
    departmentName: 'Отдел',
    isAdmin: false,
    employees: [employee],
    loadings: [
      { employeeId: employee.id, rate: 0.4, sectionId: 'section' },
      { employeeId: employee.id, rate: 0.6, sectionId: 'section' },
    ],
    projectIdBySection: new Map([['section', 'project']]),
    projects: [
      { id: 'project', name: 'Проект', isRestricted: false },
      { id: 'pinned', name: 'Закреплённый', isRestricted: false },
      { id: 'restricted', name: 'Скрытый', isRestricted: true },
    ],
    pinnedProjectIds: ['pinned', 'restricted'],
    placements: [{ projectId: 'pinned', employeeId: employee.id }],
  })
}

describe('buildEmploymentBoard', () => {
  it('aggregates loading rates, keeps allowed pins and filters restricted projects', () => {
    const result = build('today')

    expect(result).toMatchObject({ selectedDate: '2026-10-08', dateMode: 'today' })
    expect(result.projects.map((project) => project.id)).toEqual(['pinned', 'project'])
    expect(result.projects.find((project) => project.id === 'project')?.employees[0]).toMatchObject({
      id: employee.id,
      source: 'loading',
      rate: 1,
    })
    expect(result.projects.find((project) => project.id === 'pinned')?.employees[0]).toMatchObject({
      id: employee.id,
      source: 'manual',
    })
  })

  it('keeps pinned projects but excludes manual placements for a dated snapshot', () => {
    const result = build('dated')
    const pinned = result.projects.find((project) => project.id === 'pinned')

    expect(pinned).toMatchObject({ isPinned: true, employees: [] })
    expect(result.unassignedEmployeeIds).toEqual([])
  })
})
