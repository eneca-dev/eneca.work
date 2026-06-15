/**
 * useProjectDepartmentBudgets — расчётный бюджет на пересечении проект × отдел.
 *
 * Аналог useSectionCalcBudgets, но группировка по отделам.
 * Используется блоком "Человеческие ресурсы" во вкладке Бюджеты.
 */

'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys, staleTimePresets } from '@/modules/cache'
import {
  getProjectDepartmentBudgets,
  type ProjectDepartmentBudget,
} from '../actions/project-department-money'

export interface ProjectDepartmentBudgetSummary {
  calcBudget: number
  totalHours: number
  loadingCount: number
  errorsCount: number
}

/** Map: project_id → (department_id → summary) */
export type ProjectDepartmentBudgetMap = Map<string, Map<string, ProjectDepartmentBudgetSummary>>

function toNumber(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'string' ? parseFloat(value) || 0 : value
}

/**
 * Загружает агрегат расчётного бюджета по всем проектам и отделам.
 * Статичный ключ кэша — один запрос на всю иерархию бюджетов.
 */
export function useProjectDepartmentBudgets() {
  return useQuery({
    queryKey: queryKeys.budgets.calcByDepartments(),
    queryFn: async (): Promise<ProjectDepartmentBudgetMap> => {
      const result = await getProjectDepartmentBudgets()
      if (!result.success) throw new Error(result.error)
      return buildMap(result.data)
    },
    staleTime: staleTimePresets.medium,
    placeholderData: keepPreviousData,
  })
}

function buildMap(rows: ProjectDepartmentBudget[]): ProjectDepartmentBudgetMap {
  const map: ProjectDepartmentBudgetMap = new Map()
  for (const row of rows) {
    if (!row.project_id || !row.department_id) continue

    let byDept = map.get(row.project_id)
    if (!byDept) {
      byDept = new Map()
      map.set(row.project_id, byDept)
    }

    byDept.set(row.department_id, {
      calcBudget: toNumber(row.calc_budget),
      totalHours: toNumber(row.total_hours),
      loadingCount: toNumber(row.loading_count),
      errorsCount: toNumber(row.errors_count),
    })
  }
  return map
}
