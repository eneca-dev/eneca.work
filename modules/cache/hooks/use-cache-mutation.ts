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
            // Получаем query key (может быть partial key для matching)
            const queryKey =
              typeof config.optimisticUpdate!.queryKey === 'function'
                ? config.optimisticUpdate!.queryKey(input)
                : config.optimisticUpdate!.queryKey

            // Отменяем текущие запросы с этим ключом (partial match)
            await queryClient.cancelQueries({ queryKey })

            // Собираем предыдущие данные для всех matching queries
            const previousQueries: Array<{ queryKey: readonly unknown[]; data: TData[] }> = []

            // Применяем optimistic update ко ВСЕМ queries с matching key
            queryClient.setQueriesData<TData[]>(
              { queryKey },
              (oldData) => {
                if (oldData !== undefined) {
                  // Сохраняем для отката
                  const fullQueryKey = queryClient.getQueryCache()
                    .findAll({ queryKey })
                    .find(q => q.state.data === oldData)?.queryKey || queryKey
                  previousQueries.push({ queryKey: fullQueryKey, data: oldData })

                  // Применяем update
                  return config.optimisticUpdate!.updater(oldData, input)
                }
                return oldData
              }
            )

            // Возвращаем контекст для отката
            return { previousQueries, queryKey } as TContext
          }
        : undefined,

      onError: (error, input, context) => {
        // Откатываем optimistic update при ошибке
        if (config.optimisticUpdate && context) {
          const ctx = context as { previousQueries: Array<{ queryKey: readonly unknown[]; data: TData[] }>; queryKey: readonly unknown[] }
          // Восстанавливаем все предыдущие данные
          for (const { queryKey: qk, data } of ctx.previousQueries || []) {
            queryClient.setQueryData(qk, data)
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
 * Фабрика для создания мутации создания с optimistic update
 *
 * @example
 * const useCreateProject = createCreateMutation({
 *   mutationFn: createProject,
 *   listQueryKey: queryKeys.projects.lists(),
 *   buildOptimisticItem: (input) => ({
 *     project_id: 'temp-' + Date.now(),
 *     project_name: input.name,
 *     ...input,
 *     _isOptimistic: true,
 *   }),
 *   invalidateKeys: [queryKeys.projects.all],
 * })
 */
export function createCreateMutation<TInput, TData extends { [key: string]: unknown }>(config: {
  mutationFn: (input: TInput) => Promise<ActionResult<TData>>
  listQueryKey: readonly unknown[]
  buildOptimisticItem: (input: TInput) => TData
  invalidateKeys?: readonly unknown[][]
  onSuccess?: (data: TData, input: TInput) => void
  onError?: (error: Error, input: TInput) => void
}) {
  return createCacheMutation<TInput, TData>({
    mutationFn: config.mutationFn,
    optimisticUpdate: {
      queryKey: config.listQueryKey,
      updater: (old, input) => {
        const optimisticItem = config.buildOptimisticItem(input)
        return old ? [...old, optimisticItem] : [optimisticItem]
      },
    },
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
 * Поддерживает обновление как списков, так и detail-кеша для мгновенного отклика UI.
 *
 * @example
 * const useUpdateProject = createUpdateMutation({
 *   mutationFn: updateProject,
 *   listQueryKey: queryKeys.projects.lists(),
 *   detailQueryKey: (input) => queryKeys.projects.detail(input.project_id),
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
  /** Опциональный query key для обновления detail-кеша (одиночного элемента) */
  detailQueryKey?: (input: TInput) => readonly unknown[]
  getId: (input: TInput) => string
  getItemId: (item: TData) => string
  merge: (item: TData, input: TInput) => TData
  invalidateKeys?: readonly unknown[][]
  onSuccess?: (data: TData, input: TInput) => void
  onError?: (error: Error, input: TInput) => void
}) {
  return function useUpdateMutation(options?: MutationHookOptions<TData, TInput>) {
    const queryClient = useQueryClient()

    return useMutation<TData, Error, TInput>({
      mutationFn: async (input: TInput) => {
        const result = await config.mutationFn(input)
        if (!result.success) {
          throw new Error(result.error)
        }
        return result.data
      },

      onMutate: async (input: TInput) => {
        // Отменяем текущие запросы для списков
        await queryClient.cancelQueries({ queryKey: config.listQueryKey })

        // Сохраняем предыдущие данные для списков
        const previousLists: Array<{ queryKey: readonly unknown[]; data: TData[] }> = []

        // Применяем optimistic update к спискам
        queryClient.setQueriesData<TData[]>(
          { queryKey: config.listQueryKey },
          (oldData) => {
            if (oldData !== undefined) {
              // Сохраняем для отката
              const fullQueryKey = queryClient.getQueryCache()
                .findAll({ queryKey: config.listQueryKey })
                .find(q => q.state.data === oldData)?.queryKey || config.listQueryKey
              previousLists.push({ queryKey: fullQueryKey, data: oldData })

              // Применяем update
              const idToUpdate = config.getId(input)
              return oldData.map((item) =>
                config.getItemId(item) === idToUpdate ? config.merge(item, input) : item
              )
            }
            return oldData
          }
        )

        // Обновляем detail-кеш, если указан detailQueryKey
        let previousDetail: { queryKey: readonly unknown[]; data: TData | undefined } | null = null

        if (config.detailQueryKey) {
          const detailKey = config.detailQueryKey(input)

          // Отменяем текущие запросы для detail
          await queryClient.cancelQueries({ queryKey: detailKey })

          // Получаем старые данные
          const oldDetailData = queryClient.getQueryData<TData>(detailKey)

          if (oldDetailData) {
            // Сохраняем для отката
            previousDetail = { queryKey: detailKey, data: oldDetailData }

            // Применяем update
            const newDetailData = config.merge(oldDetailData, input)

            queryClient.setQueryData<TData>(detailKey, newDetailData)
          }
        }

        // Возвращаем контекст для отката
        return { previousLists, previousDetail }
      },

      onError: (error, input, context) => {
        // Откатываем optimistic update при ошибке
        if (context) {
          const ctx = context as {
            previousLists: Array<{ queryKey: readonly unknown[]; data: TData[] }>
            previousDetail: { queryKey: readonly unknown[]; data: TData | undefined } | null
          }

          // Откатываем списки
          for (const { queryKey, data } of ctx.previousLists || []) {
            queryClient.setQueryData(queryKey, data)
          }

          // Откатываем detail
          if (ctx.previousDetail) {
            queryClient.setQueryData(ctx.previousDetail.queryKey, ctx.previousDetail.data)
          }
        }

        // Вызываем пользовательский обработчик
        config.onError?.(error, input)
      },

      onSuccess: async (data, input, context) => {
        // Инвалидируем ключи
        if (config.invalidateKeys) {
          await Promise.all(
            config.invalidateKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
          )
        }

        // Вызываем пользовательский обработчик
        config.onSuccess?.(data, input)
      },

      ...options?.mutationOptions,
    })
  }
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
