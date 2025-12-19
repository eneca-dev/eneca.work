/**
 * Kanban Module - Public API
 *
 * Модуль канбан-доски для управления разделами проектов.
 */

// ============================================================================
// Components
// ============================================================================

export { KanbanBoard } from './components'

// ============================================================================
// Stores
// ============================================================================

export {
  useKanbanStore,
  useKanbanFiltersStore,
  KANBAN_FILTER_CONFIG,
} from './stores'

// ============================================================================
// Hooks (Cache)
// ============================================================================

export { useKanbanSections, useKanbanSection } from './hooks'

// ============================================================================
// Filters
// ============================================================================

export { useKanbanFilterOptions } from './filters/useFilterOptions'

// ============================================================================
// Actions (Server Actions - обычно не экспортируются напрямую)
// ============================================================================

// Server Actions используются через hooks, но можно экспортировать при необходимости
// export { getKanbanSections, updateStageStatus } from './actions'

// ============================================================================
// Types
// ============================================================================

export type {
  KanbanBoard as KanbanBoardType,
  KanbanSection,
  KanbanStage,
  KanbanTask,
  KanbanColumn,
  KanbanViewSettings,
  StageStatus,
  SectionStatus,
  DragResult,
} from './types'

// ============================================================================
// Schemas
// ============================================================================

export {
  stageStatusSchema,
  sectionStatusSchema,
  updateTaskProgressSchema,
  updateStageStatusSchema,
  kanbanFiltersSchema,
} from './schemas'

export type {
  StageStatusSchema,
  SectionStatusSchema,
  UpdateTaskProgressInput,
  UpdateStageStatusInput,
  KanbanFiltersInput,
} from './schemas'

// ============================================================================
// Constants
// ============================================================================

export {
  KANBAN_COLUMNS,
  SECTION_STATUSES,
  getColumnById,
  getColumnIndex,
} from './constants'
