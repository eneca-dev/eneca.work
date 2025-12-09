/**
 * Resource Graph Module - Public API
 *
 * Модуль графика ресурсов
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
 * import type { Project, ResourceGraphFilters, ResourceGraphRow } from '@/modules/resource-graph'
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
} from './hooks'

// ============================================================================
// Stores
// ============================================================================

export {
  useDisplaySettingsStore,
  useFiltersStore,
  useUIStateStore,
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
} from './actions'

// ============================================================================
// Filters
// ============================================================================

export {
  ResourceGraphFilters,
  FilterSelect,
  useManagerOptions,
  useProjectOptions,
  useStageOptions,
  useObjectOptions,
  useSectionOptions,
  useSubdivisionOptions,
  useDepartmentOptions,
  useTeamOptions,
  useEmployeeOptions,
  useOrgStructure,
  useProjectStructure,
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
  // Filter types
  FilterOption,
  FilterType,
  FilterState,
  ResourceGraphFilters,
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
} from './utils'

// ============================================================================
// Constants
// ============================================================================

export {
  TIMELINE_SCALES,
  RATE_COLORS,
  LOADING_STATUS_COLORS,
  ROW_HEIGHT,
  DAY_CELL_WIDTH,
  SIDEBAR_WIDTH,
  DEFAULT_MONTHS_RANGE,
  DEFAULT_DISPLAY_SETTINGS,
} from './constants'
