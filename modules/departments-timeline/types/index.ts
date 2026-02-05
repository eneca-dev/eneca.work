/**
 * Departments Timeline Module - Types
 *
 * Типы для отображения отделов, команд и сотрудников с загрузками на timeline
 */

// Re-export DayCell from resource-graph for timeline compatibility
export type { DayCell } from '@/modules/resource-graph/components/timeline/TimelineHeader'
export type { CompanyCalendarEvent, TimelineRange } from '@/modules/resource-graph/types'

// ============================================================================
// Domain Types - Hierarchy
// ============================================================================

/**
 * Загрузка сотрудника на проект/раздел
 */
export interface Loading {
  id: string
  projectId?: string
  projectName?: string
  projectStatus?: string
  objectId?: string
  objectName?: string
  sectionId: string | null
  sectionName?: string
  stageId: string
  stageName?: string
  employeeId?: string
  responsibleId?: string
  responsibleName?: string
  responsibleAvatarUrl?: string
  responsibleTeamName?: string
  startDate: string
  endDate: string
  rate: number
  status?: string
  comment?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * Сотрудник в команде
 */
export interface Employee {
  id: string
  name: string
  fullName?: string
  firstName?: string
  lastName?: string
  email?: string
  teamId?: string
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
  // Фантомный сотрудник "Дефицит"
  isShortage?: boolean
  shortageDescription?: string | null
}

/**
 * Команда в отделе
 */
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
}

/**
 * Отдел организации
 */
export interface Department {
  id: string
  name: string
  subdivisionId?: string | null
  subdivisionName?: string | null
  totalEmployees: number
  dailyWorkloads?: Record<string, number>
  teams: Team[]
  departmentHeadId?: string | null
  departmentHeadName?: string | null
  departmentHeadEmail?: string | null
  departmentHeadAvatarUrl?: string | null
  managerName?: string
}

// ============================================================================
// Freshness Types - Team Activity
// ============================================================================

/**
 * Данные актуальности команды
 */
export interface TeamFreshness {
  teamId: string
  teamName: string
  departmentId: string
  departmentName: string
  lastUpdate: string | null
  daysSinceUpdate: number | undefined
}

/**
 * Агрегированные данные актуальности отдела
 */
export interface DepartmentFreshness {
  departmentId: string
  daysSinceUpdate: number
  teamsCount: number
}

// ============================================================================
// Batch Data Types
// ============================================================================

/**
 * Batch данные для команды (загружаются при развороте)
 */
export interface TeamBatchData {
  loadings: Record<string, Loading[]> // employeeId -> loadings
}

/**
 * Опции для batch запроса
 */
export interface TeamBatchOptions {
  includeLoadings?: boolean
}

// ============================================================================
// UI Types
// ============================================================================

/**
 * Типы узлов дерева для expand/collapse
 */
export type TreeNodeType = 'department' | 'team' | 'employee' | 'project'

/**
 * Режим группировки в таймлайне отделов
 * - 'teams' — группировка по командам (Department → Team → Employee)
 * - 'projects' — группировка по проектам (Department → Project → Employee)
 */
export type GroupByMode = 'teams' | 'projects'

/**
 * Универсальный узел дерева
 */
export interface TreeNode {
  type: TreeNodeType
  id: string
  parentId?: string
}

/**
 * Проект с сотрудниками (для режима группировки по проектам)
 */
export interface ProjectGroup {
  projectId: string
  projectName: string
  projectStatus?: string
  employees: Employee[]
  /** Общая загрузка по проекту на каждый день */
  dailyWorkloads?: Record<string, number>
}
