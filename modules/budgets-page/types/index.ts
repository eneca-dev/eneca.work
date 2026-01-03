/**
 * Budgets Page Module - Types
 *
 * Типы для отображения иерархии с бюджетами (V2)
 */

import type { BudgetEntityType, BudgetPartType } from '@/modules/budgets/types'

// ============================================================================
// Budget Info Types
// ============================================================================

/**
 * Информация о бюджете для отображения в строке
 */
export interface BudgetInfo {
  budget_id: string
  name: string
  /** Общая сумма бюджета (total_amount) */
  planned_amount: number
  /** Сумма расходов */
  spent_amount: number
  /** Остаток */
  remaining_amount: number
  /** Процент освоения */
  spent_percentage: number
  /** ID основной части (main) */
  main_part_id: string | null
  /** Сумма основной части */
  main_amount: number | null
  /** Расходы основной части */
  main_spent: number
  /** ID премиальной части */
  premium_part_id: string | null
  /** Сумма премиальной части */
  premium_amount: number | null
  /** Расходы премиальной части */
  premium_spent: number
  /** @deprecated используй main_part_id и main_amount */
  type_id: string | null
  /** @deprecated используй part_type */
  type_name: string | null
  /** @deprecated используй part colors */
  type_color: string | null
  /** ID родительского бюджета */
  parent_budget_id: string | null
  /** Сумма родительского бюджета для расчёта % */
  parent_planned_amount: number
  is_active: boolean
}

/**
 * Агрегированные бюджеты по типам для прогресс-баров
 */
export interface AggregatedBudgetsByType {
  type_id: string
  type_name: string
  type_color: string
  total_planned: number
  total_spent: number
  percentage: number
}

// ============================================================================
// Hierarchy Node Types
// ============================================================================

/**
 * Тип узла иерархии
 * Note: stage удалён — стадия теперь параметр проекта, а не отдельный уровень иерархии
 */
export type HierarchyNodeType = 'project' | 'object' | 'section' | 'decomposition_stage' | 'decomposition_item'

/**
 * Типы сущностей бюджета
 * Включает: project, object, section, decomposition_stage, decomposition_item
 */
export type BudgetPageEntityType = BudgetEntityType

/**
 * Узел иерархии с бюджетами
 */
export interface HierarchyNode {
  id: string
  name: string
  type: HierarchyNodeType
  /** Код раздела (АР, КР, ОВ) - только для sections */
  code?: string
  /** Стадия проекта (только для project) */
  stageName?: string | null
  /** Бюджеты этого узла */
  budgets: BudgetInfo[]
  /** Агрегированные бюджеты по типам (для прогресс-баров) */
  aggregatedBudgets: AggregatedBudgetsByType[]
  /** Плановые часы (для этапов/разделов/items) */
  plannedHours?: number
  /** Фактические часы (из work_logs) */
  actualHours?: number
  /** Дочерние узлы */
  children: HierarchyNode[]
  /** Entity type для создания бюджета */
  entityType: BudgetPageEntityType
  /** ID типа работ (только для decomposition_item) */
  workCategoryId?: string | null
  /** Название типа работ (только для decomposition_item) */
  workCategoryName?: string | null
  /** Сложность (только для decomposition_item) */
  difficulty?: {
    id: string | null
    abbr: string | null
    name: string | null
  } | null
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Данные аналитики по отфильтрованным бюджетам
 */
export interface BudgetsAnalyticsData {
  /** Общая сумма плановых бюджетов */
  totalPlanned: number
  /** Общая сумма расходов */
  totalSpent: number
  /** Процент освоения */
  spentPercentage: number
  /** Остаток */
  remaining: number

  /** Количество проектов */
  projectsCount: number
  /** Количество разделов */
  sectionsCount: number
  /** Количество этапов */
  stagesCount: number
  /** Количество бюджетов */
  budgetsCount: number

  /** Разбивка по типам бюджетов */
  byType: AggregatedBudgetsByType[]
}

// ============================================================================
// View State Types
// ============================================================================

/**
 * Состояние развёрнутых узлов
 */
export type ExpandedState = Record<string, boolean>

/**
 * Пропсы для внутреннего компонента BudgetsView
 * (передаются из TasksView)
 */
export interface BudgetsViewInternalProps {
  /** Строка фильтра */
  filterString: string
  /** Распарсенные параметры фильтра */
  queryParams: import('@/modules/inline-filter').FilterQueryParams
  /** Конфигурация фильтра (из tasks) */
  filterConfig: import('@/modules/inline-filter').FilterConfig
}
