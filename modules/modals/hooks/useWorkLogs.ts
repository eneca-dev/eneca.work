'use client'

/**
 * Hooks for work logs operations
 */

import { useQuery } from '@tanstack/react-query'
import { createCacheMutation, queryKeys } from '@/modules/cache'
import {
  getDecompositionItemsBySection,
  getUserHourlyRate,
  createWorkLog,
  type CreateWorkLogInput,
  type WorkLogResult,
  type DecompositionItemOption,
} from '../actions'

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Хук для получения decomposition items по section_id
 *
 * @example
 * const { data: items, isLoading } = useDecompositionItemsForWorkLog(sectionId)
 */
export function useDecompositionItemsForWorkLog(
  sectionId: string,
  options?: { enabled?: boolean }
) {
  return useQuery<DecompositionItemOption[], Error>({
    queryKey: queryKeys.decomposition.items(sectionId),
    queryFn: async () => {
      const result = await getDecompositionItemsBySection(sectionId)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    enabled: options?.enabled !== false && !!sectionId,
  })
}

/**
 * Хук для получения ставки пользователя
 *
 * @example
 * const { data: rate } = useUserHourlyRate(userId)
 */
export function useUserHourlyRate(
  userId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<number | null, Error>({
    queryKey: ['users', 'hourly-rate', userId],
    queryFn: async () => {
      if (!userId) return null
      const result = await getUserHourlyRate(userId)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    enabled: options?.enabled !== false && !!userId,
  })
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Хук для создания work log
 *
 * @example
 * const { mutate: create, isPending } = useCreateWorkLog()
 * create({ decompositionItemId, description, workDate, hours, hourlyRate, budgetId })
 */
export const useCreateWorkLog = createCacheMutation<
  CreateWorkLogInput & { sectionId: string },
  WorkLogResult
>({
  mutationFn: (input) => createWorkLog(input),
  invalidateKeys: (input) => [
    queryKeys.decomposition.items(input.sectionId),
    queryKeys.decomposition.bootstrap(input.sectionId),
    queryKeys.resourceGraph.all,
    queryKeys.resourceGraph.lists(),
    // Инвалидируем batch данные для обновления бюджетов этапов
    queryKeys.resourceGraph.allSectionsBatch(),
    // Инвалидируем бюджеты для обновления spent_amount
    queryKeys.budgets.all,
  ],
})
