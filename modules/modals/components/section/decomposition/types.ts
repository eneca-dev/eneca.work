/**
 * Decomposition Module - Types
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Задача декомпозиции
 */
export type Decomposition = {
  id: string
  description: string
  typeOfWork: string
  difficulty: string
  plannedHours: number
  progress: number
}

/**
 * Этап декомпозиции
 */
export type Stage = {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  description: string | null
  statusId: string | null
  responsibles: string[]
  decompositions: Decomposition[]
}

// ============================================================================
// Reference Data Types (re-exported from actions for convenience)
// ============================================================================

export type { WorkCategory } from '../../../actions/getWorkCategories'
export type { DifficultyLevel } from '../../../actions/getDifficultyLevels'
export type { StageStatus } from '../../../actions/getStageStatuses'
export type { Profile, Employee } from '../../../actions/getDecompositionStage'

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props для главного компонента StagesManager
 */
export type StagesManagerProps = {
  sectionId: string
}

/**
 * Props для карточки этапа
 */
export type StageCardProps = {
  stage: Stage
  employees: Employee[]
  workCategories: WorkCategory[]
  difficultyLevels: DifficultyLevel[]
  stageStatuses: StageStatus[]
  actualHoursByItemId: Record<string, number>
  isExpanded: boolean
  onToggleExpand: () => void
  onUpdateStage: (updates: Partial<Stage>) => void
  onDeleteStage: () => void
  onOpenResponsiblesDialog: () => void
  onRemoveResponsible: (userId: string) => void
  onAddDecomposition: () => void
  onUpdateDecomposition: (decompositionId: string, updates: Partial<Decomposition>) => void
  onDeleteDecomposition: (decompositionId: string) => void
  onReorderDecompositions?: (stageId: string, reordered: Decomposition[]) => void
  isDragging?: boolean
}

/**
 * Props для строки декомпозиции
 */
export type DecompositionRowProps = {
  decomposition: Decomposition
  workCategories: WorkCategory[]
  difficultyLevels: DifficultyLevel[]
  actualHours: number
  onUpdate: (updates: Partial<Decomposition>) => void
  onDelete: () => void
}

/**
 * Props для таблицы декомпозиции
 */
export type DecompositionTableProps = {
  decompositions: Decomposition[]
  workCategories: WorkCategory[]
  difficultyLevels: DifficultyLevel[]
  actualHoursByItemId: Record<string, number>
  onUpdateDecomposition: (decompositionId: string, updates: Partial<Decomposition>) => void
  onDeleteDecomposition: (decompositionId: string) => void
  onAddDecomposition: () => void
  onReorderDecompositions?: (reordered: Decomposition[]) => void
  stageId: string
}

/**
 * Props для заголовка этапа
 */
export type StageHeaderProps = {
  stage: Stage
  stageStatuses: StageStatus[]
  isExpanded: boolean
  onToggleExpand: () => void
  onUpdateName: (name: string) => void
  onUpdateDateRange: (start: string | null, end: string | null) => void
  onUpdateStatus: (statusId: string | null) => void
  onDelete: () => void
  plannedHours: number
  actualHours: number
  progress: number
  isDragging?: boolean
}

/**
 * Props для ответственных этапа
 */
export type StageResponsiblesProps = {
  responsibles: string[]
  employees: Employee[]
  onAdd: () => void
  onRemove: (userId: string) => void
}

// ============================================================================
// Dialog Types
// ============================================================================

/**
 * Props для диалога назначения ответственных
 */
export type AssignResponsiblesDialogProps = {
  isOpen: boolean
  onClose: () => void
  employees: Employee[]
  currentResponsibles: string[]
  onAssign: (userIds: string[]) => void
}

/**
 * Props для диалога вставки из Excel
 */
export type PasteDialogProps = {
  isOpen: boolean
  onClose: () => void
  onPaste: (items: ParsedPasteItem[]) => void
  workCategories: WorkCategory[]
  difficultyLevels: DifficultyLevel[]
}

/**
 * Распарсенная строка из вставки Excel
 */
export type ParsedPasteItem = {
  description: string
  typeOfWork: string
  workCategoryId: string
  difficulty: string
  difficultyId: string
  plannedHours: number
}

/**
 * Props для диалога перемещения задач
 */
export type MoveItemsDialogProps = {
  isOpen: boolean
  onClose: () => void
  stages: Stage[]
  currentStageId: string
  selectedItemsCount: number
  onMove: (targetStageId: string | null) => void
}

/**
 * Props для диалога подтверждения удаления
 */
export type DeleteConfirmDialogProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  itemsCount?: number
}

// ============================================================================
// Import type for Employee used in StageResponsibles
// ============================================================================

import type { Employee as EmployeeType } from '../../../actions/getDecompositionStage'
import type { WorkCategory as WorkCategoryType } from '../../../actions/getWorkCategories'
import type { DifficultyLevel as DifficultyLevelType } from '../../../actions/getDifficultyLevels'
import type { StageStatus as StageStatusType } from '../../../actions/getStageStatuses'

// Local aliases for internal use
export type { EmployeeType, WorkCategoryType, DifficultyLevelType, StageStatusType }
