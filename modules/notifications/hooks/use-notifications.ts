/**
 * Query hooks для уведомлений
 *
 * @module modules/notifications/hooks/use-notifications
 */

'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createCacheQuery,
  createInfiniteCacheQuery,
  createCacheMutation,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import {
  getNotificationsPaginated,
  getUnreadCount,
  getNotificationTypeCounts,
} from '../actions/queries'
import {
  markAsRead as markAsReadAction,
  markAsUnread as markAsUnreadAction,
  archiveNotification as archiveNotificationAction,
  markAllAsRead as markAllAsReadAction,
} from '../actions/mutations'
import type { Notification } from '../utils/transform'

// ============================================================================
// Типы для фильтров
// ============================================================================

/**
 * Фильтры для infinite scroll уведомлений
 */
export interface NotificationInfiniteFilters {
  userId: string
  filters?: {
    onlyUnread?: boolean
    includeArchived?: boolean
    types?: string[]
  }
}

/**
 * Параметры для счётчиков по типам
 */
export interface TypeCountsParams {
  userId: string
  options?: {
    includeArchived?: boolean
  }
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Хук для получения уведомлений с infinite scroll
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useNotificationsInfinite({
 *   userId: 'user-123',
 *   filters: {
 *     types: ['announcement'],
 *     includeArchived: false,
 *   }
 * })
 *
 * const notifications = useMemo(() => data?.pages.flat() ?? [], [data])
 * ```
 */
export const useNotificationsInfinite = createInfiniteCacheQuery<
  Notification,
  NotificationInfiniteFilters
>({
  queryKey: (filters) =>
    queryKeys.notifications.infinite(filters.userId, filters.filters),
  queryFn: ({ userId, filters, page }) =>
    getNotificationsPaginated({
      userId,
      page,
      limit: 20,
      filters,
    }) as any, // Type assertion: ActionResult<T[]> совместим с PaginatedActionResult<T> для infinite query
  pageSize: 20,
  staleTime: staleTimePresets.none, // Всегда свежие для realtime
})

/**
 * Хук для получения количества непрочитанных уведомлений (для badge)
 *
 * @example
 * ```tsx
 * const { data: unreadCount = 0 } = useUnreadCount('user-123')
 *
 * return <Badge>{unreadCount}</Badge>
 * ```
 */
export const useUnreadCount = createCacheQuery<number, string>({
  queryKey: (userId) => queryKeys.notifications.unreadCount(userId),
  queryFn: (userId) => getUnreadCount(userId),
  staleTime: staleTimePresets.none, // Всегда свежие для realtime
})

/**
 * Хук для получения счётчиков уведомлений по типам (для фильтров)
 *
 * @example
 * ```tsx
 * const { data: typeCounts = {} } = useNotificationTypeCounts({
 *   userId: 'user-123',
 *   options: { includeArchived: false }
 * })
 *
 * console.log(typeCounts.announcement) // 5
 * ```
 */
export const useNotificationTypeCounts = createCacheQuery<
  Record<string, number>,
  TypeCountsParams
>({
  queryKey: ({ userId, options }) =>
    queryKeys.notifications.typeCounts(userId, options),
  queryFn: ({ userId, options }) => getNotificationTypeCounts(userId, options),
  staleTime: staleTimePresets.none, // Всегда свежие для realtime
})

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Хук для отметки уведомления как прочитанного с optimistic update
 *
 * @param userId - ID текущего пользователя
 * @returns Mutation hook
 *
 * @example
 * ```tsx
 * const markAsReadMutation = useMarkAsRead(userId)
 *
 * // В обработчике:
 * markAsReadMutation.mutate({ id: notificationId, userId })
 * ```
 */
export function useMarkAsRead(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string }) =>
      markAsReadAction(input),
    onMutate: async ({ id }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all })

      // Snapshot ALL infinite queries and unreadCount
      const previousData = new Map()
      queryClient
        .getQueryCache()
        .findAll({ queryKey: queryKeys.notifications.all })
        .forEach((query) => {
          previousData.set(query.queryKey, query.state.data)
        })

      // Optimistic update: mark as read in ALL infinite query lists
      queryClient
        .getQueryCache()
        .findAll({ queryKey: queryKeys.notifications.lists() })
        .forEach((query) => {
          queryClient.setQueryData(query.queryKey, (old: any) => {
            if (!old?.pages) return old
            return {
              ...old,
              pages: old.pages.map((page: Notification[]) =>
                page.map((n: Notification) =>
                  n.id === id ? { ...n, isRead: true } : n
                )
              ),
            }
          })
        })

      // Optimistic update: decrement unreadCount
      queryClient.setQueryData(
        queryKeys.notifications.unreadCount(userId),
        (old: number = 0) => Math.max(0, old - 1)
      )

      return { previousData }
    },
    onError: (error, variables, context) => {
      // Rollback on error: restore all queries
      if (context?.previousData) {
        context.previousData.forEach((data, queryKey) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      // Always refetch after mutation to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

/**
 * Хук для отметки уведомления как непрочитанного с optimistic update
 *
 * @param userId - ID текущего пользователя
 * @returns Mutation hook
 *
 * @example
 * ```tsx
 * const markAsUnreadMutation = useMarkAsUnread(userId)
 *
 * // В обработчике:
 * markAsUnreadMutation.mutate({ id: notificationId, userId })
 * ```
 */
export function useMarkAsUnread(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string }) =>
      markAsUnreadAction(input),
    onMutate: async ({ id }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all })

      // Snapshot ALL infinite queries and unreadCount
      const previousData = new Map()
      queryClient
        .getQueryCache()
        .findAll({ queryKey: queryKeys.notifications.all })
        .forEach((query) => {
          previousData.set(query.queryKey, query.state.data)
        })

      // Optimistic update: mark as unread in ALL infinite query lists
      queryClient
        .getQueryCache()
        .findAll({ queryKey: queryKeys.notifications.lists() })
        .forEach((query) => {
          queryClient.setQueryData(query.queryKey, (old: any) => {
            if (!old?.pages) return old
            return {
              ...old,
              pages: old.pages.map((page: Notification[]) =>
                page.map((n: Notification) =>
                  n.id === id ? { ...n, isRead: false } : n
                )
              ),
            }
          })
        })

      // Optimistic update: increment unreadCount
      queryClient.setQueryData(
        queryKeys.notifications.unreadCount(userId),
        (old: number = 0) => old + 1
      )

      return { previousData }
    },
    onError: (error, variables, context) => {
      // Rollback on error: restore all queries
      if (context?.previousData) {
        context.previousData.forEach((data, queryKey) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      // Always refetch after mutation to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

/**
 * Хук для архивирования/разархивирования уведомления с optimistic update
 *
 * @param userId - ID текущего пользователя
 * @returns Mutation hook
 *
 * @example
 * ```tsx
 * const archiveMutation = useArchiveNotification(userId)
 *
 * // Архивировать:
 * archiveMutation.mutate({ id: notificationId, userId, isArchived: true })
 *
 * // Разархивировать:
 * archiveMutation.mutate({ id: notificationId, userId, isArchived: false })
 * ```
 */
export function useArchiveNotification(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; isArchived: boolean }) =>
      archiveNotificationAction(input),
    onMutate: async ({ id, isArchived }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all })

      // Snapshot ALL infinite queries and unreadCount
      const previousData = new Map()
      queryClient
        .getQueryCache()
        .findAll({ queryKey: queryKeys.notifications.all })
        .forEach((query) => {
          previousData.set(query.queryKey, query.state.data)
        })

      // Optimistic update: remove from ALL infinite query lists if archiving
      if (isArchived) {
        // Find notification to check if it was unread (before removal)
        let wasUnread = false
        queryClient
          .getQueryCache()
          .findAll({ queryKey: queryKeys.notifications.lists() })
          .forEach((query) => {
            const data = query.state.data as any
            if (data?.pages) {
              const notification = data.pages
                .flat()
                .find((n: Notification) => n.id === id)
              if (notification && !notification.isRead) {
                wasUnread = true
              }
            }

            // Remove from list (archiving)
            queryClient.setQueryData(query.queryKey, (old: any) => {
              if (!old?.pages) return old
              return {
                ...old,
                pages: old.pages.map((page: Notification[]) =>
                  page.filter((n: Notification) => n.id !== id)
                ),
              }
            })
          })

        // If notification was unread, decrement count
        if (wasUnread) {
          queryClient.setQueryData(
            queryKeys.notifications.unreadCount(userId),
            (old: number = 0) => Math.max(0, old - 1)
          )
        }
      }

      return { previousData }
    },
    onError: (error, variables, context) => {
      // Rollback on error: restore all queries
      if (context?.previousData) {
        context.previousData.forEach((data, queryKey) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      // Always refetch after mutation to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

/**
 * Хук для отметки всех уведомлений как прочитанных
 *
 * @returns Mutation hook
 *
 * @example
 * ```tsx
 * const markAllAsReadMutation = useMarkAllAsRead()
 *
 * // В обработчике:
 * markAllAsReadMutation.mutate({ userId })
 * ```
 */
export const useMarkAllAsRead = createCacheMutation<{ userId: string }, void>({
  mutationFn: ({ userId }) => markAllAsReadAction({ userId }),
  invalidateKeys: [queryKeys.notifications.all],
})
