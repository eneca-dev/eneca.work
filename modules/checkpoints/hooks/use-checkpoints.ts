'use client'

/**
 * Хуки для работы с чекпоинтами
 *
 * Инкапсулируют логику кеширования, загрузки данных и автоматической
 * инвалидации кеша для модуля checkpoints.
 *
 * Optimistic updates используются только для операций complete/delete.
 * Для create/update используется инвалидация кеша с перезагрузкой данных.
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
  getProjectSections,
  type Checkpoint,
  type CreateCheckpointInput,
  type UpdateCheckpointInput,
  type CompleteCheckpointInput,
  type AuditEntry,
  type SectionOption,
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
// Constants
// ============================================================================

/** Временный ID пользователя для optimistic updates (будет заменен сервером) */
const OPTIMISTIC_USER_ID = 'optimistic-user-id' as const

// ============================================================================
// Mutation Hooks (изменение данных)
// ============================================================================

/**
 * Хук для создания нового чекпоинта
 *
 * После успешного создания на сервере автоматически инвалидирует кеш,
 * что приводит к перезагрузке только затронутых списков чекпоинтов
 * (родительского раздела и связанных разделов).
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
export const useCreateCheckpoint = createCacheMutation<CreateCheckpointInput, Checkpoint>({
  mutationFn: createCheckpoint,
  invalidateKeys: [
    queryKeys.checkpoints.all,
    queryKeys.sections.all,
    queryKeys.resourceGraph.all,
  ],
})

/**
 * Хук для обновления чекпоинта
 *
 * Обновляет чекпоинт и автоматически инвалидирует все связанные кеши.
 * После обновления списки чекпоинтов для всех затронутых разделов
 * (родительского и связанных) будут перезагружены с сервера.
 *
 * @example
 * ```tsx
 * const updateMutation = useUpdateCheckpoint()
 * updateMutation.mutate({
 *   checkpointId: 'uuid',
 *   title: 'Новое название',
 *   checkpointDate: '2026-01-15',
 *   linkedSectionIds: ['section-1', 'section-2'],
 * })
 * ```
 */
export const useUpdateCheckpoint = createCacheMutation<UpdateCheckpointInput, Checkpoint>({
  mutationFn: updateCheckpoint,
  invalidateKeys: [
    queryKeys.checkpoints.all,
    queryKeys.sections.all,
    queryKeys.resourceGraph.all,
  ],
})

/**
 * Вычисляет статус чекпоинта на основе дат
 *
 * Используется в useCompleteCheckpoint для optimistic update.
 * Логика соответствует VIEW logic из миграции 2025-12-18_section_checkpoints_status_audit.sql
 */
function calculateCheckpointStatus(
  completedAt: string | null,
  checkpointDate: string
): Checkpoint['status'] {
  const now = new Date()
  now.setHours(0, 0, 0, 0) // Сброс времени для корректного сравнения дат

  const deadline = new Date(checkpointDate)
  deadline.setHours(0, 0, 0, 0)

  if (completedAt) {
    const completed = new Date(completedAt)
    completed.setHours(0, 0, 0, 0)

    // Выполнен в срок или с опозданием
    return completed <= deadline ? 'completed' : 'completed_late'
  }

  // Не выполнен: просрочен или ожидается
  return now > deadline ? 'overdue' : 'pending'
}

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
  listQueryKey: queryKeys.checkpoints.lists(),
  getId: (input: CompleteCheckpointInput) => input.checkpointId,
  getItemId: (item: Checkpoint) => item.checkpoint_id,
  merge: (item: Checkpoint, input: CompleteCheckpointInput) => {
    const completedAt = input.completed ? new Date().toISOString() : null
    const status = calculateCheckpointStatus(completedAt, item.checkpoint_date)

    return {
      ...item,
      completed_at: completedAt,
      completed_by: input.completed ? OPTIMISTIC_USER_ID : null,
      status,
    }
  },
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
  listQueryKey: queryKeys.checkpoints.lists(),
  getId: (checkpointId: string) => checkpointId,
  getItemId: (item: Checkpoint) => item.checkpoint_id,
  invalidateKeys: [
    queryKeys.checkpoints.all,
    queryKeys.sections.all,
    queryKeys.resourceGraph.all,
  ],
})

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Хук для загрузки разделов проекта
 *
 * Используется для выбора связанных разделов в CheckpointEditModal.
 * Загружает только разделы того же проекта, что и указанный раздел.
 *
 * @example
 * ```tsx
 * const { data: sections, isLoading } = useProjectSections(checkpoint.section_id)
 * ```
 */
export const useProjectSections = createDetailCacheQuery({
  queryKey: (sectionId: string) => queryKeys.checkpoints.projectSections(sectionId),
  queryFn: getProjectSections,
  staleTime: 'medium', // 5 минут — структура проекта меняется редко
})
