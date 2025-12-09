'use client'

import { useQuery, useInfiniteQuery, UseQueryOptions, UseInfiniteQueryOptions } from '@tanstack/react-query'
import type { ActionResult, PaginatedActionResult } from '../types'
import { staleTimePresets } from '../client/query-client'

// ============================================================================
// Types
// ============================================================================

/**
 * Конфигурация для создания query хука
 */
export interface CreateQueryConfig<TData, TFilters = void> {
  /** Функция для генерации query key */
  queryKey: (filters: TFilters) => readonly unknown[]
  /** Server Action для получения данных */
  queryFn: (filters: TFilters) => Promise<ActionResult<TData>>
  /** Время "свежести" данных (по умолчанию medium - 3 мин) */
  staleTime?: number
  /** Время хранения в кеше после unmount (по умолчанию 30 мин) */
  gcTime?: number
}

/**
 * Конфигурация для создания infinite query хука (пагинация)
 */
export interface CreateInfiniteQueryConfig<TData, TFilters = void> {
  /** Функция для генерации query key */
  queryKey: (filters: TFilters) => readonly unknown[]
  /** Server Action для получения данных */
  queryFn: (filters: TFilters & { page: number }) => Promise<PaginatedActionResult<TData>>
  /** Время "свежести" данных */
  staleTime?: number
  /** Начальный размер страницы */
  pageSize?: number
}

/**
 * Опции для хука, создаваемого фабрикой
 */
export interface QueryHookOptions<TData> {
  /** Включить/выключить запрос */
  enabled?: boolean
  /** Дополнительные опции TanStack Query */
  queryOptions?: Partial<Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>>
}

// ============================================================================
// Query Factory
// ============================================================================

/**
 * Фабрика для создания типизированных query хуков
 *
 * @example
 * // Создание хука
 * const useProjects = createCacheQuery({
 *   queryKey: (filters) => queryKeys.projects.list(filters),
 *   queryFn: getProjects,
 *   staleTime: staleTimePresets.medium,
 * })
 *
 * // Использование в компоненте
 * const { data, isLoading, error } = useProjects({ status: 'active' })
 */
export function createCacheQuery<TData, TFilters = void>(
  config: CreateQueryConfig<TData, TFilters>
) {
  return function useCacheQuery(
    filters: TFilters,
    options?: QueryHookOptions<TData>
  ) {
    return useQuery({
      queryKey: config.queryKey(filters),
      queryFn: async () => {
        const result = await config.queryFn(filters)
        if (!result.success) {
          throw new Error(result.error)
        }
        return result.data
      },
      staleTime: config.staleTime ?? staleTimePresets.medium,
      gcTime: config.gcTime,
      enabled: options?.enabled,
      ...options?.queryOptions,
    })
  }
}

/**
 * Фабрика для создания query хука без фильтров
 *
 * @example
 * const useDepartments = createSimpleCacheQuery({
 *   queryKey: queryKeys.departments.list(),
 *   queryFn: getDepartments,
 *   staleTime: staleTimePresets.static,
 * })
 */
export function createSimpleCacheQuery<TData>(config: {
  queryKey: readonly unknown[]
  queryFn: () => Promise<ActionResult<TData>>
  staleTime?: number
  gcTime?: number
}) {
  return function useSimpleCacheQuery(options?: QueryHookOptions<TData>) {
    return useQuery({
      queryKey: config.queryKey,
      queryFn: async () => {
        const result = await config.queryFn()
        if (!result.success) {
          throw new Error(result.error)
        }
        return result.data
      },
      staleTime: config.staleTime ?? staleTimePresets.medium,
      gcTime: config.gcTime,
      enabled: options?.enabled,
      ...options?.queryOptions,
    })
  }
}

/**
 * Фабрика для создания detail query хука (по ID)
 *
 * @example
 * const useProject = createDetailCacheQuery({
 *   queryKey: (id) => queryKeys.projects.detail(id),
 *   queryFn: getProjectById,
 * })
 *
 * // Использование
 * const { data: project } = useProject('project-id-123')
 */
export function createDetailCacheQuery<TData>(config: {
  queryKey: (id: string) => readonly unknown[]
  queryFn: (id: string) => Promise<ActionResult<TData>>
  staleTime?: number
  gcTime?: number
}) {
  return function useDetailCacheQuery(
    id: string | undefined,
    options?: QueryHookOptions<TData>
  ) {
    return useQuery({
      queryKey: config.queryKey(id ?? ''),
      queryFn: async () => {
        if (!id) throw new Error('ID is required')
        const result = await config.queryFn(id)
        if (!result.success) {
          throw new Error(result.error)
        }
        return result.data
      },
      staleTime: config.staleTime ?? staleTimePresets.medium,
      gcTime: config.gcTime,
      enabled: !!id && (options?.enabled !== false),
      ...options?.queryOptions,
    })
  }
}

/**
 * Фабрика для создания infinite query хука (бесконечная прокрутка)
 *
 * @example
 * const useProjectsInfinite = createInfiniteCacheQuery({
 *   queryKey: (filters) => queryKeys.projects.list(filters),
 *   queryFn: getProjectsPaginated,
 *   pageSize: 20,
 * })
 *
 * // Использование
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetchingNextPage,
 * } = useProjectsInfinite({ status: 'active' })
 */
export function createInfiniteCacheQuery<TData, TFilters = void>(
  config: CreateInfiniteQueryConfig<TData, TFilters>
) {
  const pageSize = config.pageSize ?? 20

  return function useInfiniteCacheQuery(
    filters: TFilters,
    options?: {
      enabled?: boolean
      queryOptions?: Partial<Omit<UseInfiniteQueryOptions<TData[], Error, TData[], TData[], readonly unknown[], number>, 'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'>>
    }
  ) {
    return useInfiniteQuery({
      queryKey: [...config.queryKey(filters), 'infinite'],
      queryFn: async ({ pageParam }) => {
        const result = await config.queryFn({ ...filters, page: pageParam } as TFilters & { page: number })
        if (!result.success) {
          throw new Error(result.error)
        }
        return result.data
      },
      initialPageParam: 1,
      getNextPageParam: (lastPage, allPages) => {
        // Если последняя страница меньше pageSize, значит данных больше нет
        if (lastPage.length < pageSize) {
          return undefined
        }
        return allPages.length + 1
      },
      staleTime: config.staleTime ?? staleTimePresets.medium,
      enabled: options?.enabled,
      ...options?.queryOptions,
    })
  }
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Хук для условного запроса (запрос выполняется только при выполнении условия)
 *
 * @example
 * const { data } = useConditionalQuery(
 *   queryKeys.users.detail(userId),
 *   () => getUserById(userId!),
 *   { enabled: !!userId }
 * )
 */
export function useConditionalQuery<TData>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<ActionResult<TData>>,
  options: { enabled: boolean; staleTime?: number }
) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const result = await queryFn()
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    enabled: options.enabled,
    staleTime: options.staleTime ?? staleTimePresets.medium,
  })
}
