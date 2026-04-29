/**
 * Budgets Hierarchy Hook
 *
 * Загружает иерархию проектов с бюджетами для отображения в BudgetsView.
 * Использует существующие данные из resource-graph и budgets модулей.
 */

'use client'

import { useMemo, useCallback } from 'react'
import { useResourceGraphData } from '@/modules/resource-graph'
import { useBudgets } from '@/modules/budgets'
import type { FilterQueryParams } from '@/modules/inline-filter'
import type {
  HierarchyNode,
  HierarchyNodeType,
  BudgetInfo,
  AggregatedBudgetsByType,
  BudgetsAnalyticsData,
} from '../types'
import type { Project, ProjectObject, Section, DecompositionStage, DecompositionItem } from '@/modules/resource-graph'
import type { BudgetCurrent } from '@/modules/budgets'
import { useSectionCalcBudgets } from './use-section-calc-budgets'

/** Агрегат расчёта по разделу из v_cache_section_calc_budget */
interface SectionCalcSummary {
  loadingHours: number
  calcBudget: number
  loadingCount: number
  errorsCount: number
}

// ============================================================================
// Budget Transformation Helpers
// ============================================================================

/**
 * Преобразует BudgetCurrent (V2) в BudgetInfo
 * Note: PostgreSQL numeric приходит как string, поэтому явно конвертируем в number
 */
function toBudgetInfo(budget: BudgetCurrent): BudgetInfo {
  const toNumber = (val: number | string | null | undefined): number => {
    if (val === null || val === undefined) return 0
    return typeof val === 'string' ? parseFloat(val) || 0 : val
  }

  return {
    budget_id: budget.budget_id,
    name: budget.name,
    planned_amount: toNumber(budget.total_amount),
    spent_amount: toNumber(budget.total_spent),
    remaining_amount: toNumber(budget.remaining_amount),
    spent_percentage: toNumber(budget.spent_percentage),
    parent_budget_id: budget.parent_budget_id,
    parent_planned_amount: toNumber(budget.parent_total_amount),
    is_active: budget.is_active,
  }
}

/**
 * Агрегирует бюджеты по типам для прогресс-баров
 */
function aggregateBudgetsByType(budgets: BudgetInfo[]): AggregatedBudgetsByType[] {
  const byType = new Map<string, AggregatedBudgetsByType>()

  for (const budget of budgets) {
    if (!budget.type_id || !budget.type_name) continue

    const existing = byType.get(budget.type_id)
    if (existing) {
      existing.total_planned += budget.planned_amount
      existing.total_spent += budget.spent_amount
    } else {
      byType.set(budget.type_id, {
        type_id: budget.type_id,
        type_name: budget.type_name,
        type_color: budget.type_color || '#6b7280',
        total_planned: budget.planned_amount,
        total_spent: budget.spent_amount,
        percentage: 0,
      })
    }
  }

  // Вычисляем проценты
  const result = Array.from(byType.values())
  for (const item of result) {
    item.percentage = item.total_planned > 0
      ? Math.round((item.total_spent / item.total_planned) * 100)
      : 0
  }

  return result
}

/**
 * Рекурсивно агрегирует бюджеты вверх по иерархии
 */
function aggregateBudgetsUpward(node: HierarchyNode): AggregatedBudgetsByType[] {
  // Начинаем с собственных бюджетов
  const allBudgets = [...node.budgets]

  // Добавляем бюджеты всех детей рекурсивно
  for (const child of node.children) {
    // Рекурсивно получаем бюджеты ребёнка
    const childBudgets = collectAllBudgets(child)
    allBudgets.push(...childBudgets)
  }

  return aggregateBudgetsByType(allBudgets)
}

/**
 * Собирает все бюджеты из узла и всех его потомков
 */
function collectAllBudgets(node: HierarchyNode): BudgetInfo[] {
  const result: BudgetInfo[] = [...node.budgets]
  for (const child of node.children) {
    result.push(...collectAllBudgets(child))
  }
  return result
}

// ============================================================================
// Hierarchy Transformation
// ============================================================================

/**
 * Преобразует DecompositionItem в HierarchyNode
 */
