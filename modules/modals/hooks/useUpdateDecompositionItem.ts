'use client'

/**
 * Mutation hooks for decomposition items CRUD operations
 */

import { createCacheMutation, queryKeys } from '@/modules/cache'
import {
  createDecompositionItem,
  updateDecompositionItem,
  deleteDecompositionItem,
  moveDecompositionItems,
  reorderDecompositionItems,
  bulkCreateDecompositionItems,
  bulkDeleteDecompositionItems,
  type CreateItemInput,
  type UpdateItemInput,
  type MoveItemsInput,
  type ReorderItemsInput,
  type ItemResult,
} from '../actions'

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Хук для создания новой задачи декомпозиции
 *
 * @example
 * const { mutate: create, isPending } = useCreateDecompositionItem()
 * create({ sectionId, stageId, description: 'Новая задача', workCategoryId, plannedHours: 8 })
 */
export const useCreateDecompositionItem = createCacheMutation<CreateItemInput, ItemResult>({
  mutationFn: createDecompositionItem,
  invalidateKeys: (input) => [
    queryKeys.decomposition.bootstrap(input.sectionId),
    input.stageId ? queryKeys.decomposition.items(input.stageId) : undefined,
    queryKeys.decomposition.all,
    queryKeys.sections.all,
    // Resource graph - оба ключа для гарантированной инвалидации
    queryKeys.resourceGraph.all,
    queryKeys.resourceGraph.lists(),
    // Kanban - для обновления канбан-доски
    queryKeys.kanban.all,
  ].filter(Boolean) as readonly unknown[][],
})

/**
 * Хук для обновления задачи декомпозиции
 *
 * @example
 * const { mutate: update, isPending } = useUpdateDecompositionItem()
 * update({ itemId, description: 'Обновлённое описание', progress: 50 })
 */
export const useUpdateDecompositionItem = createCacheMutation<
  UpdateItemInput & { sectionId: string },
  ItemResult
>({
  mutationFn: (input) => updateDecompositionItem(input),
  invalidateKeys: (input) => [
    queryKeys.decomposition.bootstrap(input.sectionId),
    input.stageId ? queryKeys.decomposition.items(input.stageId) : undefined,
    queryKeys.decomposition.all,
    queryKeys.sections.all,
    // Resource graph - оба ключа для гарантированной инвалидации
    queryKeys.resourceGraph.all,
    queryKeys.resourceGraph.lists(),
    // Kanban - для обновления канбан-доски
    queryKeys.kanban.all,
  ].filter(Boolean) as readonly unknown[][],
})

/**
 * Хук для удаления задачи декомпозиции
 * Использует createCacheMutation вместо createDeleteMutation,
 * т.к. optimistic update обрабатывается в StagesManager локально
 *
 * @example
 * const { mutate: remove, isPending } = useDeleteDecompositionItem()
 * remove({ itemId, sectionId })
 */
export const useDeleteDecompositionItem = createCacheMutation<
  { itemId: string; sectionId: string },
  { deleted: boolean }
>({
  mutationFn: ({ itemId }) => deleteDecompositionItem(itemId),
  invalidateKeys: (input) => [
    queryKeys.decomposition.bootstrap(input.sectionId),
    queryKeys.decomposition.all,
    queryKeys.sections.all,
    // Resource graph - оба ключа для гарантированной инвалидации
    queryKeys.resourceGraph.all,
    queryKeys.resourceGraph.lists(),
    // Kanban - для обновления канбан-доски
    queryKeys.kanban.all,
  ],
})

/**
 * Хук для перемещения задач в другой этап
 *
 * @example
 * const { mutate: move, isPending } = useMoveDecompositionItems()
 * move({ itemIds: ['id-1', 'id-2'], targetStageId: 'stage-id', sectionId })
 */
export const useMoveDecompositionItems = createCacheMutation<
  MoveItemsInput & { sectionId: string },
  { moved: boolean }
>({
  mutationFn: (input) => moveDecompositionItems(input),
  invalidateKeys: (input) => [
    queryKeys.decomposition.bootstrap(input.sectionId),
    queryKeys.decomposition.all,
    queryKeys.sections.all,
    // Resource graph - оба ключа для гарантированной инвалидации
    queryKeys.resourceGraph.all,
    queryKeys.resourceGraph.lists(),
    // Kanban - для обновления канбан-доски
    queryKeys.kanban.all,
  ],
})

/**
 * Хук для изменения порядка задач
 *
 * @example
 * const { mutate: reorder, isPending } = useReorderDecompositionItems()
 * reorder({ items: [{ itemId: 'id-1', order: 0 }], sectionId })
 */
export const useReorderDecompositionItems = createCacheMutation<
  ReorderItemsInput & { sectionId: string },
  { reordered: boolean }
>({
  mutationFn: (input) => reorderDecompositionItems(input),
  invalidateKeys: (input) => [
    queryKeys.decomposition.bootstrap(input.sectionId),
    queryKeys.decomposition.all,
    queryKeys.sections.all,
    // Resource graph - оба ключа для гарантированной инвалидации
    queryKeys.resourceGraph.all,
    queryKeys.resourceGraph.lists(),
    // Kanban - для обновления канбан-доски
    queryKeys.kanban.all,
  ],
})

/**
 * Хук для массового создания задач (вставка из Excel)
 *
 * @example
 * const { mutate: bulkCreate, isPending } = useBulkCreateDecompositionItems()
 * bulkCreate({ items: [...], sectionId })
 */
export const useBulkCreateDecompositionItems = createCacheMutation<
  { items: CreateItemInput[]; sectionId: string },
  ItemResult[]
>({
  mutationFn: ({ items }) => bulkCreateDecompositionItems(items),
  invalidateKeys: (input) => [
    queryKeys.decomposition.bootstrap(input.sectionId),
    queryKeys.decomposition.all,
    queryKeys.sections.all,
    // Resource graph - оба ключа для гарантированной инвалидации
    queryKeys.resourceGraph.all,
    queryKeys.resourceGraph.lists(),
    // Kanban - для обновления канбан-доски
    queryKeys.kanban.all,
  ],
})

/**
 * Хук для массового удаления задач
 *
 * @example
 * const { mutate: bulkDelete, isPending } = useBulkDeleteDecompositionItems()
 * bulkDelete({ itemIds: ['id-1', 'id-2'], sectionId })
 */
export const useBulkDeleteDecompositionItems = createCacheMutation<
  { itemIds: string[]; sectionId: string },
  { deleted: number }
>({
  mutationFn: ({ itemIds }) => bulkDeleteDecompositionItems(itemIds),
  invalidateKeys: (input) => [
    queryKeys.decomposition.bootstrap(input.sectionId),
    queryKeys.decomposition.all,
    queryKeys.sections.all,
    // Resource graph - оба ключа для гарантированной инвалидации
    queryKeys.resourceGraph.all,
    queryKeys.resourceGraph.lists(),
    // Kanban - для обновления канбан-доски
    queryKeys.kanban.all,
  ],
})
