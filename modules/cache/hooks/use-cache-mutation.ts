'use client'

import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query'
import type { ActionResult } from '../types'

// ============================================================================
// Types
// ============================================================================

/**
 * Конфигурация для создания mutation хука
 */
export interface CreateMutationConfig<TInput, TData, TContext = unknown> {
  /** Server Action для мутации */
  mutationFn: (input: TInput) => Promise<ActionResult<TData>>

  /**
   * Query keys для инвалидации после успешной мутации
   * Может быть массивом ключей или функцией, возвращающей ключи
   */
  invalidateKeys?: readonly unknown[][] | ((input: TInput, data: TData) => readonly unknown[][])

  /**
   * Конфигурация optimistic update
   */
  optimisticUpdate?: {
    /** Query key для optimistic update */
    queryKey: readonly unknown[] | ((input: TInput) => readonly unknown[])
    /** Функция для обновления кеша (возвращает новые данные) */
    updater: (oldData: TData[] | undefined, input: TInput) => TData[]
  }

  /**
   * Callbacks
   */
  onSuccess?: (data: TData, input: TInput, context: TContext | undefined) => void | Promise<void>
  onError?: (error: Error, input: TInput, context: TContext | undefined) => void | Promise<void>
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    input: TInput,
    context: TContext | undefined
  ) => void | Promise<void>
}

/**
 * Опции для хука мутации
 */
export interface MutationHookOptions<TData, TInput, TContext = unknown> {
  /** Дополнительные опции TanStack Query */
  mutationOptions?: Partial<
    Omit<UseMutationOptions<TData, Error, TInput, TContext>, 'mutationFn'>
  >
}

// ============================================================================
// Mutation Factory
// ============================================================================

/**
 * Фабрика для создания типизированных mutation хуков
 *
 * @example
 * // Простая мутация с инвалидацией
 * const useUpdateProject = createCacheMutation({
 *   mutationFn: updateProject,
 *   invalidateKeys: [queryKeys.projects.all],
 * })
 *
 * // Мутация с optimistic update
 * const useUpdateProjectOptimistic = createCacheMutation({
 *   mutationFn: updateProject,
 *   optimisticUpdate: {
 *     queryKey: queryKeys.projects.lists(),
 *     updater: (old, input) => old?.map(p =>
 *       p.project_id === input.project_id ? { ...p, ...input } : p
 *     ) ?? [],
 *   },
 *   invalidateKeys: [queryKeys.projects.all],
 * })
 */
export function createCacheMutation<TInput, TData, TContext = unknown>(
  config: CreateMutationConfig<TInput, TData, TContext>
) {
  return function useCacheMutation(options?: MutationHookOptions<TData, TInput, TContext>) {
    const queryClient = useQueryClient()

    return useMutation<TData, Error, TInput, TContext>({
      mutationFn: async (input: TInput) => {
        const result = await config.mutationFn(input)
        if (!result.success) {
          throw new Error(result.error)
        }
        return result.data
      },

      onMutate: config.optimisticUpdate
        ? async (input: TInput) => {
            // Получаем query key
            const queryKey =
              typeof config.optimisticUpdate!.queryKey === 'function'
                ? config.optimisticUpdate!.queryKey(input)
                : config.optimisticUpdate!.queryKey

            // Отменяем текущие запросы
            await queryClient.cancelQueries({ queryKey })

            // Сохраняем предыдущее состояние
            const previousData = queryClient.getQueryData<TData[]>(queryKey)

            // Применяем optimistic update
            if (previousData !== undefined) {
              queryClient.setQueryData<TData[]>(
                queryKey,
                config.optimisticUpdate!.updater(previousData, input)
              )
            }

            // Возвращаем контекст для отката
            return { previousData, queryKey } as TContext
          }
        : undefined,

      onError: (error, input, context) => {
        // Откатываем optimistic update при ошибке
        if (config.optimisticUpdate && context) {
          const ctx = context as { previousData: TData[]; queryKey: readonly unknown[] }
          if (ctx.previousData !== undefined) {
            queryClient.setQueryData(ctx.queryKey, ctx.previousData)
          }
        }

        // Вызываем пользовательский обработчик
        config.onError?.(error, input, context)
      },

      onSuccess: async (data, input, context) => {
        // Инвалидируем ключи
        if (config.invalidateKeys) {
          const keys =
            typeof config.invalidateKeys === 'function'
              ? config.invalidateKeys(input, data)
              : config.invalidateKeys

          await Promise.all(
            keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
          )
        }

        // Вызываем пользовательский обработчик
        config.onSuccess?.(data, input, context)
      },

      onSettled: config.onSettled,

      ...options?.mutationOptions,
    })
  }
}

