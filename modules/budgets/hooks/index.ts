/**
 * Budgets Module - Hooks
 *
 * Query и Mutation хуки для модуля бюджетов (V2)
 * Используют фабрики из cache module
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
  getBudgetFull,
  getBudgetHistory,
  getSectionBudgetSummary,
  findParentBudget,
  createBudget,
  updateBudgetAmount,
  addBudgetPart,
  updateBudgetPart,
  deleteBudgetPart,
  deactivateBudget,
  clearBudget,
} from '../actions/budget-actions'

import type {
  BudgetCurrent,
  BudgetFull,
  BudgetHistoryEntry,
  BudgetFilters,
  SectionBudgetSummary,
  BudgetEntityType,
  CreateBudgetInput,
  UpdateBudgetAmountInput,
  CreateBudgetPartInput,
  UpdateBudgetPartInput,
} from '../types'

// ============================================================================
// Query Keys (re-export from cache module)
// ============================================================================

/** Ключи запросов для бюджетов (используем централизованные из cache) */
export const budgetKeys = queryKeys.budgets

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

// Параметры для поиска родительского бюджета
interface ParentBudgetParams {
  entityType: BudgetEntityType
  entityId: string
}

/**
 * Хук для поиска родительского бюджета в иерархии
 * Ищет ближайший бюджет выше по иерархии (object → project)
 * Примечание: stage исключён из иерархии бюджетов
 *
 * @example
 * const { data: parent, isLoading } = useFindParentBudget('section', sectionId)
 */
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

// Wrapper для удобного использования с отдельными параметрами
export function useFindParentBudget(
  entityType: BudgetEntityType | undefined,
  entityId: string | undefined
) {
  const params: ParentBudgetParams | undefined =
    entityType && entityId
      ? { entityType, entityId }
      : undefined

  return useFindParentBudgetQuery(params, {
    enabled: !!entityType && !!entityId,
  })
}

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
 * Хук для обновления суммы бюджета
 *
 * @example
 * const { mutate: update, isPending } = useUpdateBudgetAmount()
 * update({ budget_id: budgetId, total_amount: 15000, comment: 'Увеличение бюджета' })
 */
export const useUpdateBudgetAmount = createCacheMutation<UpdateBudgetAmountInput, BudgetCurrent>({
  mutationFn: updateBudgetAmount,
  invalidateKeys: (input) => [
    queryKeys.budgets.lists(),
    queryKeys.budgets.detail(input.budget_id),
    queryKeys.budgets.full(input.budget_id),
    queryKeys.budgets.history(input.budget_id),
    queryKeys.budgets.sectionSummary(),
  ],
})

/**
 * Хук для деактивации бюджета (soft delete)
 *
 * Проверяет целостность данных:
 * - Нельзя деактивировать если есть активные дочерние бюджеты
 * - Предупреждает если есть approved расходы
 *
 * @example
 * const { mutate: deactivate, isPending } = useDeactivateBudget()
 * deactivate(budgetId)
 */
export const useDeactivateBudget = createCacheMutation<string, { success: boolean; warning?: string }>({
  mutationFn: deactivateBudget,
  invalidateKeys: () => [
    queryKeys.budgets.all,
    queryKeys.budgets.sectionSummary(),
  ],
})

/**
 * Хук для очистки бюджета (обнуление вместо удаления)
 *
 * Используется когда нужно "удалить" бюджет но сохранить историю.
 * Обнуляет total_amount и все части.
 *
 * @example
 * const { mutate: clear, isPending } = useClearBudget()
 * clear({ budgetId: 'budget-id', comment: 'Причина обнуления' })
 */
export const useClearBudget = createCacheMutation<
  { budgetId: string; comment?: string },
  BudgetCurrent
>({
  mutationFn: ({ budgetId, comment }) => clearBudget(budgetId, comment),
  invalidateKeys: (input) => [
    queryKeys.budgets.lists(),
    queryKeys.budgets.detail(input.budgetId),
    queryKeys.budgets.full(input.budgetId),
    queryKeys.budgets.history(input.budgetId),
    queryKeys.budgets.sectionSummary(),
  ],
})

// ============================================================================
// V2 Hooks - Budget Parts & Full Info
// ============================================================================

/**
 * Хук для получения полной информации о бюджете с частями
 *
 * @example
 * const { data: budget, isLoading } = useBudgetFull('budget-id-123')
 */
export const useBudgetFull = createDetailCacheQuery<BudgetFull>({
  queryKey: (id) => queryKeys.budgets.full(id),
  queryFn: getBudgetFull,
  staleTime: staleTimePresets.fast,
})

/**
 * Хук для получения истории изменений бюджета
 *
 * @example
 * const { data: history, isLoading } = useBudgetHistory('budget-id-123')
 */
export const useBudgetHistory = createDetailCacheQuery<BudgetHistoryEntry[]>({
  queryKey: (id) => queryKeys.budgets.history(id),
  queryFn: getBudgetHistory,
  staleTime: staleTimePresets.fast,
})

/**
 * Хук для добавления части к бюджету (premium или custom)
 *
 * @example
 * const { mutate: addPart, isPending } = useAddBudgetPart()
 * addPart({ budget_id: budgetId, part_type: 'premium', percentage: 20 })
 */
export const useAddBudgetPart = createCacheMutation<CreateBudgetPartInput, BudgetFull>({
  mutationFn: addBudgetPart,
  invalidateKeys: (input) => [
    queryKeys.budgets.lists(),
    queryKeys.budgets.detail(input.budget_id),
    queryKeys.budgets.full(input.budget_id),
    queryKeys.budgets.sectionSummary(),
  ],
})

/**
 * Хук для обновления части бюджета
 *
 * @example
 * const { mutate: updatePart, isPending } = useUpdateBudgetPart()
 * updatePart({ part_id: partId, percentage: 30 })
 */
export const useUpdateBudgetPart = createCacheMutation<
  UpdateBudgetPartInput & { budget_id: string },
  { success: boolean }
>({
  mutationFn: updateBudgetPart,
  invalidateKeys: (input) => [
    queryKeys.budgets.lists(),
    queryKeys.budgets.detail(input.budget_id),
    queryKeys.budgets.full(input.budget_id),
    queryKeys.budgets.sectionSummary(),
  ],
})

/**
 * Хук для удаления части бюджета
 *
 * @example
 * const { mutate: deletePart, isPending } = useDeleteBudgetPart()
 * deletePart({ part_id: partId, budget_id: budgetId })
 */
export const useDeleteBudgetPart = createCacheMutation<
  { part_id: string; budget_id: string },
  { success: boolean }
>({
  mutationFn: ({ part_id }) => deleteBudgetPart(part_id),
  invalidateKeys: (input) => [
    queryKeys.budgets.lists(),
    queryKeys.budgets.detail(input.budget_id),
    queryKeys.budgets.full(input.budget_id),
    queryKeys.budgets.sectionSummary(),
  ],
})
