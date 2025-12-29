/**
 * Типы для модуля бюджетов
 *
 * После выполнения `npm run db:types` здесь будут импорты из @/types/db
 */

// Тип сущности для полиморфной связи
export type BudgetEntityType = 'section' | 'object' | 'stage' | 'project'

// Тип бюджета (из view v_cache_budget_types)
export interface BudgetType {
  type_id: string
  name: string
  color: string
  description: string | null
  is_active: boolean
  created_at: string
  usage_count: number
}

// Тип бюджета в составе бюджета (упрощённый)
export interface BudgetTypeRef {
  type_id: string
  name: string
  color: string
  description: string | null
}

// Бюджет с текущей версией (из view v_cache_budgets_current)
export interface BudgetCurrent {
  budget_id: string
  entity_type: BudgetEntityType
  entity_id: string
  name: string
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
  // Текущая версия
  version_id: string
  planned_amount: number
  effective_from: string
  version_comment: string | null
  version_created_by: string
  version_created_at: string
  // Расчётные поля
  spent_amount: number
  remaining_amount: number
  spent_percentage: number
  // Тип бюджета (один, не массив)
  type_id: string | null
  type_name: string | null
  type_color: string | null
  type_description: string | null
  // Родительский бюджет
  parent_budget_id: string | null
  parent_name: string | null
  parent_entity_type: BudgetEntityType | null
  parent_entity_id: string | null
  parent_planned_amount: number // Сумма родительского бюджета для расчёта %
}

// Версия бюджета (история)
export interface BudgetVersion {
  version_id: string
  budget_id: string
  planned_amount: number
  effective_from: string
  effective_to: string | null
  comment: string | null
  created_by: string
  created_at: string
}

// Сводка бюджетов по разделу (из view v_cache_section_budget_summary)
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

export interface CreateBudgetInput {
  entity_type: BudgetEntityType
  entity_id: string
  name: string
  planned_amount: number
  comment?: string
  budget_type_id: string // ОБЯЗАТЕЛЬНОЕ поле
  parent_budget_id?: string | null // Родительский бюджет (опционально)
}

// Иерархия сущности для поиска родительского бюджета
export interface EntityHierarchy {
  entityType: BudgetEntityType
  entityId: string
  objectId: string | null
  stageId: string | null
  projectId: string | null
}

export interface UpdateBudgetAmountInput {
  budget_id: string
  planned_amount: number
  comment?: string
}

export interface UpdateBudgetTypeInput {
  budget_id: string
  budget_type_id: string | null
}

export interface CreateBudgetTypeInput {
  name: string
  color?: string
  description?: string
}

export interface UpdateBudgetTypeInput {
  type_id: string
  name?: string
  color?: string
  description?: string
  is_active?: boolean
}

// ============================================================================
// Filter types
// ============================================================================

export interface BudgetFilters {
  entity_type?: BudgetEntityType
  entity_id?: string
  is_active?: boolean
  budget_type_id?: string
}
