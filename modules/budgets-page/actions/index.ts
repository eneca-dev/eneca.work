/**
 * Budgets Page Module - Server Actions
 *
 * Public API для Server Actions модуля.
 */

// Decomposition Actions (BP-005)
export {
  createDecompositionStage,
  deleteDecompositionStage,
  createDecompositionItem,
  deleteDecompositionItem,
  updateItemPlannedHours,
  updateItemCategory,
  updateItemDifficulty,
  type CreateStageInput,
  type DeleteStageInput,
  type CreateItemInput,
  type DeleteItemInput,
  type UpdateItemHoursInput,
  type UpdateItemCategoryInput,
  type UpdateItemDifficultyInput,
  type CreatedStage,
  type CreatedItem,
} from './decomposition'

// Reference Data Actions
export {
  getDifficultyLevels,
  getWorkCategoriesForBudgets,
  type DifficultyLevel,
  type WorkCategory,
} from './reference-data'

// Sync Actions (Work → Worksection)
export {
  syncProjectToWorksection,
  type SyncProjectInput,
  type SyncResult,
  type SyncEntityStats,
} from './sync-actions'
