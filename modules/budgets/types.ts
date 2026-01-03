/**
 * Типы для модуля бюджетов (V2)
 *
 * Новая система бюджетов:
 * - Один бюджет на сущность
 * - Разбивка на части (main, premium, custom)
 * - Отслеживание расходов по частям
 * - Workflow согласования для premium части
 */

import type { Database } from '@/types/db'

// ============================================================================
// Database Types
// ============================================================================

export type BudgetsV2Row = Database['public']['Tables']['budgets']['Row']
export type BudgetsV2Insert = Database['public']['Tables']['budgets']['Insert']
export type BudgetsV2Update = Database['public']['Tables']['budgets']['Update']

export type BudgetPartsRow = Database['public']['Tables']['budget_parts']['Row']
export type BudgetPartsInsert = Database['public']['Tables']['budget_parts']['Insert']
export type BudgetPartsUpdate = Database['public']['Tables']['budget_parts']['Update']

export type BudgetExpensesRow = Database['public']['Tables']['budget_expenses']['Row']
export type BudgetExpensesInsert = Database['public']['Tables']['budget_expenses']['Insert']

export type BudgetHistoryRow = Database['public']['Tables']['budget_history']['Row']

// Enum types
export type BudgetEntityType = Database['public']['Enums']['budget_entity_type']
export type BudgetPartType = Database['public']['Enums']['budget_part_type']

// ============================================================================
// View Types
// ============================================================================

export type BudgetV2View = Database['public']['Views']['v_cache_budgets']['Row']
export type BudgetFullView = Database['public']['Views']['v_budgets_full']['Row']
export type BudgetHierarchyView = Database['public']['Views']['v_budget_hierarchy']['Row']

// ============================================================================
// Domain Types
// ============================================================================

/**
 * Часть бюджета (main, premium, custom)
 */
export interface BudgetPart {
  part_id: string
  part_type: BudgetPartType
  custom_name: string | null
  percentage: number | null
  fixed_amount: number | null
  calculated_amount: number
  requires_approval: boolean
  approval_threshold: number | null
  color: string | null
  spent_amount: number
  remaining_amount: number
  spent_percentage: number
}

/**
 * Бюджет с текущими данными (из view v_cache_budgets)
 */
export interface BudgetCurrent {
  budget_id: string
  entity_type: BudgetEntityType
  entity_id: string
  name: string
  total_amount: number
  is_active: boolean
  parent_budget_id: string | null
  created_at: string
  updated_at: string
  // Main part
  main_part_id: string | null
  main_amount: number | null
  main_spent: number
  // Premium part
  premium_part_id: string | null
  premium_amount: number | null
  premium_spent: number
  // Totals
  total_spent: number
  remaining_amount: number
  spent_percentage: number
  // Parent
  parent_name: string | null
  parent_total_amount: number | null
}

/**
 * Полная информация о бюджете с частями (из view v_budgets_full)
 */
export interface BudgetFull {
  budget_id: string
  entity_type: BudgetEntityType
  entity_id: string
  name: string
  description: string | null
  total_amount: number
  is_active: boolean
  parent_budget_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Parent info
  parent_name: string | null
  parent_entity_type: BudgetEntityType | null
  parent_entity_id: string | null
  parent_total_amount: number | null
  // Parts as JSONB array
  parts: BudgetPart[]
  // Totals
  total_spent: number
  remaining_amount: number
  spent_percentage: number
  pending_expenses_count: number
  children_count: number
}

/**
 * Иерархия бюджетов (из view v_budget_hierarchy)
 */
export interface BudgetHierarchy {
  budget_id: string
  entity_type: BudgetEntityType
  entity_id: string
  name: string
  total_amount: number
  parent_budget_id: string | null
  level: number
  path: string[]
  distributed_amount: number
  is_over_distributed: boolean
}

/**
 * Расход бюджета
 */
export interface BudgetExpense {
  expense_id: string
  budget_id: string
  part_id: string | null
  amount: number
  description: string | null
  expense_date: string
  work_log_id: string | null
  status: 'pending' | 'approved' | 'rejected'
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_by: string | null
  created_at: string
}

/**
 * История изменений бюджета
 */
export interface BudgetHistoryEntry {
  history_id: string
  budget_id: string
  change_type: 'created' | 'amount_changed' | 'parts_changed' | 'status_changed'
  previous_state: Record<string, unknown> | null
  new_state: Record<string, unknown> | null
  comment: string | null
  changed_by: string | null
  changed_at: string
}

/**
 * Сводка бюджетов по разделу (из view v_cache_section_budget_summary)
 */
export interface SectionBudgetSummary {
  section_id: string
  section_name: string
  section_project_id: string
  section_object_id: string
  section_responsible: string | null
  budget_count: number
  total_planned: number
  total_spent: number
  remaining: number
  spent_percentage: number
}

// ============================================================================
// Input types для mutations
// ============================================================================

/**
 * Создание нового бюджета
 */
export interface CreateBudgetInput {
  entity_type: BudgetEntityType
  entity_id: string
  name?: string
  total_amount: number
  description?: string
  parent_budget_id?: string | null
}

/**
 * Создание части бюджета
 */
export interface CreateBudgetPartInput {
  budget_id: string
  part_type: BudgetPartType
  custom_name?: string
  fixed_amount?: number
  percentage?: number
  requires_approval?: boolean
  approval_threshold?: number
  color?: string
}

/**
 * Обновление суммы бюджета
 */
export interface UpdateBudgetAmountInput {
  budget_id: string
  total_amount: number
  comment?: string
}

/**
 * Обновление части бюджета
 */
export interface UpdateBudgetPartInput {
  part_id: string
  fixed_amount?: number
  percentage?: number
  requires_approval?: boolean
  approval_threshold?: number
}

/**
 * Создание расхода
 */
export interface CreateExpenseInput {
  budget_id: string
  part_id?: string
  amount: number
  description?: string
  expense_date?: string
  work_log_id?: string
}

/**
 * Одобрение/отклонение расхода
 */
export interface ApproveExpenseInput {
  expense_id: string
  approved: boolean
  rejection_reason?: string
}

/**
 * Иерархия сущности для поиска родительского бюджета
 * Примечание: stage исключён из иерархии бюджетов
 */
export interface EntityHierarchy {
  entityType: BudgetEntityType
  entityId: string
  objectId: string | null
  projectId: string | null
}

// ============================================================================
// Filter types
// ============================================================================

export interface BudgetFilters {
  entity_type?: BudgetEntityType
  entity_id?: string
  is_active?: boolean
}
