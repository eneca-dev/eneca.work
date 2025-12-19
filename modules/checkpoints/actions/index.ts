/**
 * Checkpoints Module - Server Actions
 *
 * Экспорт всех Server Actions для управления чекпоинтами и типами чекпоинтов
 */

// ============================================================================
// Checkpoint Actions & Types
// ============================================================================

export {
  // Actions
  getCheckpoints,
  getCheckpoint,
  getCheckpointAudit,
  createCheckpoint,
  updateCheckpoint,
  completeCheckpoint,
  deleteCheckpoint,

  // Types
  type Checkpoint,
  type AuditEntry,
  type CreateCheckpointInput,
  type UpdateCheckpointInput,
  type CompleteCheckpointInput,
} from './checkpoints'

// ============================================================================
// Checkpoint Types Actions & Types
// ============================================================================

export {
  // Actions
  getCheckpointTypes,
  createCheckpointType,
  updateCheckpointType,
  deleteCheckpointType,

  // Types
  type CheckpointType,
  type CreateCheckpointTypeInput,
  type UpdateCheckpointTypeInput,
} from './checkpoint-types'
