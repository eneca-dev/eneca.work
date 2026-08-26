/**
 * Sections Page Module - Types
 *
 * Типы для отображения разделов с иерархией Department → Project → ObjectSection → Loadings
 */

// Re-export DayCell from resource-graph for timeline compatibility
export type { DayCell } from '@/modules/resource-graph/components/timeline/TimelineHeader'
export type { CompanyCalendarEvent, TimelineRange } from '@/modules/resource-graph/types'

// ============================================================================
// Domain Types - Hierarchy
// ============================================================================

/**
 * Загрузка сотрудника на раздел
 */
export interface SectionLoading {
  id: string
  sectionId: string
  sectionName: string
  projectId?: string
  projectName?: string
  objectId?: string
  objectName?: string
  stageId: string | null
  stageName: string | null
  employeeId: string
  employeeName: string
  employeeFirstName?: string
  employeeLastName?: string
  employeeEmail?: string
  employeeAvatarUrl?: string
  employeeCategory?: string | null
  employeePosition?: string | null
  employeeEmploymentRate?: number | null
  employeeTeamId: string | null
  employeeDepartmentId: string
  employeeDepartmentName: string
  startDate: string
  endDate: string
  rate: number
  status?: string
  comment?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * Объект/Раздел (merged level)
 * Объединяет объект и раздел в один уровень иерархии
 */
export interface ObjectSection {
  id: string // section_id
  name: string // "object_name / section_name"
  objectId: string
  objectName: string
  sectionId: string
  sectionName: string
  sectionType: string | null
  sectionResponsibleId: string | null
  sectionResponsibleName: string | null
  projectId: string
  projectName: string
  departmentId: string
  departmentName: string
  startDate: string | null
  endDate: string | null
  // Capacity данные
  defaultCapacity: number | null
  capacityOverrides?: Record<string, number> // date -> capacity value
  // Агрегированные данные
  dailyWorkloads?: Record<string, number> // date -> total rate
  loadings: SectionLoading[]
  totalLoadings?: number
}

/**
 * Проект
 */
export interface Project {
  id: string
  name: string
  status?: string
  managerId?: string | null
  managerName?: string | null
  leadEngineerId?: string | null
  leadEngineerName?: string | null
  departmentId: string
  departmentName: string
  stageType?: string | null
  // Агрегированные данные
  totalLoadings: number
  dailyWorkloads?: Record<string, number>
  /**
   * Нет активности (загрузок/сроков разделов) более 3 месяцев и ничего не
   * запланировано вперёд — см. вычисление в getSectionsHierarchy.
   * Такие проекты уходят в свёрнутую группу внизу списка отдела.
   */
  isStale: boolean
  // Актуальность загрузок проекта (для сортировки — см. compareProjectsByActuality)
  /** Есть загрузка, идущая прямо сейчас (её диапазон дат включает сегодня) */
  hasActiveLoadingNow: boolean
  /** Ближайшая дата начала будущей загрузки (если нет текущей) */
  nearestFutureLoadingStart: string | null
  /** Дата окончания самой недавней прошедшей загрузки (если нет текущей и будущей) */
  mostRecentPastLoadingFinish: string | null
  objectSections: ObjectSection[]
}

/**
 * Отдел
 */
export interface Department {
  id: string
  name: string
  subdivisionId?: string | null
  subdivisionName?: string | null
  departmentHeadId?: string | null
  departmentHeadName?: string | null
  departmentHeadEmail?: string | null
  departmentHeadAvatarUrl?: string | null
  // Агрегированные данные
  totalLoadings: number
  /**
   * Весь штат отдела — все профили с department_id = этот отдел, независимо
   * от того, есть ли у них загрузки. Источник — view_organizational_structure
   * (см. modules/departments-timeline). feature-AB-06.
   *
   * `null` — знаменатель недоступен/несопоставим с busyTodayCount: либо запрос
   * штата не удался, либо активен фильтр (team_id/project_id), сужающий
   * busyTodayCount ниже уровня всего отдела — UI в этом случае прячет "из Y".
   */
  departmentHeadcount: number | null
  /** Сколько из штата загружены именно сегодня (диапазон загрузки включает текущую дату). */
  busyTodayCount: number
  /** Из busyTodayCount — сколько заняты ТОЛЬКО служебными "проектами" (Отпуск/Прочие работы/Непроектные загрузки). */
  busyOnNonProjectCount: number
  dailyWorkloads?: Record<string, number>
  projects: Project[]
}

// ============================================================================
// Capacity Types
// ============================================================================

/**
 * Плановая ёмкость раздела
 */
export interface SectionCapacity {
  capacityId?: string
  sectionId: string
  capacityDate: string | null // NULL = default, NOT NULL = date-specific override
  capacityValue: number
  createdAt?: string
  updatedAt?: string
  createdBy?: string
}

/**
 * Input для создания/обновления capacity
 */
export interface CapacityInput {
  sectionId: string
  capacityDate: string | null
  capacityValue: number
}

// ============================================================================
// Loading CRUD Types
// ============================================================================

/**
 * Input для создания загрузки
 */
export interface CreateLoadingInput {
  sectionId: string
  stageId: string | null
  employeeId: string
  startDate: string
  endDate: string
  rate: number
  comment?: string
}

/**
 * Input для обновления загрузки
 */
export interface UpdateLoadingInput {
  loadingId: string
  employeeId?: string
  startDate?: string
  endDate?: string
  rate?: number
  comment?: string
  stageId?: string | null
}

// ============================================================================
// UI Types
// ============================================================================

/**
 * Типы узлов дерева для expand/collapse
 */
export type TreeNodeType = 'department' | 'project' | 'objectSection' | 'employee'

/**
 * Универсальный узел дерева
 */
export interface TreeNode {
  type: TreeNodeType
  id: string
  parentId?: string
}

/**
 * Capacity override для конкретной даты
 */
export interface CapacityOverride {
  date: string
  value: number
}
