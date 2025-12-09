/**
 * Query hooks для уведомлений
 *
 * @module modules/notifications/hooks/use-notifications
 */

'use client'

import {
  createCacheQuery,
  createInfiniteCacheQuery,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import {
  getNotificationsPaginated,
  getUnreadCount,
  getNotificationTypeCounts,
} from '../actions/queries'
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
