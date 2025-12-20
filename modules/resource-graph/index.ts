/**
 * Resource Graph Module - Public API
 *
 * Модуль графика ресурсов с инлайн-фильтрами
 *
 * @example
 * // Import component
 * import { ResourceGraph } from '@/modules/resource-graph'
 *
 * // Import hooks
 * import { useResourceGraphData } from '@/modules/resource-graph'
 *
 * // Import stores
 * import { useDisplaySettingsStore, useFiltersStore, useUIStateStore } from '@/modules/resource-graph'
 *
 * // Import types
 * import type { Project, ResourceGraphRow } from '@/modules/resource-graph'
 */

// ============================================================================
// Components
// ============================================================================

export { ResourceGraph, ResourceGraphTimeline } from './components'

// ============================================================================
// Hooks
// ============================================================================

export {
  useResourceGraphData,
  useUserWorkload,
  useTagOptions,
  useWorkLogs,
  useLoadings,
  useStageReadiness,
} from './hooks'

// ============================================================================
// Stores
// ============================================================================

export {
  useDisplaySettingsStore,
  useFiltersStore,
  useUIStateStore,
  RESOURCE_GRAPH_FILTER_CONFIG,
} from './stores'

// ============================================================================
// Actions (Server Actions)
// ============================================================================

export {
  getResourceGraphData,
  getUserWorkload,
  getOrgStructure,
  getProjectStructure,
  getProjectTags,
  getWorkLogsForSection,
  getLoadingsForSection,
  getStageReadinessSnapshots,
  getStageReadinessForSection,
} from './actions'

// ============================================================================
// Filters
// ============================================================================

export {
  useOrgStructure,
  useProjectStructure,
  useProjectTags,
  useFilterOptions,
} from './filters'

// ============================================================================
// Types
// ============================================================================

export type {
  // Database types
  ResourceGraphRow,
  ProjectStatusType,
  ViewRow,
  DbEnum,
  // Domain types - hierarchy
  DecompositionItem,
  DecompositionStage,
  Section,
  ProjectObject,
  Stage,
  Project,
  // Work logs
  WorkLog,
  // Loadings
  Loading,
  // Filter types
  ProjectTag,
  // View types
  TimelineRange,
  TimelineScale,
  DisplaySettings,
  // Tree types
  TreeNodeType,
  TreeNode,
} from './types'

// ============================================================================
// Utilities
// ============================================================================

export {
  createTimelineRange,
  generateTimelineDates,
  formatTimelineHeader,
  calculateItemPosition,
  isWeekend,
  getWeekBounds,
  transformRowsToHierarchy,
  // Employee colors
  EMPLOYEE_COLORS,
  getEmployeeColor,
  getInitials,
} from './utils'

// ============================================================================
// Constants
// ============================================================================

export {
  TIMELINE_SCALES,
  RATE_COLORS,
  LOADING_STATUS_COLORS,
  ROW_HEIGHT,
  SECTION_ROW_HEIGHT,
  STAGE_ROW_HEIGHT,
  DAY_CELL_WIDTH,
  SIDEBAR_WIDTH,
  DEFAULT_MONTHS_RANGE,
  DEFAULT_DISPLAY_SETTINGS,
} from './constants'
