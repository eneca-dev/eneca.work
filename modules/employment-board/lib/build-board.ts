import { compareProjectsByGup } from '@/modules/sections-page/utils/sort-projects'
import type {
  BoardEmployee,
  BoardProject,
  EmploymentBoard,
  EmploymentBoardDateMode,
} from '../types'

interface LoadingRow {
  employeeId: string | null
  rate: number | null
  sectionId: string | null
}

interface ProjectRow {
  id: string
  name: string | null
  isRestricted: boolean | null
}

interface PlacementRow {
  projectId: string
  employeeId: string
}

interface BuildEmploymentBoardInput {
  selectedDate: string
  dateMode: EmploymentBoardDateMode
  departmentId: string
  departmentName: string | null
  isAdmin: boolean
  employees: BoardEmployee[]
  loadings: LoadingRow[]
  projectIdBySection: ReadonlyMap<string, string>
  projects: ProjectRow[]
  pinnedProjectIds: string[]
  placements: PlacementRow[]
}

export function buildEmploymentBoard(input: BuildEmploymentBoardInput): EmploymentBoard {
  const employeeById = new Map(input.employees.map((employee) => [employee.id, employee]))
  const projectNameById = new Map<string, string>()

  for (const project of input.projects) {
    if (!input.isAdmin && project.isRestricted) continue
    projectNameById.set(project.id, project.name ?? 'Без названия')
  }

  const projectsMap = new Map<string, BoardProject>()
  const employeeRateByProject = new Map<string, Map<string, number>>()
  const ensureProject = (projectId: string): BoardProject | null => {
    const existing = projectsMap.get(projectId)
    if (existing) return existing
    const name = projectNameById.get(projectId)
    if (!name) return null

    const project: BoardProject = { id: projectId, name, isPinned: false, employees: [] }
    projectsMap.set(projectId, project)
    return project
  }

  for (const loading of input.loadings) {
    if (!loading.employeeId || !loading.sectionId) continue
    const projectId = input.projectIdBySection.get(loading.sectionId)
    if (!projectId || !ensureProject(projectId)) continue

    const rates = employeeRateByProject.get(projectId) ?? new Map<string, number>()
    employeeRateByProject.set(projectId, rates)
    const rate = Number(loading.rate ?? 0)
    rates.set(loading.employeeId, (rates.get(loading.employeeId) ?? 0) + (Number.isNaN(rate) ? 0 : rate))
  }

  for (const [projectId, rates] of employeeRateByProject) {
    const project = projectsMap.get(projectId)!
    for (const [employeeId, rate] of rates) {
      const employee = employeeById.get(employeeId)
      if (employee) project.employees.push({ ...employee, source: 'loading', rate })
    }
  }

  for (const projectId of input.pinnedProjectIds) {
    const project = ensureProject(projectId)
    if (project) project.isPinned = true
  }

  if (input.dateMode === 'today') {
    for (const placement of input.placements) {
      const project = projectsMap.get(placement.projectId)
      const employee = employeeById.get(placement.employeeId)
      if (!project || !employee || project.employees.some((item) => item.id === placement.employeeId)) continue
      project.employees.push({ ...employee, source: 'manual', rate: null })
    }
  }

  const projects = Array.from(projectsMap.values()).sort(compareProjectsByGup)
  projects.forEach((project) => project.employees.sort((a, b) => a.name.localeCompare(b.name, 'ru')))
  const placedIds = new Set(projects.flatMap((project) => project.employees.map((employee) => employee.id)))
  const employees = [...input.employees].sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  return {
    selectedDate: input.selectedDate,
    dateMode: input.dateMode,
    departmentId: input.departmentId,
    departmentName: input.departmentName ?? 'Отдел',
    projects,
    employees,
    unassignedEmployeeIds: employees.filter((employee) => !placedIds.has(employee.id)).map((employee) => employee.id),
  }
}
