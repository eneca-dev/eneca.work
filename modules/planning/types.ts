export interface Loading {
  id: string
  projectId?: string
  projectName?: string
  projectStatus?: string
  sectionId: string | null
  sectionName?: string
  employeeId?: string
  responsibleId?: string
  responsibleName?: string
  responsibleAvatarUrl?: string
  responsibleTeamName?: string
  startDate: Date // Приходит как ISO строка, преобразуется в Date
  endDate: Date   // Приходит как ISO строка, преобразуется в Date
  rate: number
  status?: string
  createdAt: Date // Приходит как ISO строка, преобразуется в Date
  updatedAt: Date // Приходит как ISO строка, преобразуется в Date
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
  teamLeadId?: string | null
  teamLeadName?: string | null
  teamLeadEmail?: string | null
  teamLeadAvatarUrl?: string | null
  createdAt?: Date // Приходит как ISO строка, преобразуется в Date
  updatedAt?: Date // Приходит как ISO строка, преобразуется в Date
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
  hasLoadings?: boolean
  loadingsCount?: number
  dailyWorkloads?: Record<string, number>
  // Календарные дни отпуска сотрудника: ключ — ISO-дата (YYYY-MM-DD), значение — 1 (полная ставка)
  vacationsDaily?: Record<string, number>
  loadings?: Loading[]
  createdAt?: Date // Приходит как ISO строка, преобразуется в Date
  updatedAt?: Date // Приходит как ISO строка, преобразуется в Date
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
  startDate: Date // Приходит как ISO строка, преобразуется в Date
  endDate: Date   // Приходит как ISO строка, преобразуется в Date
  status?: string
  responsibleName?: string
  responsibleAvatarUrl?: string
  hasLoadings?: boolean
  loadings?: Loading[]
  createdAt?: Date // Приходит как ISO строка, преобразуется в Date
  updatedAt?: Date // Приходит как ISO строка, преобразуется в Date
}

export interface Department {
  id: string
  name: string
  wsDepartmentId?: string | null
  totalEmployees: number
  dailyWorkloads?: Record<string, number>
  teams: Team[]
  sections?: Section[]
  departmentHeadId?: string | null
  departmentHeadName?: string | null
  departmentHeadEmail?: string | null
  departmentHeadAvatarUrl?: string | null
  managerName?: string
  createdAt?: Date // Приходит как ISO строка, преобразуется в Date
  updatedAt?: Date // Приходит как ISO строка, преобразуется в Date
}

export interface Project {
  id: string
  name: string
  description?: string
  managerId?: string | null
  managerName?: string | null
  leadEngineerId?: string | null
  leadEngineerName?: string | null
  status?: string
  clientId?: string | null
  clientName?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface Stage {
  id: string
  name: string
  description?: string
  projectId?: string | null
  projectName?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface ProjectObject {
  id: string
  name: string
  description?: string
  stageId?: string | null
  stageName?: string | null
  projectId?: string | null
  projectName?: string | null
  responsibleId?: string | null
  responsibleName?: string | null
  startDate?: Date
  endDate?: Date
  createdAt?: Date
  updatedAt?: Date
}
