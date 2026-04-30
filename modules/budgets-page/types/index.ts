/**
 * Budgets Page Module - Types
 */

import type { BudgetEntityType } from '@/modules/budgets'

// ============================================================================
// Budget Info Types
// ============================================================================

export interface BudgetInfo {
  budget_id: string
  name: string
  planned_amount: number
  spent_amount: number
  remaining_amount: number
  spent_percentage: number
  parent_budget_id: string | null
  parent_planned_amount: number
  is_active: boolean
}

// ============================================================================
// Hierarchy Node Types
// ============================================================================

export type HierarchyNodeType = 'project' | 'object' | 'section' | 'decomposition_stage' | 'decomposition_item'

export type BudgetPageEntityType = BudgetEntityType

export interface ProjectTagInfo {
  tag_id: string
  name: string
  color: string
}

export interface HierarchyNode {
  id: string
  name: string
  type: HierarchyNodeType
  code?: string
  stageName?: string | null
  projectStatus?: string | null
  projectTags?: ProjectTagInfo[]
  budgets: BudgetInfo[]
  /**
   * @deprecated since 2026-04-28 — заменено на loadingHours/calcBudgetFromLoadings.
   * См. docs/deprecated/budgets-planned-hours.md.
   */
  plannedHours?: number
  actualHours?: number
  loadingHours?: number
  calcBudgetFromLoadings?: number
  loadingCount?: number
  loadingErrorsCount?: number
  children: HierarchyNode[]
  entityType: BudgetPageEntityType
  workCategoryId?: string | null
  workCategoryName?: string | null
  difficulty?: {
    id: string | null
    abbr: string | null
    name: string | null
  } | null
  hourlyRate?: number | null
}

// ============================================================================
// View State Types
// ============================================================================

export type ExpandedState = Record<string, boolean>

export interface BudgetsViewInternalProps {
  queryParams: import('@/modules/inline-filter').FilterQueryParams
  loadAllEnabled?: boolean
  onLoadAll?: () => void
}
