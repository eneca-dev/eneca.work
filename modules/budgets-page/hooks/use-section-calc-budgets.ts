/**
 * useSectionCalcBudgets — расчётный бюджет по разделам из loadings.
 *
 * См. docs/production/budgets-calc-from-loadings.md
 */

'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys, staleTimePresets } from '@/modules/cache'
import { getSectionCalcBudgets } from '../actions/loading-money'

/**
 * Хук загружает расчётные бюджеты по всем разделам (v_cache_section_calc_budget).
 * Используется статичный ключ кэша — данные кэшируются независимо от текущей иерархии.
 * Фильтрация по нужным разделам происходит в use-budgets-hierarchy через calcMap.
 */
export function useSectionCalcBudgets() {
  return useQuery({
    queryKey: queryKeys.budgets.calc(),
    queryFn: async () => {
      const result = await getSectionCalcBudgets()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: staleTimePresets.medium,
    placeholderData: keepPreviousData,
  })
}
