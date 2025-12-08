export interface Loading {
  id: string
  projectId?: string
  projectName?: string
  projectStatus?: string
  sectionId: string | null
  sectionName?: string
  stageId: string // ОБЯЗАТЕЛЬНОЕ поле - загрузка всегда привязана к этапу
  stageName?: string // Название этапа для отображения
  employeeId?: string
  responsibleId?: string
  responsibleName?: string
  responsibleAvatarUrl?: string
  responsibleTeamName?: string
  startDate: Date // Приходит как ISO строка, преобразуется в Date
  endDate: Date   // Приходит как ISO строка, преобразуется в Date
  rate: number
  status?: string
  // Необязательный комментарий к загрузке (создаётся на клиенте; для полной поддержки нужен столбец loading_comment в БД и выдача в представлениях)
  comment?: string
  createdAt: Date // Приходит как ISO строка, преобразуется в Date
  updatedAt: Date // Приходит как ISO строка, преобразуется в Date
}

export interface PlannedLoading {
  id: string
  sectionId: string | null
  startDate: Date
  endDate: Date
  rate: number
  categoryId: string | null
  categoryName?: string
  stageId?: string | null
  status?: string
  createdAt?: Date
  updatedAt?: Date
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
  loadings?: Loading[]
  createdAt?: Date // Приходит как ISO строка, преобразуется в Date
  updatedAt?: Date // Приходит как ISO строка, преобразуется в Date
  // Фантомный сотрудник "Дефицит ..."
  isShortage?: boolean
  shortageDescription?: string | null
}

export interface DecompositionStage {
  id: string
  name: string
  start: Date | null
  finish: Date | null
  color?: string
  // Статистика уровней сложности для этапа (агрегирована в БД)
  difficultyStats?: StageDifficultyStat[]
}

// Агрегированная статистика по уровням сложности этапа
export interface StageDifficultyStat {
  difficulty_id: string | null
  difficulty_abbr: string
  difficulty_definition: string
  difficulty_weight: number
  items_count: number
  planned_hours: number
  weighted_hours: number
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
  // ID ответственного за раздел (для сортировки и меток)
  responsibleId?: string
  responsibleName?: string
  responsibleAvatarUrl?: string
  hasLoadings?: boolean
  loadings?: Loading[]
  // Этапы декомпозиции раздела
  decompositionStages?: DecompositionStage[]
  // Плановые загрузки (по категориям специалистов)
  plannedLoadings?: PlannedLoading[]
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

// Агрегированное саммари проекта из представления view_project_summary
export interface ProjectSummary {
  projectId: string
  projectName: string
  projectStatus?: string | null
  projectCreated?: Date | null
  clientId?: string | null
  clientName?: string | null
  managerId?: string | null
  managerName?: string | null
  projectStartDate?: Date | null
  projectEndDate?: Date | null
  sectionsCount: number
  // Метрики на сегодня
  employeesWithLoadingsToday: number
  loadingsCountToday: number
  totalLoadingRateToday: number
  // Метрики по всем активным загрузкам
  employeesWithLoadingsActive: number
  loadingsCountActive: number
  totalLoadingRateActive: number
  // Суммарная вовлеченность
  engagedEmployeesTotal: number
}

// Данные актуальности (freshness) команды из view_planning_team_freshness
export interface TeamFreshness {
  teamId: string
  teamName: string
  departmentId: string
  departmentName: string
  lastUpdate: Date | null
  daysSinceUpdate: number | undefined
}

// Агрегированные данные актуальности отдела (вычисляется на клиенте)
export interface DepartmentFreshness {
  departmentId: string
  daysSinceUpdate: number  // MAX среди команд отдела (worst case)
  teamsCount: number
}
// Единица таймлайна (день на временной шкале)
export interface TimelineUnit {
  date: Date
  label: string
  isWeekend?: boolean
  isWorkingDay?: boolean
  width?: number
  left?: number
}