function transformDecompositionItem(
  item: DecompositionItem,
  budgetsMap: Map<string, BudgetInfo[]>
): HierarchyNode {
  const nodeBudgets = budgetsMap.get(`decomposition_item:${item.id}`) || []

  return {
    id: item.id,
    name: item.description,
    type: 'decomposition_item',
    budgets: nodeBudgets,
    aggregatedBudgets: aggregateBudgetsByType(nodeBudgets),
    plannedHours: item.plannedHours,
    children: [],
    entityType: 'decomposition_item',
    workCategoryId: item.workCategoryId,
    workCategoryName: item.workCategoryName,
    difficulty: item.difficulty ? {
      id: item.difficulty.id,
      abbr: item.difficulty.abbr,
      name: item.difficulty.name,
    } : null,
  }
}

/**
 * Преобразует DecompositionStage в HierarchyNode
 */
function transformDecompositionStage(
  stage: DecompositionStage,
  budgetsMap: Map<string, BudgetInfo[]>
): HierarchyNode {
  // Трансформируем items в дочерние узлы
  const children = stage.items.map(item => transformDecompositionItem(item, budgetsMap))

  // Плановые часы = сумма plannedHours всех items
  const plannedHours = stage.items.reduce((sum, item) => sum + (item.plannedHours || 0), 0)

  const nodeBudgets = budgetsMap.get(`decomposition_stage:${stage.id}`) || []

  const node: HierarchyNode = {
    id: stage.id,
    name: stage.name,
    type: 'decomposition_stage',
    budgets: nodeBudgets,
    aggregatedBudgets: [],
    plannedHours,
    children,
    entityType: 'decomposition_stage',
  }

  // Агрегируем бюджеты вверх (включая детей)
  node.aggregatedBudgets = aggregateBudgetsUpward(node)

  return node
}

/**
 * Преобразует Section в HierarchyNode
 */
function transformSection(
  section: Section,
  budgetsMap: Map<string, BudgetInfo[]>,
  calcMap: Map<string, SectionCalcSummary>
): HierarchyNode {
  const children = section.decompositionStages.map(stage =>
    transformDecompositionStage(stage, budgetsMap)
  )

  // Плановые часы (deprecated) = сумма часов всех items декомпозиции
  const plannedHours = children.reduce((sum, child) => sum + (child.plannedHours || 0), 0)

  const nodeBudgets = budgetsMap.get(`section:${section.id}`) || []

  // Новый расчёт из loadings (v_cache_section_calc_budget)
  const calc = calcMap.get(section.id)

  const node: HierarchyNode = {
    id: section.id,
    name: section.name,
    type: 'section',
    budgets: nodeBudgets,
    aggregatedBudgets: [], // Будет вычислено ниже
    plannedHours,
    loadingHours: calc?.loadingHours ?? 0,
    calcBudgetFromLoadings: calc?.calcBudget ?? 0,
    loadingCount: calc?.loadingCount ?? 0,
    loadingErrorsCount: calc?.errorsCount ?? 0,
    children,
    entityType: 'section',
    hourlyRate: section.hourlyRate,
  }

  // Агрегируем бюджеты вверх (включая детей)
  node.aggregatedBudgets = aggregateBudgetsUpward(node)

  return node
}

/**
 * Преобразует ProjectObject в HierarchyNode
 */
function transformObject(
  object: ProjectObject,
  budgetsMap: Map<string, BudgetInfo[]>,
  calcMap: Map<string, SectionCalcSummary>
): HierarchyNode {
  const children = object.sections.map(section =>
    transformSection(section, budgetsMap, calcMap)
  )

  const plannedHours = children.reduce((sum, child) => sum + (child.plannedHours || 0), 0)

  // Агрегация по children (sections и ниже)
  const loadingHours = children.reduce((sum, c) => sum + (c.loadingHours || 0), 0)
  const calcBudgetFromLoadings = children.reduce((sum, c) => sum + (c.calcBudgetFromLoadings || 0), 0)
  const loadingCount = children.reduce((sum, c) => sum + (c.loadingCount || 0), 0)
  const loadingErrorsCount = children.reduce((sum, c) => sum + (c.loadingErrorsCount || 0), 0)

  const nodeBudgets = budgetsMap.get(`object:${object.id}`) || []

  const node: HierarchyNode = {
    id: object.id,
    name: object.name,
    type: 'object',
    budgets: nodeBudgets,
    aggregatedBudgets: [],
    plannedHours,
    loadingHours,
    calcBudgetFromLoadings,
    loadingCount,
    loadingErrorsCount,
    children,
    entityType: 'object',
  }

  node.aggregatedBudgets = aggregateBudgetsUpward(node)

  return node
}

