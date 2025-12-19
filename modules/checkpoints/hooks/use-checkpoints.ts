'use client'

/**
 * Хуки для работы с чекпоинтами
 *
 * Инкапсулируют логику кеширования, загрузки данных, optimistic updates
 * и автоматической инвалидации кеша для модуля checkpoints.
 *
 * @module modules/checkpoints/hooks/use-checkpoints
 */

import {
  createCacheQuery,
  createDetailCacheQuery,
  createCacheMutation,
  createUpdateMutation,
  createDeleteMutation,
  queryKeys,
} from '@/modules/cache'

import {
  getCheckpoints,
  getCheckpoint,
  getCheckpointAudit,
  createCheckpoint,
  updateCheckpoint,
  completeCheckpoint,
  deleteCheckpoint,
  type Checkpoint,
  type CreateCheckpointInput,
  type UpdateCheckpointInput,
  type CompleteCheckpointInput,
  type AuditEntry,
} from '@/modules/checkpoints/actions/checkpoints'

import type { CheckpointFilters } from '@/modules/cache/keys/query-keys'

// ============================================================================
// Query Hooks (чтение данных)
// ============================================================================

/**
 * Хук для загрузки списка чекпоинтов с фильтрацией
 *
 * @example
 * ```tsx
 * const { data: checkpoints, isLoading } = useCheckpoints({ sectionId: 'uuid' })
 * ```
 */
export const useCheckpoints = createCacheQuery({
  queryKey: (filters?: CheckpointFilters) => queryKeys.checkpoints.list(filters),
  queryFn: getCheckpoints,
  staleTime: 'fast', // 30 секунд — данные меняются часто
})

/**
 * Хук для загрузки детальной информации о чекпоинте
 *
 * @example
 * ```tsx
 * const { data: checkpoint } = useCheckpoint(checkpointId)
 * ```
 */
export const useCheckpoint = createDetailCacheQuery({
  queryKey: (id: string) => queryKeys.checkpoints.detail(id),
  queryFn: getCheckpoint,
  staleTime: 'fast',
})

/**
 * Хук для загрузки истории изменений чекпоинта (audit trail)
 *
 * @example
 * ```tsx
 * const { data: audit } = useCheckpointAudit(checkpointId)
 * ```
 */
export const useCheckpointAudit = createDetailCacheQuery({
  queryKey: (id: string) => queryKeys.checkpoints.audit(id),
  queryFn: getCheckpointAudit,
  staleTime: 'medium', // 5 минут — история редко меняется
})

// ============================================================================
// Mutation Hooks (изменение данных)
// ============================================================================

/**
 * Хук для создания нового чекпоинта
 *
 * Автоматически инвалидирует кеш:
 * - checkpoints.all (списки чекпоинтов)
 * - sections.all (у секций есть счетчики чекпоинтов)
 * - resourceGraph.all (timeline с чекпоинтами)
 *
 * @example
 * ```tsx
 * const createMutation = useCreateCheckpoint()
 * createMutation.mutate({
 *   sectionId: 'uuid',
 *   typeId: 'exam-type-uuid',
 *   title: 'Экспертиза',
 *   checkpointDate: '2025-12-31',
 * })
 * ```
 */
export const useCreateCheckpoint = createCacheMutation({
  mutationFn: createCheckpoint,
  invalidateKeys: [
    queryKeys.checkpoints.all,
    queryKeys.sections.all,
    queryKeys.resourceGraph.all,
  ],
})

/**
 * Хук для обновления чекпоинта с optimistic update
 *
 * Мгновенно обновляет UI до получения ответа от сервера.
 * При ошибке откатывает изменения.
 *
 * @example
 * ```tsx
 * const updateMutation = useUpdateCheckpoint()
 * updateMutation.mutate({
 *   checkpointId: 'uuid',
 *   title: 'Новое название',
 *   checkpointDate: '2026-01-15',
 * })
 * ```
 */
export const useUpdateCheckpoint = createUpdateMutation({
  mutationFn: updateCheckpoint,
  listQueryKey: queryKeys.checkpoints.all,
  getId: (input: UpdateCheckpointInput) => input.checkpointId,
  getItemId: (item: Checkpoint) => item.checkpoint_id,
  merge: (item: Checkpoint, input: UpdateCheckpointInput) => ({
    ...item,
    title: input.title ?? item.title,
    description: input.description ?? item.description,
    checkpoint_date: input.checkpointDate ?? item.checkpoint_date,
    icon: input.customIcon ?? item.icon,
    color: input.customColor ?? item.color,
    // linked_sections обновятся после рефетча с сервера
  }),
  invalidateKeys: [
    queryKeys.sections.all,
    queryKeys.resourceGraph.all,
  ],
})

/**
 * Хук для отметки чекпоинта как выполненного/невыполненного
 *
 * Использует optimistic update для мгновенной реакции UI.
 *
 * @example
 * ```tsx
 * const completeMutation = useCompleteCheckpoint()
 * completeMutation.mutate({
 *   checkpointId: 'uuid',
 *   completed: true,
 * })
 * ```
 */
export const useCompleteCheckpoint = createUpdateMutation({
  mutationFn: completeCheckpoint,
  listQueryKey: queryKeys.checkpoints.all,
  getId: (input: CompleteCheckpointInput) => input.checkpointId,
  getItemId: (item: Checkpoint) => item.checkpoint_id,
  merge: (item: Checkpoint, input: CompleteCheckpointInput) => ({
    ...item,
    completed_at: input.completed ? new Date().toISOString() : null,
    completed_by: input.completed ? 'optimistic-user-id' : null, // Сервер вернет реальный user_id
    // status пересчитается на сервере (VIEW logic)
    status: input.completed ? 'completed' as const : 'pending' as const,
  }),
  invalidateKeys: [
    queryKeys.sections.all,
    queryKeys.resourceGraph.all,
  ],
})

/**
 * Хук для удаления чекпоинта
 *
 * Автоматически инвалидирует кеш:
 * - checkpoints.all
 * - sections.all
 * - resourceGraph.all
 *
 * @example
 * ```tsx
 * const deleteMutation = useDeleteCheckpoint()
 * deleteMutation.mutate(checkpointId)
 * ```
 */
export const useDeleteCheckpoint = createDeleteMutation({
  mutationFn: deleteCheckpoint,
  invalidateKeys: [
    queryKeys.checkpoints.all,
    queryKeys.sections.all,
    queryKeys.resourceGraph.all,
  ],
})