/**
 * Фабрика для создания простой мутации без optimistic updates
 *
 * @example
 * const useDeleteProject = createSimpleMutation({
 *   mutationFn: deleteProject,
 *   invalidateKeys: [queryKeys.projects.all],
 *   onSuccess: () => toast.success('Проект удалён'),
 * })
 */
export function createSimpleMutation<TInput, TData>(config: {
  mutationFn: (input: TInput) => Promise<ActionResult<TData>>
  invalidateKeys?: readonly unknown[][]
  onSuccess?: (data: TData, input: TInput) => void
  onError?: (error: Error, input: TInput) => void
}) {
  return createCacheMutation<TInput, TData>({
    mutationFn: config.mutationFn,
    invalidateKeys: config.invalidateKeys,
    onSuccess: config.onSuccess,
    onError: config.onError,
  })
}

/**
 * Фабрика для создания мутации удаления с optimistic update
 *
 * @example
 * const useDeleteProject = createDeleteMutation({
 *   mutationFn: deleteProject,
 *   listQueryKey: queryKeys.projects.lists(),
 *   getId: (input) => input.projectId,
 *   getItemId: (item) => item.project_id,
 *   invalidateKeys: [queryKeys.projects.all],
 * })
 */
export function createDeleteMutation<TInput, TData extends { [key: string]: unknown }>(config: {
  mutationFn: (input: TInput) => Promise<ActionResult<TData>>
  listQueryKey: readonly unknown[]
  getId: (input: TInput) => string
  getItemId: (item: TData) => string
  invalidateKeys?: readonly unknown[][]
  onSuccess?: (data: TData, input: TInput) => void
  onError?: (error: Error, input: TInput) => void
}) {
  return createCacheMutation<TInput, TData>({
    mutationFn: config.mutationFn,
    optimisticUpdate: {
      queryKey: config.listQueryKey,
      updater: (old, input) => {
        if (!old) return []
        const idToDelete = config.getId(input)
        return old.filter((item) => config.getItemId(item) !== idToDelete)
      },
    },
    invalidateKeys: config.invalidateKeys,
    onSuccess: config.onSuccess,
    onError: config.onError,
  })
}

/**
 * Фабрика для создания мутации обновления с optimistic update
 *
 * @example
 * const useUpdateProject = createUpdateMutation({
 *   mutationFn: updateProject,
 *   listQueryKey: queryKeys.projects.lists(),
 *   getId: (input) => input.project_id,
 *   getItemId: (item) => item.project_id,
 *   merge: (item, input) => ({ ...item, ...input }),
 *   invalidateKeys: [queryKeys.projects.all],
 * })
 */
export function createUpdateMutation<
  TInput extends { [key: string]: unknown },
  TData extends { [key: string]: unknown }
>(config: {
  mutationFn: (input: TInput) => Promise<ActionResult<TData>>
  listQueryKey: readonly unknown[]
  getId: (input: TInput) => string
  getItemId: (item: TData) => string
  merge: (item: TData, input: TInput) => TData
  invalidateKeys?: readonly unknown[][]
  onSuccess?: (data: TData, input: TInput) => void
  onError?: (error: Error, input: TInput) => void
}) {
  return createCacheMutation<TInput, TData>({
    mutationFn: config.mutationFn,
    optimisticUpdate: {
      queryKey: config.listQueryKey,
      updater: (old, input) => {
        if (!old) return []
        const idToUpdate = config.getId(input)
        return old.map((item) =>
          config.getItemId(item) === idToUpdate ? config.merge(item, input) : item
        )
      },
    },
    invalidateKeys: config.invalidateKeys,
    onSuccess: config.onSuccess,
    onError: config.onError,
  })
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Тип для извлечения типа данных из mutation хука
 */
export type InferMutationData<T> = T extends ReturnType<
  typeof createCacheMutation<infer _TInput, infer TData>
>
  ? TData
  : never

/**
 * Тип для извлечения типа входных данных из mutation хука
 */
export type InferMutationInput<T> = T extends ReturnType<
  typeof createCacheMutation<infer TInput, infer _TData>
>
  ? TInput
  : never