/**
 * Преобразует Project в HierarchyNode
 * Иерархия: Project → Object → Section → DecompositionStage
 */
function transformProject(
  project: Project,
  budgetsMap: Map<string, BudgetInfo[]>,
  calcMap: Map<string, SectionCalcSummary>
): HierarchyNode {
  // Объекты напрямую под проектом (без промежуточного уровня Stage)
  const children = project.objects.map(object =>
    transformObject(object, budgetsMap, calcMap)
  )

  const plannedHours = children.reduce((sum, child) => sum + (child.plannedHours || 0), 0)
  const loadingHours = children.reduce((sum, c) => sum + (c.loadingHours || 0), 0)
  const calcBudgetFromLoadings = children.reduce((sum, c) => sum + (c.calcBudgetFromLoadings || 0), 0)
  const loadingCount = children.reduce((sum, c) => sum + (c.loadingCount || 0), 0)
  const loadingErrorsCount = children.reduce((sum, c) => sum + (c.loadingErrorsCount || 0), 0)

  const nodeBudgets = budgetsMap.get(`project:${project.id}`) || []

  const node: HierarchyNode = {
    id: project.id,
    name: project.name,
    type: 'project',
    stageName: project.stageType,
    projectStatus: project.status,
    projectTags: project.tags?.map(tag => ({
      tag_id: tag.id,
      name: tag.name,
      color: tag.color || '#6b7280',
    })),
    budgets: nodeBudgets,
    aggregatedBudgets: [],
    plannedHours,
    loadingHours,
    calcBudgetFromLoadings,
    loadingCount,
    loadingErrorsCount,
    children,
    entityType: 'project',
  }

  node.aggregatedBudgets = aggregateBudgetsUpward(node)

  return node
}

// ============================================================================
// Analytics Calculation
// ============================================================================

/**
 * Собирает все бюджеты из узла и всех потомков рекурсивно
 */
function collectAllBudgetsFromNode(node: HierarchyNode): BudgetInfo[] {
  const result: BudgetInfo[] = [...node.budgets]
  for (const child of node.children) {
    result.push(...collectAllBudgetsFromNode(child))
  }
  return result
}

/**
 * Вычисляет аналитику по всем узлам иерархии
 *
 * План = сумма planned_amount бюджетов БЕЗ parent_budget_id (корневые/выделенные)
 * Факт = сумма spent_amount ВСЕХ бюджетов
 *
 * Это исключает двойной подсчёт: распределённые бюджеты (с parent) не добавляются к плану,
 * но их расходы учитываются в факте.
 */
function calculateAnalytics(nodes: HierarchyNode[]): BudgetsAnalyticsData {
  let totalPlanned = 0
  let totalSpent = 0
  let projectsCount = 0
  let sectionsCount = 0
  let stagesCount = 0
  let budgetsCount = 0

  const byTypeMap = new Map<string, AggregatedBudgetsByType>()

  // Собираем все бюджеты из всех проектов
  for (const node of nodes) {
    if (node.type === 'project') {
      projectsCount++

      // Собираем все бюджеты проекта и его потомков
      const allBudgets = collectAllBudgetsFromNode(node)

      for (const budget of allBudgets) {
        budgetsCount++

        // План = только корневые бюджеты (без parent_budget_id)
        if (!budget.parent_budget_id) {
          totalPlanned += budget.planned_amount
        }

        // Факт = spent всех бюджетов
        totalSpent += budget.spent_amount

        // Группируем по типам (только корневые для плана)
        if (budget.type_id && budget.type_name && !budget.parent_budget_id) {
          const existing = byTypeMap.get(budget.type_id)
          if (existing) {
            existing.total_planned += budget.planned_amount
            existing.total_spent += budget.spent_amount
          } else {
            byTypeMap.set(budget.type_id, {
              type_id: budget.type_id,
              type_name: budget.type_name,
              type_color: budget.type_color || '#6b7280',
              total_planned: budget.planned_amount,
              total_spent: budget.spent_amount,
              percentage: 0,
            })
          }
        }
      }
    }
  }

  // Считаем секции и этапы для статистики
  function countNodes(node: HierarchyNode) {
    if (node.type === 'section') sectionsCount++
    if (node.type === 'decomposition_stage') stagesCount++
    for (const child of node.children) {
      countNodes(child)
    }
  }
  for (const node of nodes) {
    countNodes(node)
  }

  // Вычисляем проценты
  const byType = Array.from(byTypeMap.values())
  for (const item of byType) {
    item.percentage = item.total_planned > 0
      ? Math.round((item.total_spent / item.total_planned) * 100)
      : 0
  }

  return {
    totalPlanned,
    totalSpent,
    spentPercentage: totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0,
    remaining: totalPlanned - totalSpent,
    projectsCount,
    sectionsCount,
    stagesCount,
    budgetsCount,
    byType,
  }
}

