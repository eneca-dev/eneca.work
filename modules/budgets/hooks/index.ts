/**
 * Budgets Module - Hooks
 *
 * Query и Mutation хуки для модуля бюджетов.
 * Используют фабрики из cache module.
 */

'use client'

import {
  createCacheQuery,
  createDetailCacheQuery,
  createCacheMutation,
  staleTimePresets,
  queryKeys,
} from '@/modules/cache'

import {
  getBudgets,
  getBudgetById,
  getBudgetHistory,
  findParentBudget,
  createBudget,
  updateBudgetAmount,
  deactivateBudget,
  clearBudget,
} from '../actions/budget-actions'

import type {
  BudgetCurrent,
  BudgetHistoryEntry,
  BudgetFilters,
  BudgetEntityType,
  CreateBudgetInput,
  UpdateBudgetAmountInput,
} from '../types'

// ============================================================================
// Query Keys (re-export from cache module)
// ============================================================================

export const budgetKeys = queryKeys.budgets

// ============================================================================
// Query Hooks
// ============================================================================

export const useBudgets = createCacheQuery<BudgetCurrent[], BudgetFilters | undefined>({
  queryKey: (filters) => queryKeys.budgets.list(filters ? {
    entityType: filters.entity_type,
    entityId: filters.entity_id,
    isActive: filters.is_active,
  } : undefined),
  queryFn: getBudgets,
  staleTime: staleTimePresets.fast,
})

export const useBudgetById = createDetailCacheQuery<BudgetCurrent>({
  queryKey: (id) => queryKeys.budgets.detail(id),
  queryFn: getBudgetById,
  staleTime: staleTimePresets.medium,
})

export function useBudgetsByEntity(entityType: string, entityId: string | undefined) {
  return useBudgets(
    entityId ? { entity_type: entityType as BudgetFilters['entity_type'], entity_id: entityId } : undefined,
    { enabled: !!entityId }
  )
}

export const useBudgetHistory = createDetailCacheQuery<BudgetHistoryEntry[]>({
  queryKey: (id) => queryKeys.budgets.history(id),
  queryFn: getBudgetHistory,
  staleTime: staleTimePresets.fast,
})

// Параметры для поиска родительского бюджета
interface ParentBudgetParams {
  entityType: BudgetEntityType
  entityId: string
}

export const useFindParentBudgetQuery = createCacheQuery<
  BudgetCurrent | null,
  ParentBudgetParams | undefined
>({
  queryKey: (params) =>
    params
      ? queryKeys.budgets.parentCandidates(params.entityType, params.entityId, '')
      : queryKeys.budgets.parentCandidates('', '', ''),
  queryFn: async (params) => {
    if (!params) return { success: true, data: null }
    return findParentBudget(params.entityType, params.entityId)
  },
  staleTime: staleTimePresets.fast,
})

export function useFindParentBudget(
  entityType: BudgetEntityType | undefined,
  entityId: string | undefined
) {
  const params: ParentBudgetParams | undefined =
    entityType && entityId ? { entityType, entityId } : undefined

  return useFindParentBudgetQuery(params, {
    enabled: !!entityType && !!entityId,
  })
}

// ============================================================================
// Mutation Hooks
// ============================================================================

export const useCreateBudget = createCacheMutation<CreateBudgetInput, BudgetCurrent>({
  mutationFn: createBudget,
  invalidateKeys: (input) => [
    queryKeys.budgets.lists(),
    queryKeys.budgets.byEntity(input.entity_type, input.entity_id),
  ] as unknown as unknown[][],
})

export const useUpdateBudgetAmount = createCacheMutation<UpdateBudgetAmountInput, BudgetCurrent>({
  mutationFn: updateBudgetAmount,
  optimisticUpdate: {
    // Обновляем плоский список бюджетов мгновенно, не ждём ответа сервера.
    // useBudgetsHierarchy пересчитает иерархию через useMemo автоматически.
    queryKey: queryKeys.budgets.lists(),
    updater: (oldData, input) =>
      (oldData ?? []).map(b => {
        if (b.budget_id !== input.budget_id) return b
        const newTotal = input.total_amount
        const spent = Number(b.total_spent) || 0
        return {
          ...b,
          total_amount: newTotal,
          remaining_amount: newTotal - spent,
          spent_percentage: newTotal > 0 ? Math.round((spent / newTotal) * 100) : 0,
        }
      }),
  },
  // lists() инвалидируем чтобы parent_planned_amount обновился в дочерних бюджетах.
  // Без этого поле "%" у дочерних строк не появляется пока не обновить страницу.
  // Optimistic update всё равно даёт мгновенный отклик — lists() перезагружается фоном.
  invalidateKeys: (input) => [
    queryKeys.budgets.lists(),
    queryKeys.budgets.detail(input.budget_id),
  ] as unknown as unknown[][],
})

export const useDeactivateBudget = createCacheMutation<string, { success: boolean; warning?: string }>({
  mutationFn: deactivateBudget,
  invalidateKeys: () => [queryKeys.budgets.all] as unknown as unknown[][],
})

export const useClearBudget = createCacheMutation<
  { budgetId: string; comment?: string },
  BudgetCurrent
>({
  mutationFn: ({ budgetId, comment }) => clearBudget(budgetId, comment),
  invalidateKeys: (input) => [
    queryKeys.budgets.lists(),
    queryKeys.budgets.detail(input.budgetId),
    queryKeys.budgets.history(input.budgetId),
  ] as unknown as unknown[][],
})
