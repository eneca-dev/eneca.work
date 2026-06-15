/**
 * Budgets Module - Hooks
 *
 * Query и Mutation хуки для модуля бюджетов.
 * Используют фабрики из cache module.
 */

'use client'

import {
  createCacheQuery,
  createCacheMutation,
  staleTimePresets,
  queryKeys,
} from '@/modules/cache'

import {
  getBudgets,
  createBudget,
  updateBudgetAmount,
  deactivateBudget,
  findParentBudget,
} from '../actions/budget-actions'

import type {
  BudgetCurrent,
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
    lean: filters.lean,
  } : undefined),
  queryFn: getBudgets,
  staleTime: staleTimePresets.fast,
})

export function useBudgetsByEntity(entityType: string, entityId: string | undefined) {
  return useBudgets(
    entityId ? { entity_type: entityType as BudgetFilters['entity_type'], entity_id: entityId } : undefined,
    { enabled: !!entityId }
  )
}

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
    queryKey: queryKeys.budgets.lists(),
    updater: (oldData, input) =>
      (oldData ?? []).map(b => {
        if (b.budget_id === input.budget_id) {
          const newTotal = input.total_amount
          return {
            ...b,
            total_amount: newTotal,
            // Пересчитываем spent-поля только если они есть (v_cache_budgets, не lean)
            ...(b.total_spent !== undefined && {
              remaining_amount: newTotal - (Number(b.total_spent) || 0),
              spent_percentage: newTotal > 0
                ? Math.round(((Number(b.total_spent) || 0) / newTotal) * 100)
                : 0,
            }),
          }
        }
        if (b.parent_budget_id === input.budget_id) {
          return { ...b, parent_total_amount: input.total_amount }
        }
        return b
      }),
  },
  // Optimistic update покрывает изменение бюджета и parent_total_amount у детей.
  // Realtime подписка (таблица budgets) обеспечивает синхронизацию с сервером.
  // invalidateKeys намеренно убрано чтобы избежать двойного refetch (invalidate + realtime).
  invalidateKeys: () => [] as unknown as unknown[][],
})

export const useDeactivateBudget = createCacheMutation<string, { success: boolean; warning?: string }>({
  mutationFn: deactivateBudget,
  invalidateKeys: () => [queryKeys.budgets.all] as unknown as unknown[][],
})
