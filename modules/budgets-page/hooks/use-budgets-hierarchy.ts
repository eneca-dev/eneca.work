/**
 * Budgets Hierarchy Hook (Вариант 1 — лёгкая live-вью, без MV)
 *
 * Строит дерево Проект→Объект→Раздел из section-grain строк v_budget_hierarchy
 * (~4.3к строк, числа посчитаны в БД) + записи бюджетов для inline-редактора.
 * Этапы/задачи раздела грузятся лениво при раскрытии (SectionLazyChildren).
 *
 * Базовое дерево собирается ОДИН раз (стабильные узлы) → React.memo строк не ломается.
 */

'use client'

import { useMemo, useCallback } from 'react'
import { keepPreviousData } from '@tanstack/react-query'
import { useBudgets } from '@/modules/budgets'
import type { FilterQueryParams } from '@/modules/inline-filter'
import type { HierarchyNode, BudgetInfo } from '../types'
import type { BudgetCurrent } from '@/modules/budgets'
import type { BudgetHierarchyRow } from '../actions'
import { useBudgetHierarchy } from './use-budget-hierarchy'

// ============================================================================
// Helpers
// ============================================================================

const num = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined) return 0
  return typeof v === 'string' ? parseFloat(v) || 0 : v
}

/** BudgetCurrent (V2) → BudgetInfo */
export function toBudgetInfo(budget: BudgetCurrent): BudgetInfo {
  return {
    budget_id: budget.budget_id,
    name: budget.name,
    planned_amount: num(budget.total_amount),
    spent_amount: num(budget.total_spent),
    remaining_amount: num(budget.remaining_amount),
    spent_percentage: num(budget.spent_percentage),
    parent_budget_id: budget.parent_budget_id,
    parent_planned_amount: num(budget.parent_total_amount),
    is_active: budget.is_active,
  }
}

/**
 * Собирает дерево Проект→Объект→Раздел из плоских section-grain строк.
 * Объект/проект без раздела (section_id = null) тоже попадают (как в v_resource_graph).
 * Числа раздела (расчётный, распределено) берутся из строки; объект/проект — роллап.
 */
function buildHierarchy(
  rows: BudgetHierarchyRow[],
  budgetsMap: Map<string, BudgetInfo[]>
): HierarchyNode[] {
  const projectsMap = new Map<string, HierarchyNode>()
  const objectsMap = new Map<string, HierarchyNode>()
  const sectionsMap = new Map<string, HierarchyNode>()
  const ordered: HierarchyNode[] = []

  for (const row of rows) {
    if (!row.project_id) continue

    // Проект
    let project = projectsMap.get(row.project_id)
    if (!project) {
      project = {
        id: row.project_id,
        name: row.project_name || '',
        type: 'project',
        stageName: row.stage_type,
        projectStatus: row.project_status,
        budgets: budgetsMap.get(`project:${row.project_id}`) || [],
        children: [],
        entityType: 'project',
      }
      projectsMap.set(row.project_id, project)
      ordered.push(project)
    }

    if (!row.object_id) continue

    // Объект
    let object = objectsMap.get(row.object_id)
    if (!object) {
      object = {
        id: row.object_id,
        name: row.object_name || '',
        type: 'object',
        budgets: budgetsMap.get(`object:${row.object_id}`) || [],
        children: [],
        entityType: 'object',
      }
      objectsMap.set(row.object_id, object)
      project.children.push(object)
    }

    if (!row.section_id) continue

    // Раздел (числа из строки; дети — лениво)
    if (!sectionsMap.has(row.section_id)) {
      const section: HierarchyNode = {
        id: row.section_id,
        name: row.section_name || '',
        type: 'section',
        budgets: budgetsMap.get(`section:${row.section_id}`) || [],
        loadingHours: num(row.section_loading_hours),
        calcBudgetFromLoadings: num(row.section_calc_budget),
        loadingCount: row.section_loading_count ?? 0,
        loadingErrorsCount: row.section_errors_count ?? 0,
        distributedBudget: num(row.section_distributed),
        hasLazyChildren: !!row.section_has_stages,
        children: [],
        entityType: 'section',
        hourlyRate: row.section_hourly_rate != null ? num(row.section_hourly_rate) : null,
      }
      sectionsMap.set(row.section_id, section)
      object.children.push(section)
    }
  }

  // Роллапы расчётного/часов на объект и проект (сумма по разделам ниже)
  for (const project of ordered) {
    let pHours = 0, pCalc = 0, pCount = 0, pErr = 0
    for (const object of project.children) {
      let oHours = 0, oCalc = 0, oCount = 0, oErr = 0
      for (const section of object.children) {
        oHours += section.loadingHours || 0
        oCalc += section.calcBudgetFromLoadings || 0
        oCount += section.loadingCount || 0
        oErr += section.loadingErrorsCount || 0
      }
      object.loadingHours = oHours
      object.calcBudgetFromLoadings = oCalc
      object.loadingCount = oCount
      object.loadingErrorsCount = oErr
      pHours += oHours; pCalc += oCalc; pCount += oCount; pErr += oErr
    }
    project.loadingHours = pHours
    project.calcBudgetFromLoadings = pCalc
    project.loadingCount = pCount
    project.loadingErrorsCount = pErr
  }

  return ordered
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

  // Лёгкая иерархия (section-grain) — один запрос
  const {
    data: rows,
    isLoading: rowsLoading,
    error: rowsError,
    refetch: refetchRows,
  } = useBudgetHierarchy(filters || {}, { enabled })

  // project_ids из загруженной иерархии — чтобы грузить только нужные бюджеты при фильтрах
  const projectIds = useMemo(() => {
    if (!filters || !rows) return undefined
    return [...new Set(rows.map(r => r.project_id))]
  }, [filters, rows])

  const budgetsEnabled = filters
    ? (rows !== undefined && projectIds !== undefined && projectIds.length > 0)
    : enabled

  const {
    data: budgets,
    isLoading: budgetsLoading,
    error: budgetsError,
    refetch: refetchBudgets,
  } = useBudgets(
    // Фаза 7: на старте грузим только верхние уровни (~5к вместо ~35к).
    // Бюджеты этапов/задач приходят лениво через getSectionBudgetItems при раскрытии раздела.
    { is_active: true, project_ids: projectIds, lean: true, entity_types: ['project', 'object', 'section'] },
    {
      enabled: budgetsEnabled,
      queryOptions: { placeholderData: keepPreviousData },
    }
  )

  const refetch = useCallback(() => {
    refetchRows()
    refetchBudgets()
  }, [refetchRows, refetchBudgets])

  // Карта бюджетов по entity (project/object/section/stage/item)
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

  const nodes = useMemo(() => {
    if (!rows || rows.length === 0) return []
    return buildHierarchy(rows, budgetsMap)
  }, [rows, budgetsMap])

  return {
    nodes,
    isLoading: rowsLoading || budgetsLoading,
    error: (rowsError as Error) || (budgetsError as Error) || null,
    refetch,
  }
}
