/**
 * Budgets Page Module
 *
 * Отображение иерархии проектов с бюджетами.
 * Интегрируется в модуль tasks как вкладка "Бюджеты".
 *
 * @example
 * ```tsx
 * import { BudgetsViewInternal } from '@/modules/budgets-page'
 *
 * <BudgetsViewInternal
 *   filterString={filterString}
 *   queryParams={queryParams}
 *   filterConfig={TASKS_FILTER_CONFIG}
 * />
 * ```
 */

// Components
export { BudgetsViewInternal } from './components'

// Types
export type {
  BudgetInfo,
  AggregatedBudgetsByType,
  HierarchyNode,
  HierarchyNodeType,
  BudgetPageEntityType,
  BudgetsAnalyticsData,
  ExpandedState,
  BudgetsViewInternalProps,
} from './types'

// Hooks
export { useBudgetsHierarchy } from './hooks'
export type { UseBudgetsHierarchyResult } from './hooks'

// Utils
// export { aggregateBudgetsByType, calculateAnalytics } from './utils' // TODO: Этап 5
