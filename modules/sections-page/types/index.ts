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
  totalSections: number
  totalLoadings: number
  dailyWorkloads?: Record<string, number>
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
  totalProjects: number
  totalSections: number
  totalLoadings: number
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
