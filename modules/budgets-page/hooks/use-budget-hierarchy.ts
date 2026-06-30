/**
 * Хуки лёгкой иерархии бюджетов (Вариант 1, без MV).
 *
 * - useBudgetHierarchy: section-grain строки из v_budget_hierarchy (один запрос).
 * - useSectionBudgetItems: ленивые этапы+задачи одного раздела (при раскрытии).
 */

'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys, staleTimePresets } from '@/modules/cache'
import { getBudgetHierarchy, getSectionBudgetItems } from '../actions'
import type { FilterQueryParams } from '@/modules/inline-filter'

/** Section-grain строки иерархии бюджетов (числа уже посчитаны в БД). */
export function useBudgetHierarchy(
  filters?: FilterQueryParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.budgets.hierarchy(filters ?? null),
    queryFn: async () => {
      const res = await getBudgetHierarchy(filters)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: options?.enabled ?? true,
    staleTime: staleTimePresets.medium,
    placeholderData: keepPreviousData,
  })
}

/** Ленивые этапы+задачи одного раздела (вызывается при раскрытии раздела). */
export function useSectionBudgetItems(
  sectionId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.budgets.sectionItems(sectionId ?? ''),
    queryFn: async () => {
      const res = await getSectionBudgetItems(sectionId as string)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: (options?.enabled ?? true) && !!sectionId,
    staleTime: staleTimePresets.medium,
  })
}
