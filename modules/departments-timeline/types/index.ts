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
  /** Visual marker; does not change workload calculations. */
  isProspective?: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * Сотрудник в команде
 */
export interface EmploymentSegment {
  employeeId: string
  departmentId: string | null
  teamId: string | null
  /** Inclusive boundaries, clipped to the requested timeline range. */
  startDate: string
  endDate: string
  employmentRate: number
}

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
  categoryName?: string
  avatarUrl?: string
  workload: number
  employmentRate?: number
  employmentSegments?: EmploymentSegment[]
  /** Original loadings with no intersection with any known employment segment in the requested range. */
  employmentConflicts?: Loading[]
  dailyCapacity?: Record<string, number>
  currentDepartmentId?: string | null
  currentTeamId?: string | null
  /** First day in a different membership; present only on a former membership row. */
  transferredOn?: string
  hasLoadings?: boolean
  loadingsCount?: number
  dailyWorkloads?: Record<string, number>
  loadings?: Loading[]
  // Фантомный сотрудник "Дефицит"
  isShortage?: boolean
  shortageDescription?: string | null
  /**
   * Гостевой сотрудник: его основной department_id отличается от того, в котором
   * он отрисован — он попал сюда через cross-department loading access grant.
   */
  isGuest?: boolean
  /** Название родного отдела, если сотрудник гостевой. Для бейджа в UI. */
  homeDepartmentName?: string
}

/**
 * Команда в отделе
 */
export interface Team {
  dailyCapacity?: Record<string, number>
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
  /**
   * Виртуальная команда для гостевых сотрудников отдела
   * (cross-department loading access grants).
   */
  isGuestTeam?: boolean
}

/**
 * Отдел организации
 */
export interface Department {
  /** Dates before this day use the immutable initial workforce snapshot. */
  employmentCutoverDate?: string
  dailyCapacity?: Record<string, number>
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
export type TreeNodeType = 'department' | 'team' | 'employee'

/**
 * Универсальный узел дерева
 */
export interface TreeNode {
  type: TreeNodeType
  id: string
  parentId?: string
}
