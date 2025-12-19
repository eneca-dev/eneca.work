/**
 * Timeline Row Components
 *
 * Иерархические компоненты строк для Timeline:
 * - ProjectRow - верхний уровень (проект)
 * - StageRow - стадия проекта
 * - ObjectRow - объект со сводными метриками
 * - SectionRow - раздел с графиками готовности и бюджета
 * - DecompositionStageRow - этап декомпозиции с загрузками
 * - DecompositionItemRow - задача с work logs
 */

export { ProjectRow } from './ProjectRow'
export { StageRow } from './StageRow'
export { ObjectRow } from './ObjectRow'
export { SectionRow } from './SectionRow'
export { DecompositionStageRow } from './DecompositionStageRow'
export { DecompositionItemRow } from './DecompositionItemRow'
export { BaseRow } from './BaseRow'

// Re-export calculations for use in other components
export {
  calculateStageReadiness,
  aggregateSectionsMetrics,
  interpolateSectionPlan,
  type StageStats,
  type AggregatedMetrics,
} from './calculations'
