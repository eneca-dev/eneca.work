'use client'

/**
 * Loading Modal 2 - Hook для мутаций загрузок
 *
 * Предоставляет операции CRUD для загрузок сотрудников:
 * - create: создание новой загрузки
 * - update: обновление существующей загрузки
 * - archive: архивация загрузки (soft delete)
 * - delete: удаление загрузки (hard delete)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import {
  createLoading,
  updateLoading,
  archiveLoading,
  deleteLoading,
} from '../actions/loadings'
import type {
  CreateLoadingInput,
  UpdateLoadingInput,
  ArchiveLoadingInput,
  DeleteLoadingInput,
  LoadingResult,
} from '../actions/loadings'

export interface UseLoadingMutationsOptions {
  /** Callback при успешном создании */
  onCreateSuccess?: (data: LoadingResult) => void
  /** Callback при успешном обновлении */
  onUpdateSuccess?: (data: LoadingResult) => void
  /** Callback при успешной архивации */
  onArchiveSuccess?: (data: LoadingResult) => void
  /** Callback при успешном удалении */
  onDeleteSuccess?: (id: string) => void
  /** Callback при ошибке */
  onError?: (error: Error) => void
}

export function useLoadingMutations(options: UseLoadingMutationsOptions = {}) {
  const queryClient = useQueryClient()

  // Создание загрузки
  const create = useMutation({
    mutationFn: async (input: CreateLoadingInput) => {
      const result = await createLoading(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    onSuccess: (data) => {
      // Инвалидация кешей (Next.js revalidatePath уже выполнен в action)
      queryClient.invalidateQueries({ queryKey: queryKeys.loadings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })

      options.onCreateSuccess?.(data)
    },
    onError: (error: Error) => {
      options.onError?.(error)
    },
  })

  // Обновление загрузки
  const update = useMutation({
    mutationFn: async (input: UpdateLoadingInput) => {
      const result = await updateLoading(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loadings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })

      options.onUpdateSuccess?.(data)
    },
    onError: (error: Error) => {
      options.onError?.(error)
    },
  })

  // Архивация загрузки
  const archive = useMutation({
    mutationFn: async (input: ArchiveLoadingInput) => {
      const result = await archiveLoading(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loadings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })

      options.onArchiveSuccess?.(data)
    },
    onError: (error: Error) => {
      options.onError?.(error)
    },
  })

  // Удаление загрузки
  const remove = useMutation({
    mutationFn: async (input: DeleteLoadingInput) => {
      const result = await deleteLoading(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loadings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })

      options.onDeleteSuccess?.(data.id)
    },
    onError: (error: Error) => {
      options.onError?.(error)
    },
  })

  return {
    create,
    update,
    archive,
    remove,
  }
}

export type {
  CreateLoadingInput,
  UpdateLoadingInput,
  ArchiveLoadingInput,
  DeleteLoadingInput,
  LoadingResult,
}
