/**
 * Типы для модуля бюджетов
 */

import type { Database } from '@/types/db'

// ============================================================================
// Database Types
// ============================================================================

export type BudgetsV2Row = Database['public']['Tables']['budgets']['Row']
export type BudgetsV2Insert = Database['public']['Tables']['budgets']['Insert']
export type BudgetsV2Update = Database['public']['Tables']['budgets']['Update']

export type BudgetExpensesRow = Database['public']['Tables']['budget_expenses']['Row']
export type BudgetExpensesInsert = Database['public']['Tables']['budget_expenses']['Insert']

export type BudgetHistoryRow = Database['public']['Tables']['budget_history']['Row']

export type BudgetEntityType = Database['public']['Enums']['budget_entity_type']

// ============================================================================
// View Types
// ============================================================================

export type BudgetV2View = Database['public']['Views']['v_cache_budgets']['Row']

// ============================================================================
// Domain Types
// ============================================================================

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
  total_spent: number
  remaining_amount: number
  spent_percentage: number
  parent_name: string | null
  parent_total_amount: number | null
  /** ID проекта — вычисляется через JOIN, null для осиротевших сущностей */
  project_id: string | null
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

// ============================================================================
// Input Types
// ============================================================================

export interface CreateBudgetInput {
  entity_type: BudgetEntityType
  entity_id: string
  name?: string
  total_amount: number
  description?: string
  parent_budget_id?: string | null
}

export interface UpdateBudgetAmountInput {
  budget_id: string
  total_amount: number
  /** Предыдущая сумма — передаётся с клиента чтобы избежать лишнего SELECT в server action */
  previous_amount?: number
  comment?: string
}

export interface CreateExpenseInput {
  budget_id: string
  part_id?: string
  amount: number
  description?: string
  expense_date?: string
  work_log_id?: string
}

export interface ApproveExpenseInput {
  expense_id: string
  approved: boolean
  rejection_reason?: string
}

/**
 * Иерархия сущности для поиска родительского бюджета
 */
export interface EntityHierarchy {
  entityType: BudgetEntityType
  entityId: string
  objectId: string | null
  projectId: string | null
}

// ============================================================================
// Filter Types
// ============================================================================

export interface BudgetFilters {
  entity_type?: BudgetEntityType
  entity_id?: string
  is_active?: boolean
  /** Фильтр по проектам — загружает только бюджеты указанных проектов */
  project_ids?: string[]
}
