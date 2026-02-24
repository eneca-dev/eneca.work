/**
 * Decomposition Module - Public API
 */

// Types
export type {
  Stage,
  Decomposition,
  WorkCategory,
  DifficultyLevel,
  StageStatus,
  Profile,
  Employee,
  StagesManagerProps,
  StageCardProps,
  DecompositionRowProps,
  DecompositionTableProps,
  StageHeaderProps,
  StageResponsiblesProps,
  AssignResponsiblesDialogProps,
  PasteDialogProps,
  ParsedPasteItem,
  MoveItemsDialogProps,
  DeleteConfirmDialogProps,
} from './types'

// Constants
export {
  LABEL_TO_CATEGORY_MAP,
  CATEGORY_TO_LABEL_MAP,
  DIFFICULTY_ABBR_MAP,
  MIN_PANEL_WIDTH,
  DECOMPOSITION_TABLE_COLUMNS,
  DEFAULT_DECOMPOSITION,
  DEFAULT_STAGE,
  PROGRESS_THRESHOLDS,
} from './constants'

// Utils
export {
  // Date utils
  parseISODateString,
  formatISODateString,
  formatDisplayDate,
  // Hour distribution
  distributeHours,
  // Color utils
  getDifficultyColor,
  getProgressColor,
  getStatusColor,
  getProgressBarColor,
  // Stage calculations
  calculateStagePlannedHours,
  calculateStageActualHours,
  calculateStageProgress,
  calculateTotalStats,
  // ID generation
  generateTempId,
  isTempId,
  // Sorting
  sortStagesByOrder,
  sortDecompositionsByOrder,
  // Validation
  validateStage,
  validateDecomposition,
} from './utils'

// Components
export { StagesManager } from './StagesManager'
export { StageCard } from './StageCard'
export { StageHeader } from './StageHeader'
export { StageResponsibles } from './StageResponsibles'
export { DecompositionTable } from './DecompositionTable'
export { DecompositionRow } from './DecompositionRow'

// Dialogs
export {
  AssignResponsiblesDialog,
  DeleteConfirmDialog,
  MoveItemsDialog,
  PasteDialog,
} from './dialogs'
