'use client'

/**
 * Mutation hooks for decomposition stages CRUD operations
 */

import { createCacheMutation, createDeleteMutation, queryKeys } from '@/modules/cache'
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
    queryKeys.resourceGraph.all,
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
    queryKeys.resourceGraph.all,
  ],
})

/**
 * Хук для удаления этапа декомпозиции
 *
 * @example
 * const { mutate: remove, isPending } = useDeleteDecompositionStage()
 * remove({ stageId, sectionId })
 */
export const useDeleteDecompositionStage = createDeleteMutation<
  { stageId: string; sectionId: string },
  { deleted: boolean }
>({
  mutationFn: ({ stageId }) => deleteDecompositionStage(stageId),
  listQueryKey: queryKeys.decomposition.all,
  getId: (input) => input.stageId,
  getItemId: () => '',
  invalidateKeys: [
    queryKeys.decomposition.all,
    queryKeys.sections.all,
    queryKeys.resourceGraph.all,
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
  ],
})
