/**
 * Query hooks для уведомлений
 *
 * @module modules/notifications/hooks/use-notifications
 */

'use client'

import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import {
  createCacheQuery,
  createInfiniteCacheQuery,
  createCacheMutation,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import { useUserStore } from '@/stores/useUserStore'
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
// Типы для optimistic updates
// ============================================================================

/**
 * Контекст для optimistic updates
 * Хранит минимально необходимые данные для rollback
 */
interface OptimisticUpdateContext {
  infiniteQueries: Map<readonly unknown[], unknown>
  unreadCount?: number
}

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
// Helper Functions для Optimistic Updates
// ============================================================================

/**
 * Применяет операцию к элементам в infinite query с early exit оптимизацией.
 *
 * Обходит все queries, соответствующие queryKeyBase, и применяет operation
 * к каждой странице. Прекращает обработку оставшихся страниц после того,
 * как operation вернёт found: true.
 *
 * @param queryClient - TanStack Query client
 * @param queryKeyBase - Базовый query key для поиска queries
 * @param operation - Функция для трансформации страницы.
 *   Возвращает { page, found }, где:
 *   - page: обновлённая страница
 *   - found: true если целевой элемент найден (triggers early exit)
 *
 * @example
 * ```typescript
 * updateInfiniteQueriesWithEarlyExit(
 *   queryClient,
 *   queryKeys.notifications.lists(),
 *   (page) => {
 *     const notification = page.find((n) => n.id === targetId)
 *     if (!notification) return { page, found: false }
 *
 *     const newPage = page.map((n) =>
 *       n.id === targetId ? { ...n, isRead: true } : n
 *     )
 *     return { page: newPage, found: true }
 *   }
 * )
 * ```
 */
function updateInfiniteQueriesWithEarlyExit(
  queryClient: QueryClient,
  queryKeyBase: readonly unknown[],
  operation: (page: Notification[]) => { page: Notification[]; found: boolean }
): void {
  queryClient
    .getQueryCache()
    .findAll({ queryKey: queryKeyBase })
    .forEach((query) => {
      let found = false // Early exit flag

      queryClient.setQueryData<InfiniteData<Notification[]>>(
        query.queryKey,
        (old) => {
          if (!old?.pages || found) return old

          const newPages = old.pages.map((page) => {
            if (found) return page // Skip remaining pages

            const result = operation(page)
            if (result.found) {
              found = true // Mark as found for early exit
            }

            return result.page
          })

          return { ...old, pages: newPages }
        }
      )
    })
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
export function useMarkAsRead() {
  const queryClient = useQueryClient()
  const userId = useUserStore((s) => s.id)

  return useMutation({
    mutationFn: (input: { id: string }) =>
      markAsReadAction(input),
    onMutate: async ({ id }) => {
      if (!userId) return
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all })

      // КОПИРУЕМ ТОЛЬКО НЕОБХОДИМОЕ
      const previousData: OptimisticUpdateContext = {
        infiniteQueries: new Map(),
        unreadCount: queryClient.getQueryData(queryKeys.notifications.unreadCount(userId)),
      }

      // Находим и сохраняем ТОЛЬКО infinite queries (списки уведомлений)
      queryClient
        .getQueryCache()
        .findAll({ queryKey: queryKeys.notifications.lists() })
        .forEach((query) => {
          previousData.infiniteQueries.set(query.queryKey, query.state.data)
        })

      // Optimistic update: mark as read in ALL infinite query lists
      updateInfiniteQueriesWithEarlyExit(
        queryClient,
        queryKeys.notifications.lists(),
        (page) => {
          const notification = page.find((n) => n.id === id)
          if (!notification) return { page, found: false }

          const newPage = page.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          )
          return { page: newPage, found: true }
        }
      )

      // Optimistic update: decrement unreadCount
      queryClient.setQueryData(
        queryKeys.notifications.unreadCount(userId),
        (old: number = 0) => Math.max(0, old - 1)
      )

      return previousData
    },
    onError: (error, variables, context) => {
      if (!context) return

      // Restore только infinite queries
      if (context.infiniteQueries) {
        context.infiniteQueries.forEach((data, queryKey) => {
          queryClient.setQueryData(queryKey, data)
        })
        // ОЧИСТИТЬ MAP для предотвращения memory leak (Проблема 7)
        context.infiniteQueries.clear()
      }

      // Restore unreadCount
      if (context.unreadCount !== undefined && userId) {
        queryClient.setQueryData(
          queryKeys.notifications.unreadCount(userId),
          context.unreadCount
        )
      }
    },
    onSuccess: (data, variables, context) => {
      // ОЧИСТИТЬ MAP после успешной mutation (Проблема 7)
      if (context?.infiniteQueries) {
        context.infiniteQueries.clear()
      }
    },
    // onSettled удалён - Realtime синхронизация автоматически инвалидирует кеш
    // при изменении таблицы user_notifications (см. modules/cache/realtime/config.ts)
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
export function useMarkAsUnread() {
  const queryClient = useQueryClient()
  const userId = useUserStore((s) => s.id)

  return useMutation({
    mutationFn: (input: { id: string }) =>
      markAsUnreadAction(input),
    onMutate: async ({ id }) => {
      if (!userId) return
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all })

      // КОПИРУЕМ ТОЛЬКО НЕОБХОДИМОЕ
      const previousData: OptimisticUpdateContext = {
        infiniteQueries: new Map(),
        unreadCount: queryClient.getQueryData(queryKeys.notifications.unreadCount(userId)),
      }

      // Находим и сохраняем ТОЛЬКО infinite queries (списки уведомлений)
      queryClient
        .getQueryCache()
        .findAll({ queryKey: queryKeys.notifications.lists() })
        .forEach((query) => {
          previousData.infiniteQueries.set(query.queryKey, query.state.data)
        })

      // Optimistic update: mark as unread in ALL infinite query lists
      updateInfiniteQueriesWithEarlyExit(
        queryClient,
        queryKeys.notifications.lists(),
        (page) => {
          const notification = page.find((n) => n.id === id)
          if (!notification) return { page, found: false }

          const newPage = page.map((n) =>
            n.id === id ? { ...n, isRead: false } : n
          )
          return { page: newPage, found: true }
        }
      )

      // Optimistic update: increment unreadCount
      queryClient.setQueryData(
        queryKeys.notifications.unreadCount(userId),
        (old: number = 0) => old + 1
      )

      return previousData
    },
    onError: (error, variables, context) => {
      if (!context) return

      // Restore только infinite queries
      if (context.infiniteQueries) {
        context.infiniteQueries.forEach((data, queryKey) => {
          queryClient.setQueryData(queryKey, data)
        })
        // ОЧИСТИТЬ MAP для предотвращения memory leak (Проблема 7)
        context.infiniteQueries.clear()
      }

      // Restore unreadCount
      if (context.unreadCount !== undefined && userId) {
        queryClient.setQueryData(
          queryKeys.notifications.unreadCount(userId),
          context.unreadCount
        )
      }
    },
    onSuccess: (data, variables, context) => {
      // ОЧИСТИТЬ MAP после успешной mutation (Проблема 7)
      if (context?.infiniteQueries) {
        context.infiniteQueries.clear()
      }
    },
    // onSettled удалён - Realtime синхронизация автоматически инвалидирует кеш
    // при изменении таблицы user_notifications (см. modules/cache/realtime/config.ts)
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
export function useArchiveNotification() {
  const queryClient = useQueryClient()
  const userId = useUserStore((s) => s.id)

  return useMutation({
    mutationFn: (input: { id: string; isArchived: boolean; notification?: Notification }) =>
      archiveNotificationAction({ id: input.id, isArchived: input.isArchived }),
    onMutate: async ({ id, isArchived, notification }) => {
      if (!userId) return
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all })

      // КОПИРУЕМ ТОЛЬКО НЕОБХОДИМОЕ
      const previousData: OptimisticUpdateContext = {
        infiniteQueries: new Map(),
        unreadCount: queryClient.getQueryData(queryKeys.notifications.unreadCount(userId)),
      }

      // Находим и сохраняем ТОЛЬКО infinite queries (списки уведомлений)
      queryClient
        .getQueryCache()
        .findAll({ queryKey: queryKeys.notifications.lists() })
        .forEach((query) => {
          previousData.infiniteQueries.set(query.queryKey, query.state.data)
        })

      // Optimistic update: remove from ALL infinite query lists if archiving (atomic read + remove to prevent race condition)
      if (isArchived) {
        // Atomic operation: read status + remove in one pass
        let wasUnread = false

        updateInfiniteQueriesWithEarlyExit(
          queryClient,
          queryKeys.notifications.lists(),
          (page) => {
            const notification = page.find((n) => n.id === id)
            if (!notification) return { page, found: false }

            // Read isRead status DURING removal (prevents race condition with Realtime)
            if (!notification.isRead) {
              wasUnread = true
            }

            const newPage = page.filter((n) => n.id !== id)
            return { page: newPage, found: true }
          }
        )

        // Decrement unread count if notification was unread
        if (wasUnread) {
          queryClient.setQueryData(
            queryKeys.notifications.unreadCount(userId),
            (old: number = 0) => Math.max(0, old - 1)
          )
        }
      }
      // Optimistic update: unarchive (isArchived = false)
      else {
        // Remove from archived lists
        updateInfiniteQueriesWithEarlyExit(
          queryClient,
          queryKeys.notifications.lists(),
          (page) => {
            const notification = page.find((n) => n.id === id)
            if (!notification) return { page, found: false }

            const newPage = page.filter((n) => n.id !== id)
            return { page: newPage, found: true }
          }
        )

        // If notification object is provided, add to non-archived lists
        if (notification) {
          const unarchivedNotification = {
            ...notification,
            isArchived: false,
          }

          // Add to beginning of non-archived lists
          queryClient
            .getQueryCache()
            .findAll({ queryKey: queryKeys.notifications.lists() })
            .forEach((query) => {
              // Check queryKey - only add to non-archived lists
              const key = query.queryKey as any[]
              const filters = key.find((k) => k?.filters)?.filters

              // If this is NOT an archived list (includeArchived !== true)
              if (!filters?.includeArchived) {
                queryClient.setQueryData<InfiniteData<Notification[]>>(
                  query.queryKey,
                  (old) => {
                    if (!old?.pages || old.pages.length === 0) return old

                    // Add to beginning of first page
                    return {
                      ...old,
                      pages: [
                        [unarchivedNotification, ...old.pages[0]],
                        ...old.pages.slice(1),
                      ],
                    }
                  }
                )
              }
            })
        }
      }

      return previousData
    },
    onError: (error, variables, context) => {
      if (!context) return

      // Restore только infinite queries
      if (context.infiniteQueries) {
        context.infiniteQueries.forEach((data, queryKey) => {
          queryClient.setQueryData(queryKey, data)
        })
        // ОЧИСТИТЬ MAP для предотвращения memory leak (Проблема 7)
        context.infiniteQueries.clear()
      }

      // Restore unreadCount
      if (context.unreadCount !== undefined && userId) {
        queryClient.setQueryData(
          queryKeys.notifications.unreadCount(userId),
          context.unreadCount
        )
      }
    },
    onSuccess: (data, variables, context) => {
      // ОЧИСТИТЬ MAP после успешной mutation (Проблема 7)
      if (context?.infiniteQueries) {
        context.infiniteQueries.clear()
      }
    },
    // onSettled удалён - Realtime синхронизация автоматически инвалидирует кеш
    // при изменении таблицы user_notifications (см. modules/cache/realtime/config.ts)
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
export const useMarkAllAsRead = createCacheMutation<void, void>({
  mutationFn: () => markAllAsReadAction(),
  invalidateKeys: [queryKeys.notifications.all as unknown as unknown[]],
})
