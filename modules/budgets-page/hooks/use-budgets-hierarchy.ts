/**
 * Budgets Hierarchy Hook
 *
 * Загружает иерархию проектов с бюджетами для отображения в BudgetsView.
 * Использует существующие данные из resource-graph и budgets модулей.
 */

'use client'

import { useMemo } from 'react'
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
import type { Project, Stage, ProjectObject, Section, DecompositionStage, DecompositionItem } from '@/modules/resource-graph/types'
import type { BudgetCurrent } from '@/modules/budgets/types'

// ============================================================================
// Budget Transformation Helpers
// ============================================================================

/**
 * Преобразует BudgetCurrent в BudgetInfo
 */
function toBudgetInfo(budget: BudgetCurrent): BudgetInfo {
  return {
    budget_id: budget.budget_id,
    name: budget.name,
    planned_amount: budget.planned_amount,
    spent_amount: budget.spent_amount,
    remaining_amount: budget.remaining_amount,
    spent_percentage: budget.spent_percentage,
    type_id: budget.type_id,
    type_name: budget.type_name,
    type_color: budget.type_color,
    parent_budget_id: budget.parent_budget_id,
    parent_planned_amount: budget.parent_planned_amount,
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
function transformDecompositionItem(item: DecompositionItem): HierarchyNode {
  return {
    id: item.id,
    name: item.description,
    type: 'decomposition_item',
    budgets: [], // Items не имеют бюджетов напрямую
    aggregatedBudgets: [],
    plannedHours: item.plannedHours,
    children: [],
    entityType: 'section', // decomposition_item не имеет своего entity_type в budgets
    workCategory: item.workCategoryName,
    difficulty: item.difficulty ? {
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
  const children = stage.items.map(item => transformDecompositionItem(item))

  // Плановые часы = сумма plannedHours всех items
  const plannedHours = stage.items.reduce((sum, item) => sum + (item.plannedHours || 0), 0)

  const nodeBudgets = budgetsMap.get(`decomposition_stage:${stage.id}`) || []

  return {
    id: stage.id,
    name: stage.name,
    type: 'decomposition_stage',
    budgets: nodeBudgets,
    aggregatedBudgets: aggregateBudgetsByType(nodeBudgets),
    plannedHours,
    children,
    entityType: 'section', // decomposition_stage не имеет своего entity_type в budgets
  }
}

/**
 * Преобразует Section в HierarchyNode
 */
function transformSection(
  section: Section,
  budgetsMap: Map<string, BudgetInfo[]>
): HierarchyNode {
  const children = section.decompositionStages.map(stage =>
    transformDecompositionStage(stage, budgetsMap)
  )

  // Плановые часы = сумма часов всех этапов
  const plannedHours = children.reduce((sum, child) => sum + (child.plannedHours || 0), 0)

  const nodeBudgets = budgetsMap.get(`section:${section.id}`) || []

  const node: HierarchyNode = {
    id: section.id,
    name: section.name,
    type: 'section',
    budgets: nodeBudgets,
    aggregatedBudgets: [], // Будет вычислено ниже
    plannedHours,
    children,
    entityType: 'section',
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
  budgetsMap: Map<string, BudgetInfo[]>
): HierarchyNode {
  const children = object.sections.map(section =>
    transformSection(section, budgetsMap)
  )

  const plannedHours = children.reduce((sum, child) => sum + (child.plannedHours || 0), 0)

  const nodeBudgets = budgetsMap.get(`object:${object.id}`) || []

  const node: HierarchyNode = {
    id: object.id,
    name: object.name,
    type: 'object',
    budgets: nodeBudgets,
    aggregatedBudgets: [],
    plannedHours,
    children,
    entityType: 'object',
  }

  node.aggregatedBudgets = aggregateBudgetsUpward(node)

  return node
}

/**
 * Преобразует Stage в HierarchyNode
 */
function transformStage(
  stage: Stage,
  budgetsMap: Map<string, BudgetInfo[]>
): HierarchyNode {
  const children = stage.objects.map(object =>
    transformObject(object, budgetsMap)
  )

  const plannedHours = children.reduce((sum, child) => sum + (child.plannedHours || 0), 0)

  const nodeBudgets = budgetsMap.get(`stage:${stage.id}`) || []

  const node: HierarchyNode = {
    id: stage.id,
    name: stage.name,
    type: 'stage',
    budgets: nodeBudgets,
    aggregatedBudgets: [],
    plannedHours,
    children,
    entityType: 'stage',
  }

  node.aggregatedBudgets = aggregateBudgetsUpward(node)

  return node
}

/**
 * Преобразует Project в HierarchyNode
 */
function transformProject(
  project: Project,
  budgetsMap: Map<string, BudgetInfo[]>
): HierarchyNode {
  const children = project.stages.map(stage =>
    transformStage(stage, budgetsMap)
  )

  const plannedHours = children.reduce((sum, child) => sum + (child.plannedHours || 0), 0)

  const nodeBudgets = budgetsMap.get(`project:${project.id}`) || []

  const node: HierarchyNode = {
    id: project.id,
    name: project.name,
    type: 'project',
    budgets: nodeBudgets,
    aggregatedBudgets: [],
    plannedHours,
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
 * Вычисляет аналитику по всем узлам иерархии
 */
function calculateAnalytics(nodes: HierarchyNode[]): BudgetsAnalyticsData {
  let totalPlanned = 0
  let totalSpent = 0
  let projectsCount = 0
  let sectionsCount = 0
  let stagesCount = 0
  let budgetsCount = 0

  const byTypeMap = new Map<string, AggregatedBudgetsByType>()

  function processNode(node: HierarchyNode) {
    // Считаем типы узлов
    switch (node.type) {
      case 'project':
        projectsCount++
        break
      case 'section':
        sectionsCount++
        break
      case 'decomposition_stage':
        stagesCount++
        break
    }

    // Считаем бюджеты этого узла
    for (const budget of node.budgets) {
      budgetsCount++
      totalPlanned += budget.planned_amount
      totalSpent += budget.spent_amount

      // Группируем по типам
      if (budget.type_id && budget.type_name) {
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

    // Рекурсивно обрабатываем детей
    for (const child of node.children) {
      processNode(child)
    }
  }

  for (const node of nodes) {
    processNode(node)
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
}

/**
 * Хук для получения иерархии проектов с бюджетами
 *
 * Объединяет данные из:
 * - useResourceGraphData (иерархия проектов)
 * - useBudgets (все бюджеты)
 *
 * @param filters - Параметры фильтрации из InlineFilter
 *
 * @example
 * const { nodes, analytics, isLoading } = useBudgetsHierarchy(queryParams)
 */
export function useBudgetsHierarchy(
  filters?: FilterQueryParams
): UseBudgetsHierarchyResult {
  // Загружаем иерархию проектов
  const {
    data: projects,
    isLoading: projectsLoading,
    error: projectsError,
  } = useResourceGraphData(filters || {})

  // Загружаем все активные бюджеты
  const {
    data: budgets,
    isLoading: budgetsLoading,
    error: budgetsError,
  } = useBudgets({ is_active: true })

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
      transformProject(project, budgetsMap)
    )

    const calculatedAnalytics = calculateAnalytics(transformedNodes)

    return {
      nodes: transformedNodes,
      analytics: calculatedAnalytics,
    }
  }, [projects, budgetsMap])

  return {
    nodes,
    analytics,
    isLoading: projectsLoading || budgetsLoading,
    error: projectsError || budgetsError || null,
  }
}
