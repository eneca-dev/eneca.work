/**
 * Timeline Row Components
 *
 * DEPRECATED: This file is a re-export barrel for backward compatibility.
 * Import directly from './rows' and './shared' instead.
 *
 * Original file was 2000+ lines and has been decomposed into:
 * - ./shared/TimelineGrid.tsx - Grid background component
 * - ./shared/ProgressCircle.tsx - Circular progress indicator
 * - ./shared/PeriodBackground.tsx - Resizable period background
 * - ./rows/BaseRow.tsx - Base row component
 * - ./rows/ProjectRow.tsx - Top-level project row
 * - ./rows/StageRow.tsx - Stage row
 * - ./rows/ObjectRow.tsx - Object row with aggregated metrics
 * - ./rows/SectionRow.tsx - Section row with graphs
 * - ./rows/DecompositionStageRow.tsx - Decomposition stage with loadings
 * - ./rows/DecompositionItemRow.tsx - Task item row
 * - ./rows/calculations.ts - Business logic calculations
 */

// Re-export shared components
export { TimelineGrid, ProgressCircle, PeriodBackground } from './shared'

// Re-export row components
export {
  ProjectRow,
  StageRow,
  ObjectRow,
  SectionRow,
  DecompositionStageRow,
  DecompositionItemRow,
  BaseRow,
} from './rows'

// Re-export calculations
export {
  calculateStageReadiness,
  aggregateSectionsMetrics,
  interpolateSectionPlan,
  type StageStats,
  type AggregatedMetrics,
} from './rows'
