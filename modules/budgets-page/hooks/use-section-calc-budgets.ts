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
 * Хук возвращает массив `SectionCalcBudget` для переданных section_id.
 * При смене списка `sectionIds` старые данные сохраняются (placeholderData),
 * чтобы не было моргания при пересчёте.
 */
export function useSectionCalcBudgets(sectionIds: string[]) {
  return useQuery({
    queryKey: queryKeys.budgets.calcBySections(sectionIds),
    queryFn: async () => {
      const result = await getSectionCalcBudgets(sectionIds)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: staleTimePresets.medium,
    placeholderData: keepPreviousData,
    enabled: sectionIds.length > 0,
  })
}
