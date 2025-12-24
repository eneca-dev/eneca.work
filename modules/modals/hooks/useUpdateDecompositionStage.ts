'use client'

/**
 * Mutation hooks for decomposition stages CRUD operations
 */

import { createCacheMutation, queryKeys } from '@/modules/cache'
import {
  createDecompositionStage,
  updateDecompositionStage,
  deleteDecompositionStage,
  reorderDecompositionStages,
  type CreateStageInput,
  type UpdateStageInput,
  type ReorderStagesInput,
  type StageResult,
} from '../actions'

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Хук для создания нового этапа декомпозиции
 *
 * @example
 * const { mutate: create, isPending } = useCreateDecompositionStage()
 * create({ sectionId, name: 'Новый этап', responsibles: [] })
 */
export const useCreateDecompositionStage = createCacheMutation<CreateStageInput, StageResult>({
  mutationFn: createDecompositionStage,
  invalidateKeys: (input) => [
    queryKeys.decomposition.bootstrap(input.sectionId),
    queryKeys.decomposition.stages(input.sectionId),
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
 * Хук для обновления этапа декомпозиции
 *
 * @example
 * const { mutate: update, isPending } = useUpdateDecompositionStage()
 * update({ stageId, name: 'Обновлённое имя', statusId: 'status-id' })
 */
export const useUpdateDecompositionStage = createCacheMutation<
  UpdateStageInput & { sectionId: string },
  StageResult
>({
  mutationFn: (input) => updateDecompositionStage(input),
  invalidateKeys: (input) => [
    queryKeys.decomposition.bootstrap(input.sectionId),
    queryKeys.decomposition.stages(input.sectionId),
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
 * Хук для удаления этапа декомпозиции
 * Использует createCacheMutation вместо createDeleteMutation,
 * т.к. optimistic update обрабатывается в StagesManager локально
 *
 * @example
 * const { mutate: remove, isPending } = useDeleteDecompositionStage()
 * remove({ stageId, sectionId })
 */
export const useDeleteDecompositionStage = createCacheMutation<
  { stageId: string; sectionId: string },
  { deleted: boolean }
>({
  mutationFn: ({ stageId }) => deleteDecompositionStage(stageId),
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
 * Хук для изменения порядка этапов
 *
 * @example
 * const { mutate: reorder, isPending } = useReorderDecompositionStages()
 * reorder({ stages: [{ stageId: 'id-1', order: 0 }, { stageId: 'id-2', order: 1 }], sectionId })
 */
export const useReorderDecompositionStages = createCacheMutation<
  ReorderStagesInput & { sectionId: string },
  { reordered: boolean }
>({
  mutationFn: (input) => reorderDecompositionStages(input),
  invalidateKeys: (input) => [
    queryKeys.decomposition.bootstrap(input.sectionId),
    queryKeys.decomposition.stages(input.sectionId),
    queryKeys.decomposition.all,
    // Resource graph - оба ключа для гарантированной инвалидации
    queryKeys.resourceGraph.all,
    queryKeys.resourceGraph.lists(),
    // Kanban - для обновления канбан-доски
    queryKeys.kanban.all,
  ],
})