// ============================================================================
// Main Hook
// ============================================================================

export interface UseBudgetsHierarchyResult {
  /** Иерархия узлов с бюджетами */
  nodes: HierarchyNode[]
  /** Агрегированная аналитика */
  analytics: BudgetsAnalyticsData
  /** Загрузка данных */
  isLoading: boolean
  /** Ошибка */
  error: Error | null
  /** Функция для обновления данных */
  refetch: () => void
}

/**
 * Хук для получения иерархии проектов с бюджетами
 *
 * Объединяет данные из:
 * - useResourceGraphData (иерархия проектов)
 * - useBudgets (все бюджеты)
 *
 * @param filters - Параметры фильтрации из InlineFilter
 * @param options - Дополнительные опции (enabled)
 *
 * @example
 * const { nodes, analytics, isLoading } = useBudgetsHierarchy(queryParams, { enabled: true })
 */
export function useBudgetsHierarchy(
  filters?: FilterQueryParams,
  options?: { enabled?: boolean }
): UseBudgetsHierarchyResult {
  const { enabled = true } = options || {}

  // Загружаем иерархию проектов
  const {
    data: projects,
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useResourceGraphData(filters || {}, { enabled })

  // Загружаем все активные бюджеты
  const {
    data: budgets,
    isLoading: budgetsLoading,
    error: budgetsError,
    refetch: refetchBudgets,
  } = useBudgets({ is_active: true }, { enabled })

  // Расчётный бюджет по всем разделам (loadings × ставка отдела).
  // Загружаем весь v_cache_section_calc_budget — фильтрация по section_id происходит ниже через calcMap.
  const {
    data: sectionCalcs,
    isLoading: sectionCalcsLoading,
    error: sectionCalcsError,
    refetch: refetchSectionCalcs,
  } = useSectionCalcBudgets()

  // Функция для обновления всех данных
  const refetch = useCallback(() => {
    refetchProjects()
    refetchBudgets()
    refetchSectionCalcs()
  }, [refetchProjects, refetchBudgets, refetchSectionCalcs])

  // Создаём Map для быстрого поиска бюджетов по entity
  const budgetsMap = useMemo(() => {
    const map = new Map<string, BudgetInfo[]>()

    if (!budgets) return map

    for (const budget of budgets) {
      const key = `${budget.entity_type}:${budget.entity_id}`
      const existing = map.get(key) || []
      existing.push(toBudgetInfo(budget))
      map.set(key, existing)
    }

    return map
  }, [budgets])

  // Map: section_id → агрегат расчётного бюджета из loadings
  const calcMap = useMemo(() => {
    const map = new Map<string, SectionCalcSummary>()
    if (!sectionCalcs) return map
    for (const row of sectionCalcs) {
      if (!row.section_id) continue
      map.set(row.section_id, {
        loadingHours: Number(row.total_hours ?? 0),
        calcBudget: Number(row.calc_budget ?? 0),
        loadingCount: row.loading_count ?? 0,
        errorsCount: row.errors_count ?? 0,
      })
    }
    return map
  }, [sectionCalcs])

  // Трансформируем иерархию
  const { nodes, analytics } = useMemo(() => {
    if (!projects || projects.length === 0) {
      return {
        nodes: [],
        analytics: {
          totalPlanned: 0,
          totalSpent: 0,
          spentPercentage: 0,
          remaining: 0,
          projectsCount: 0,
          sectionsCount: 0,
          stagesCount: 0,
          budgetsCount: 0,
          byType: [],
        },
      }
    }

    const transformedNodes = projects.map(project =>
      transformProject(project, budgetsMap, calcMap)
    )

    const calculatedAnalytics = calculateAnalytics(transformedNodes)

    return {
      nodes: transformedNodes,
      analytics: calculatedAnalytics,
    }
  }, [projects, budgetsMap, calcMap])

  return {
    nodes,
    analytics,
    isLoading: projectsLoading || budgetsLoading || sectionCalcsLoading,
    error: projectsError || budgetsError || sectionCalcsError || null,
    refetch,
  }
}
