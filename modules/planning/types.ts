export interface Team {
  id: string
  name: string
  departmentId: string
  employees: Employee[]
}

export interface Employee {
  id: string
  name: string
  teamId: string
  workload: number
}

export interface Section {
  id: string
  name: string
  departmentId: string
}

export interface Department {
  id: string
  name: string
  wsDepartmentId?: string | null
  totalEmployees: number
  dailyWorkloads?: Record<string, number>
  teams: Team[]
  sections?: Section[]
  managerName?: string
}
