/**
 * Project Reports Module
 *
 * Модуль отчетов руководителей проектов (stage reports).
 * Предоставляет функциональность для создания, редактирования, удаления и просмотра отчетов к стадиям.
 *
 * @example
 * ```tsx
 * import { ProjectReportsRow, useStageReports, useSaveStageReport } from '@/modules/project-reports'
 *
 * function MyComponent({ stageId }) {
 *   const { data: reports } = useStageReports(stageId, { enabled: true })
 *   const saveMutation = useSaveStageReport()
 *
 *   return <ProjectReportsRow stageId={stageId} stageName="Stage 1" ... />
 * }
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type { ProjectReport } from './types'

// ============================================================================
// Hooks
// ============================================================================

export {
  useStageReports,
  useStageMetrics,
  useSaveStageReport,
  useDeleteStageReport,
} from './hooks'

// ============================================================================
// Actions
// ============================================================================

export {
  getStageReports,
  calculateStageMetrics,
  upsertStageReport,
  deleteStageReport,
} from './actions'

// ============================================================================
// Components
// ============================================================================

export { ProjectReportsRow } from './components/ProjectReportsRow'

// ============================================================================
// Utils
// ============================================================================

export { transformProfileToCreatedBy } from './utils/profile-transform'
