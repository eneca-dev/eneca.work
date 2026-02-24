// modules/checkpoints/hooks/use-checkpoint-types.ts
'use client'

import {
  createCacheQuery,
  createCacheMutation,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import {
  getCheckpointTypes,
  createCheckpointType,
  updateCheckpointType,
  deleteCheckpointType,
  type CheckpointType,
  type CreateCheckpointTypeInput,
  type UpdateCheckpointTypeInput,
} from '../actions/checkpoint-types'

/**
 * Загрузка списка всех типов чекпоинтов.
 * Используется в SELECT dropdown и админ-панели.
 */
export const useCheckpointTypes = createCacheQuery<CheckpointType[]>({
  queryKey: () => queryKeys.checkpointTypes.list(),
  queryFn: getCheckpointTypes,
  staleTime: staleTimePresets.slow, // Типы меняются редко (5 минут)
})

/**
 * Создание нового типа чекпоинта (только для админов).
 * Инвалидирует список типов.
 */
export const useCreateCheckpointType = createCacheMutation<
  CreateCheckpointTypeInput,
  CheckpointType
>({
  mutationFn: createCheckpointType,
  invalidateKeys: (): readonly unknown[][] => [
    [...queryKeys.checkpointTypes.all],
  ],
})

/**
 * Редактирование типа чекпоинта (только для админов).
 * Инвалидирует типы И чекпоинты (т.к. icon/color из типа используются в VIEW).
 */
export const useUpdateCheckpointType = createCacheMutation<
  UpdateCheckpointTypeInput,
  CheckpointType
>({
  mutationFn: updateCheckpointType,
  invalidateKeys: (): readonly unknown[][] => [
    [...queryKeys.checkpointTypes.all],
    [...queryKeys.checkpoints.all],
  ],
})

/**
 * Удаление типа чекпоинта (только для админов).
 * Проверка: тип не должен использоваться в чекпоинтах (FK RESTRICT).
 */
export const useDeleteCheckpointType = createCacheMutation<
  string,
  { deleted: boolean }
>({
  mutationFn: deleteCheckpointType,
  invalidateKeys: (): readonly unknown[][] => [
    [...queryKeys.checkpointTypes.all],
  ],
})
