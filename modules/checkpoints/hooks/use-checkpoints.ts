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
  createCreateMutation,
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
 * Хук для создания нового чекпоинта с optimistic update
 *
 * Мгновенно добавляет чекпоинт в список с временным ID.
 * После успешного создания на сервере заменяет temporary item реальными данными.
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
 * // Модалка закрывается сразу, чекпоинт появляется на графике мгновенно
 * ```
 */
export const useCreateCheckpoint = createCreateMutation({
  mutationFn: createCheckpoint,
  listQueryKey: queryKeys.checkpoints.lists(),
  buildOptimisticItem: (input: CreateCheckpointInput): Checkpoint => {
    // Создаем временный ID для optimistic item
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Находим тип чекпоинта для получения иконки и цвета
    // Примечание: это упрощенная версия, реальные данные придут с сервера
    const now = new Date().toISOString()

    return {
      checkpoint_id: tempId,
      section_id: input.sectionId,
      type_id: input.typeId,
      type_code: 'custom', // Будет обновлено с сервера
      type_name: input.title || 'Новый чекпоинт',
      is_custom: !!input.customIcon,
      title: input.title || 'Новый чекпоинт',
      description: input.description || null,
      checkpoint_date: input.checkpointDate,
      icon: input.customIcon || 'Flag',
      color: input.customColor || '#6b7280',
      completed_at: null,
      completed_by: null,
      status: 'pending',
      status_label: 'Ожидается',
      created_by: null, // Будет установлено сервером
      created_at: now,
      updated_at: now,
      section_responsible: null,
      project_manager: null,
      linked_sections: (input.linkedSectionIds || []).map(id => ({
        section_id: id,
        section_name: 'Загрузка...', // Будет обновлено с сервера
      })),
      linked_sections_count: (input.linkedSectionIds || []).length,
    }
  },
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
  listQueryKey: queryKeys.checkpoints.lists(),
  getId: (input: UpdateCheckpointInput) => input.checkpointId,
  getItemId: (item: Checkpoint) => item.checkpoint_id,
  merge: (item: Checkpoint, input: UpdateCheckpointInput) => ({
    ...item,
    type_id: input.typeId ?? item.type_id,
    title: input.title ?? item.title,
    description: input.description ?? item.description,
    checkpoint_date: input.checkpointDate ?? item.checkpoint_date,
    // Для optimistic update используем _optimisticIcon/_optimisticColor если есть
    icon: input._optimisticIcon ?? input.customIcon ?? item.icon,
    color: input._optimisticColor ?? input.customColor ?? item.color,
    // linked_sections обновятся после рефетча с сервера
  }),
  invalidateKeys: [
    queryKeys.sections.all,
    queryKeys.resourceGraph.all,
  ],
})

/**
 * Вычисляет статус чекпоинта на основе дат
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
      completed_by: input.completed ? 'optimistic-user-id' : null, // Сервер вернет реальный user_id
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
