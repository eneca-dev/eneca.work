/**
 * Budgets Hierarchy Hook
 *
 * Загружает иерархию проектов с бюджетами для отображения в BudgetsView.
 * Использует существующие данные из resource-graph и budgets модулей.
 */

'use client'

import { useMemo, useCallback } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import { useResourceGraphData } from '@/modules/resource-graph'
import { useBudgets } from '@/modules/budgets'
import type { FilterQueryParams } from '@/modules/inline-filter'
import type {
  HierarchyNode,
  HierarchyNodeType,
  BudgetInfo,
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
    // Страница бюджетов использует lean-view — spent-поля не нужны для UI
    spent_amount: toNumber(budget.total_spent),
    remaining_amount: toNumber(budget.remaining_amount),
    spent_percentage: toNumber(budget.spent_percentage),
    parent_budget_id: budget.parent_budget_id,
    parent_planned_amount: toNumber(budget.parent_total_amount),
    is_active: budget.is_active,
  }
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
    plannedHours,
    children,
    entityType: 'decomposition_stage',
  }

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
    plannedHours,
    loadingHours: calc?.loadingHours ?? 0,
    calcBudgetFromLoadings: calc?.calcBudget ?? 0,
    loadingCount: calc?.loadingCount ?? 0,
    loadingErrorsCount: calc?.errorsCount ?? 0,
    children,
    entityType: 'section',
    hourlyRate: section.hourlyRate,
  }

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
    plannedHours,
    loadingHours,
    calcBudgetFromLoadings,
    loadingCount,
    loadingErrorsCount,
    children,
    entityType: 'object',
  }

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
    plannedHours,
    loadingHours,
    calcBudgetFromLoadings,
    loadingCount,
    loadingErrorsCount,
    children,
    entityType: 'project',
  }

  return node
}

// ============================================================================
// Main Hook
// ============================================================================

export interface UseBudgetsHierarchyResult {
  nodes: HierarchyNode[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

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

  // Когда фильтры применены — берём project_ids из уже загруженной иерархии
  // и передаём в useBudgets чтобы грузить только нужные бюджеты.
  // Когда фильтров нет ("Загрузить всё") — грузим всё как обычно.
  const projectIds = useMemo(() => {
    if (!filters || !projects) return undefined
    return projects.map(p => p.id)
  }, [filters, projects])

  // С фильтрами: ждём projects → потом budgets (waterfall, но меньше данных).
  // Без фильтров: сразу грузим всё параллельно.
  const budgetsEnabled = filters
    ? (projects !== undefined && projectIds !== undefined && projectIds.length > 0)
    : enabled

  const {
    data: budgets,
    isLoading: budgetsLoading,
    error: budgetsError,
    refetch: refetchBudgets,
  } = useBudgets(
    { is_active: true, project_ids: projectIds, lean: true },
    {
      enabled: budgetsEnabled,
      queryOptions: { placeholderData: keepPreviousData },
    }
  )

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

  const nodes = useMemo(() => {
    if (!projects || projects.length === 0) return []
    return projects.map(project => transformProject(project, budgetsMap, calcMap))
  }, [projects, budgetsMap, calcMap])

  return {
    nodes,
    isLoading: projectsLoading || budgetsLoading || sectionCalcsLoading,
    error: projectsError || budgetsError || sectionCalcsError || null,
    refetch,
  }
}
