export interface Loading {
  id: string
  projectId?: string
  projectName?: string
  projectStatus?: string
  sectionId: string
  sectionName?: string
  employeeId?: string
  responsibleId?: string
  responsibleName?: string
  responsibleAvatarUrl?: string
  responsibleTeamName?: string
  startDate: Date
  endDate: Date
  rate: number
  status?: string
  createdAt?: Date | null
  updatedAt?: Date | null
}

export interface Team {
  id: string
  name: string
  code?: string
  departmentId: string
  departmentName?: string
  totalEmployees?: number
  dailyWorkloads?: Record<string, number>
  employees: Employee[]
}

export interface Employee {
  id: string
  name: string
  fullName?: string
  firstName?: string
  lastName?: string
  email?: string
  teamId: string
  teamCode?: string
  teamName?: string
  departmentId?: string
  departmentName?: string
  position?: string
  avatarUrl?: string
  workload: number
  employmentRate?: number
  dailyWorkloads?: Record<string, number>
  loadings?: Loading[]
}

export interface Section {
  id: string
  name: string
  departmentId: string
  departmentName?: string
  projectId?: string
  projectName?: string
  objectId?: string
  objectName?: string
  stageId?: string
  stageName?: string
  clientId?: string
  startDate?: Date
  endDate?: Date
  status?: string
  responsibleName?: string
  responsibleAvatarUrl?: string
  hasLoadings?: boolean
  loadings?: Loading[]
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
