'use client'

/**
 * Hook for managing section readiness checkpoints
 * Provides query and mutation hooks for CRUD operations
 */

import {
  createDetailCacheQuery,
  createCacheMutation,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import {
  getSectionReadinessCheckpoints,
  createReadinessCheckpoint,
  updateReadinessCheckpoint,
  deleteReadinessCheckpoint,
  type ReadinessCheckpoint,
  type CreateCheckpointInput,
  type UpdateCheckpointInput,
} from '../actions'

// ============================================================================
// Query Hook
// ============================================================================

/**
 * Хук для получения контрольных точек плановой готовности раздела
 *
 * @example
 * const { data: checkpoints, isLoading } = useReadinessCheckpoints(sectionId)
 */
export const useReadinessCheckpoints = createDetailCacheQuery<ReadinessCheckpoint[]>({
  queryKey: (sectionId) => queryKeys.sections.readinessCheckpoints(sectionId),
  queryFn: getSectionReadinessCheckpoints,
  staleTime: staleTimePresets.fast, // 2 минуты
})

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Хук для создания контрольной точки
 *
 * @example
 * const { mutate: create, isPending } = useCreateReadinessCheckpoint()
 * create({ sectionId, date: '2024-03-01', plannedReadiness: 50 })
 */
export const useCreateReadinessCheckpoint = createCacheMutation<
  CreateCheckpointInput,
  ReadinessCheckpoint
>({
  mutationFn: createReadinessCheckpoint,
  invalidateKeys: (input, data) => [
    queryKeys.sections.readinessCheckpoints(data.sectionId),
    queryKeys.resourceGraph.all,
    queryKeys.resourceGraph.lists(),
  ],
})

/**
 * Хук для обновления контрольной точки
 * Требует sectionId в input для инвалидации кеша
 *
 * @example
 * const { mutate: update, isPending } = useUpdateReadinessCheckpoint()
 * update({ checkpointId, sectionId, date: '2024-03-15', plannedReadiness: 75 })
 */
export const useUpdateReadinessCheckpoint = createCacheMutation<
  UpdateCheckpointInput & { sectionId: string },
  ReadinessCheckpoint
>({
  mutationFn: (input) =>
    updateReadinessCheckpoint({
      checkpointId: input.checkpointId,
      date: input.date,
      plannedReadiness: input.plannedReadiness,
    }),
  invalidateKeys: (input) => [
    queryKeys.sections.readinessCheckpoints(input.sectionId),
    queryKeys.resourceGraph.all,
    queryKeys.resourceGraph.lists(),
  ],
})

/**
 * Хук для удаления контрольной точки
 * Требует sectionId в input для инвалидации кеша
 *
 * @example
 * const { mutate: remove, isPending } = useDeleteReadinessCheckpoint()
 * remove({ checkpointId, sectionId })
 */
export const useDeleteReadinessCheckpoint = createCacheMutation<
  { checkpointId: string; sectionId: string },
  { deleted: boolean }
>({
  mutationFn: ({ checkpointId }) => deleteReadinessCheckpoint(checkpointId),
  invalidateKeys: (input) => [
    queryKeys.sections.readinessCheckpoints(input.sectionId),
    queryKeys.resourceGraph.all,
    queryKeys.resourceGraph.lists(),
  ],
})
