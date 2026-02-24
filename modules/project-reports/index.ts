/**
 * Project Reports Module
 *
 * Модуль отчетов руководителей проектов (stage reports).
 * Предоставляет функциональность для создания, редактирования, удаления и просмотра отчетов к стадиям.
 *
 * @example
 * ```tsx
 * import { ProjectReportsRow, useProjectReports, useSaveProjectReport } from '@/modules/project-reports'
 *
 * function MyComponent({ projectId }) {
 *   const { data: reports } = useProjectReports(projectId, { enabled: true })
 *   const saveMutation = useSaveProjectReport()
 *
 *   return <ProjectReportsRow projectId={projectId} projectName="Project 1" ... />
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
  useProjectReports,
  useProjectMetrics,
  useSaveProjectReport,
  useDeleteProjectReport,
} from './hooks'

// ============================================================================
// Actions
// ============================================================================

export {
  getProjectReports,
  calculateProjectMetrics,
  upsertProjectReport,
  deleteProjectReport,
} from './actions'

// ============================================================================
// Components
// ============================================================================

export { ProjectReportsRow } from './components/ProjectReportsRow'

// ============================================================================
// Utils
// ============================================================================

export { transformProfileToCreatedBy } from './utils/profile-transform'
