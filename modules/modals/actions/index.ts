/**
 * Modals Module - Server Actions
 */

// Section
export { updateSection, type UpdateSectionInput } from './updateSection'

// Reference data
export { getWorkCategories, type WorkCategory } from './getWorkCategories'
export { getDifficultyLevels, type DifficultyLevel } from './getDifficultyLevels'
export { getStageStatuses, type StageStatus } from './getStageStatuses'

// Decomposition bootstrap & queries
export {
  getDecompositionBootstrap,
  getEmployees,
  getWorkLogsAggregate,
  type DecompositionItem,
  type DecompositionStage,
  type DecompositionBootstrapData,
  type Profile,
  type Employee,
} from './getDecompositionStage'

// Decomposition stages mutations
export {
  createDecompositionStage,
  updateDecompositionStage,
  deleteDecompositionStage,
  reorderDecompositionStages,
  type CreateStageInput,
  type UpdateStageInput,
  type ReorderStagesInput,
  type StageResult,
} from './updateDecompositionStage'

// Decomposition items mutations
export {
  createDecompositionItem,
  updateDecompositionItem,
  deleteDecompositionItem,
  moveDecompositionItems,
  reorderDecompositionItems,
  bulkCreateDecompositionItems,
  bulkDeleteDecompositionItems,
  type CreateItemInput,
  type UpdateItemInput,
  type MoveItemsInput,
  type ReorderItemsInput,
  type ItemResult,
} from './updateDecompositionItem'
