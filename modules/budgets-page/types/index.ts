/**
 * Budgets Page Module - Types
 *
 * Типы для отображения иерархии с бюджетами
 */

import type { BudgetEntityType } from '@/modules/budgets/types'

// ============================================================================
// Budget Info Types
// ============================================================================

/**
 * Информация о бюджете для отображения в строке
 */
export interface BudgetInfo {
  budget_id: string
  name: string
  planned_amount: number
  spent_amount: number
  remaining_amount: number
  spent_percentage: number
  type_id: string | null
  type_name: string | null
  type_color: string | null
  parent_budget_id: string | null
  parent_planned_amount: number // Сумма родительского бюджета для расчёта %
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
 */
export type HierarchyNodeType = 'project' | 'stage' | 'object' | 'section' | 'decomposition_stage'

/**
 * Узел иерархии с бюджетами
 */
export interface HierarchyNode {
  id: string
  name: string
  type: HierarchyNodeType
  /** Код раздела (АР, КР, ОВ) - только для sections */
  code?: string
  /** Бюджеты этого узла */
  budgets: BudgetInfo[]
  /** Агрегированные бюджеты по типам (для прогресс-баров) */
  aggregatedBudgets: AggregatedBudgetsByType[]
  /** Плановые часы (для этапов/разделов) */
  plannedHours?: number
  /** Фактические часы (из work_logs) */
  actualHours?: number
  /** Дочерние узлы */
  children: HierarchyNode[]
  /** Entity type для создания бюджета */
  entityType: BudgetEntityType
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
