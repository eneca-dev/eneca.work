/**
 * Resource Graph Module - Types
 *
 * Типы данных для модуля графика ресурсов
 */

import type { Database } from '@/types/db'

// ============================================================================
// Database Type Helpers
// ============================================================================

/** Извлекает тип строки из view */
export type ViewRow<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']

/** Извлекает тип enum */
export type DbEnum<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]

// ============================================================================
// Database Types (from generated types)
// ============================================================================

/** Строка из view v_resource_graph - полная иерархия проекта */
export type ResourceGraphRow = ViewRow<'v_resource_graph'>

/** Статус проекта из БД */
export type ProjectStatusType = DbEnum<'project_status_enum'>

// ============================================================================
// Domain Types - Иерархия проекта
// ============================================================================

/**
 * Элемент декомпозиции (самый нижний уровень)
 * Project → Stage → Object → Section → DecompositionStage → DecompositionItem
 */
export interface DecompositionItem {
  id: string
  description: string
  plannedHours: number
  plannedDueDate: string | null
  progress: number | null
  order: number
  responsible: {
    id: string | null
    firstName: string | null
    lastName: string | null
    name: string | null
  }
  status: {
    id: string | null
    name: string | null
    color: string | null
  }
  difficulty: {
    id: string | null
    abbr: string | null
    name: string | null
  }
  workCategoryId: string | null
  workCategoryName: string | null
}

/**
 * Этап декомпозиции
 * Project → Stage → Object → Section → DecompositionStage
 */
export interface DecompositionStage {
  id: string
  name: string
  startDate: string | null
  finishDate: string | null
  status: {
    id: string | null
    name: string | null
    color: string | null
  }
  items: DecompositionItem[]
}

/**
 * Раздел проекта
 * Project → Stage → Object → Section
 */
export interface Section {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  responsible: {
    id: string | null
    firstName: string | null
    lastName: string | null
    name: string | null
  }
  status: {
    id: string | null
    name: string | null
    color: string | null
  }
  decompositionStages: DecompositionStage[]
}

/**
 * Объект проекта
 * Project → Stage → Object
 */
export interface ProjectObject {
  id: string
  name: string
  sections: Section[]
}

/**
 * Стадия проекта
 * Project → Stage
 */
export interface Stage {
  id: string
  name: string
  objects: ProjectObject[]
}

/**
 * Проект с полной структурой
 * Project (верхний уровень)
 */
export interface Project {
  id: string
  name: string
  status: ProjectStatusType | null
  manager: {
    id: string | null
    firstName: string | null
    lastName: string | null
    name: string | null
  }
  stages: Stage[]
}

// ============================================================================
// Filter Types (по образцу planning/filters)
// ============================================================================

/** Опция фильтра */
export interface FilterOption {
  id: string
  name: string
  departmentId?: string
  managerId?: string
  subdivisionId?: string
  teamId?: string
}

/** Тег проекта */
export interface ProjectTag {
  id: string
  name: string
  color: string | null
}

/** Тип фильтра */
export type FilterType =
  | 'subdivision'
  | 'manager'
  | 'project'
  | 'stage'
  | 'object'
  | 'section'
  | 'department'
  | 'team'
  | 'employee'

/** Состояние фильтров */
export interface FilterState {
  // Проектный блок
  selectedManagerId: string | null
  selectedProjectId: string | null
  selectedStageId: string | null
  selectedObjectId: string | null
  selectedSectionId: string | null
  // Организационный блок
  selectedSubdivisionId: string | null
  selectedDepartmentId: string | null
  selectedTeamId: string | null
  selectedEmployeeId: string | null
}

/** Фильтры для загрузки данных */
export interface ResourceGraphFilters {
  /** ID менеджера проекта */
  managerId?: string
  /** ID проекта */
  projectId?: string
  /** ID стадии */
  stageId?: string
  /** ID объекта */
  objectId?: string
  /** ID раздела */
  sectionId?: string
  /** ID подразделения */
  subdivisionId?: string
  /** ID департамента */
  departmentId?: string
  /** ID команды */
  teamId?: string
  /** ID сотрудника */
  employeeId?: string
  /** ID тегов проекта (массив для мульти-выбора) */
  tagIds?: string[]
  /** Поиск по названию */
  search?: string
}

// ============================================================================
// View Types - Настройки отображения
// ============================================================================

/** Диапазон временной шкалы */
export interface TimelineRange {
  start: Date
  end: Date
  totalDays: number
}

/** Масштаб временной шкалы */
export type TimelineScale = 'day' | 'week' | 'month' | 'quarter'

/** Настройки отображения */
export interface DisplaySettings {
  scale: TimelineScale
  showWeekends: boolean
  showHolidays: boolean
  compactMode: boolean
}

// ============================================================================
// Tree Node Types - для отображения иерархии
// ============================================================================

/** Тип узла дерева */
export type TreeNodeType =
  | 'project'
  | 'stage'
  | 'object'
  | 'section'
  | 'decomposition_stage'
  | 'decomposition_item'

/** Базовый узел дерева */
export interface TreeNode {
  id: string
  type: TreeNodeType
  name: string
  children?: TreeNode[]
  data?: Record<string, unknown>
}
