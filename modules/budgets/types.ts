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


export type BudgetEntityType = Database['public']['Enums']['budget_entity_type']

// ============================================================================
// View Types
// ============================================================================

export type BudgetV2View = Database['public']['Views']['v_cache_budgets']['Row']
export type BudgetPageView = Database['public']['Views']['v_budgets_for_page']['Row']

// ============================================================================
// Domain Types
// ============================================================================

/**
 * Бюджет с текущими данными.
 * Поля total_spent/remaining_amount/spent_percentage присутствуют только
 * при запросе из v_cache_budgets (resource-graph и модалки).
 * Страница бюджетов использует v_budgets_for_page — lean-вариант без агрегации расходов.
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
  parent_total_amount: number | null
  /** ID проекта — вычисляется через JOIN, null для осиротевших сущностей */
  project_id: string | null
  /** Только в v_cache_budgets (resource-graph, modals) */
  total_spent?: number
  remaining_amount?: number
  spent_percentage?: number
  parent_name?: string | null
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
  /** Использовать v_budgets_for_page вместо v_cache_budgets (страница бюджетов) */
  lean?: boolean
}
