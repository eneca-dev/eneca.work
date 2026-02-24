/**
 * Budgets Module - Hooks
 *
 * Query и Mutation хуки для модуля бюджетов
 * Используют фабрики из cache module
 */

'use client'

import {
  createCacheQuery,
  createDetailCacheQuery,
  createSimpleCacheQuery,
  createCacheMutation,
  createDeleteMutation,
  staleTimePresets,
  queryKeys,
} from '@/modules/cache'

import {
  getBudgets,
  getBudgetById,
  getBudgetVersions,
  getSectionBudgetSummary,
  getBudgetTypes,
  createBudget,
  updateBudgetAmount,
  deactivateBudget,
} from '../actions/budget-actions'

import type {
  BudgetCurrent,
  BudgetVersion,
  BudgetFilters,
  SectionBudgetSummary,
  BudgetType,
  CreateBudgetInput,
  UpdateBudgetAmountInput,
} from '../types'

// ============================================================================
// Query Keys (re-export from cache module)
// ============================================================================

/** Ключи запросов для бюджетов (используем централизованные из cache) */
export const budgetKeys = queryKeys.budgets
export const budgetTypeKeys = queryKeys.budgetTags // TODO: переименовать в budgetTypes в cache/keys

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Хук для получения списка бюджетов с фильтрами
 *
 * @example
 * const { data, isLoading } = useBudgets({ entity_type: 'section', is_active: true })
 */
export const useBudgets = createCacheQuery<BudgetCurrent[], BudgetFilters | undefined>({
  queryKey: (filters) => queryKeys.budgets.list(filters ? {
    entityType: filters.entity_type,
    entityId: filters.entity_id,
    isActive: filters.is_active,
    tagIds: filters.tag_ids,
  } : undefined),
  queryFn: getBudgets,
  staleTime: staleTimePresets.fast,
})

/**
 * Хук для получения бюджета по ID
 *
 * @example
 * const { data: budget, isLoading } = useBudgetById('budget-id-123')
 */
export const useBudgetById = createDetailCacheQuery<BudgetCurrent>({
  queryKey: (id) => queryKeys.budgets.detail(id),
  queryFn: getBudgetById,
  staleTime: staleTimePresets.medium,
})

/**
 * Хук для получения бюджетов конкретной сущности
 *
 * @example
 * const { data: budgets, isLoading } = useBudgetsByEntity('section', sectionId)
 */
export function useBudgetsByEntity(entityType: string, entityId: string | undefined) {
  return useBudgets(
    entityId ? { entity_type: entityType as BudgetFilters['entity_type'], entity_id: entityId } : undefined,
    { enabled: !!entityId }
  )
}

/**
 * Хук для получения истории версий бюджета
 *
 * @example
 * const { data: versions, isLoading } = useBudgetVersions('budget-id-123')
 */
export const useBudgetVersions = createDetailCacheQuery<BudgetVersion[]>({
  queryKey: (budgetId) => queryKeys.budgets.versions(budgetId),
  queryFn: getBudgetVersions,
  staleTime: staleTimePresets.medium,
})

/**
 * Хук для получения сводки бюджетов по разделам
 *
 * @example
 * const { data: summaries, isLoading } = useSectionBudgetSummary()
 * const { data: projectSummaries } = useSectionBudgetSummary('project-id')
 */
export const useSectionBudgetSummary = createCacheQuery<SectionBudgetSummary[], string | undefined>({
  queryKey: (projectId) => queryKeys.budgets.sectionSummary(projectId),
  queryFn: getSectionBudgetSummary,
  staleTime: staleTimePresets.fast,
})

/**
 * Хук для получения списка типов бюджетов
 *
 * @example
 * const { data: types, isLoading } = useBudgetTypes()
 */
export const useBudgetTypes = createSimpleCacheQuery<BudgetType[]>({
  queryKey: queryKeys.budgetTags.list(), // TODO: переименовать ключ
  queryFn: getBudgetTypes,
  staleTime: staleTimePresets.static, // 10 минут - типы редко меняются
})

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Хук для создания нового бюджета
 *
 * @example
 * const { mutate: create, isPending } = useCreateBudget()
 * create({ entity_type: 'section', entity_id: sectionId, name: 'Основной', planned_amount: 10000 })
 */
export const useCreateBudget = createCacheMutation<CreateBudgetInput, BudgetCurrent>({
  mutationFn: createBudget,
  invalidateKeys: (input) => [
    queryKeys.budgets.lists(),
    queryKeys.budgets.byEntity(input.entity_type, input.entity_id),
    queryKeys.budgets.sectionSummary(),
  ],
})

/**
 * Хук для обновления суммы бюджета (создаёт новую версию)
 *
 * @example
 * const { mutate: update, isPending } = useUpdateBudgetAmount()
 * update({ budget_id: budgetId, planned_amount: 15000, comment: 'Увеличение бюджета' })
 */
export const useUpdateBudgetAmount = createCacheMutation<UpdateBudgetAmountInput, BudgetCurrent>({
  mutationFn: updateBudgetAmount,
  invalidateKeys: (input) => [
    queryKeys.budgets.lists(),
    queryKeys.budgets.detail(input.budget_id),
    queryKeys.budgets.versions(input.budget_id),
    queryKeys.budgets.sectionSummary(),
  ],
})

/**
 * Хук для деактивации бюджета (soft delete)
 *
 * @example
 * const { mutate: deactivate, isPending } = useDeactivateBudget()
 * deactivate(budgetId)
 */
export const useDeactivateBudget = createDeleteMutation<string, { success: boolean }>({
  mutationFn: deactivateBudget,
  listQueryKey: queryKeys.budgets.lists(),
  getId: (budgetId) => budgetId,
  getItemId: () => '', // Not used for soft delete
  invalidateKeys: [
    queryKeys.budgets.all,
    queryKeys.budgets.sectionSummary(),
  ],
})
