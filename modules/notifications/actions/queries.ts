/**
 * Server Actions для чтения уведомлений
 *
 * @module modules/notifications/actions/queries
 */

'use server'

import type { ActionResult } from '@/modules/cache'
import {
  getUserNotifications,
  getUserNotificationsByTypes,
  getUnreadNotificationsCount,
  getNotificationTypeCounts as getNotificationTypeCountsAPI
} from '@/modules/notifications/api/notifications'
import { transformNotificationData, type Notification } from '@/modules/notifications/utils/transform'

/**
 * Получить уведомления с пагинацией и фильтрами (для infinite scroll)
 *
 * @param input - Параметры запроса
 * @returns Массив уведомлений
 *
 * @example
 * ```typescript
 * const result = await getNotificationsPaginated({
 *   userId: 'user-123',
 *   page: 1,
 *   limit: 20,
 *   filters: { types: ['announcement'], includeArchived: false }
 * })
 * ```
 */
export async function getNotificationsPaginated(input: {
  userId: string
  page: number
  limit?: number
  filters?: {
    onlyUnread?: boolean
    includeArchived?: boolean
    types?: string[]
  }
}): Promise<ActionResult<Notification[]>> {
  try {
    const limit = input.limit ?? 20
    const { userId, page, filters } = input

    // DEBUG: Логируем входные параметры
    console.log('🔍 [Server Action] getNotificationsPaginated called:', {
      userId,
      page,
      limit,
      filters,
      includeArchived: filters?.includeArchived ?? false,
    })

    // Выбираем API функцию в зависимости от фильтров
    let result
    if (filters?.types && filters.types.length > 0) {
      // Фильтрация по типам
      console.log('🔍 [Server Action] Using getUserNotificationsByTypes')
      result = await getUserNotificationsByTypes(userId, filters.types, page, limit, {
        includeArchived: filters.includeArchived ?? false,
      })
    } else {
      // Обычная пагинация с опциональными фильтрами
      console.log('🔍 [Server Action] Using getUserNotifications with includeArchived:', filters?.includeArchived ?? false)
      result = await getUserNotifications(
        userId,
        page,
        limit,
        filters?.onlyUnread ?? false,
        filters?.includeArchived ?? false
      )
    }

    // Трансформируем данные в UI-формат
    const notifications = result.notifications.map(transformNotificationData)

    return { success: true, data: notifications }
  } catch (error) {
    console.error('[getNotificationsPaginated] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки уведомлений'
    }
  }
}

/**
 * Получить количество непрочитанных уведомлений (для badge)
 *
 * @param userId - ID пользователя
 * @returns Количество непрочитанных уведомлений
 *
 * @example
 * ```typescript
 * const result = await getUnreadCount('user-123')
 * if (result.success) {
 *   console.log(`Непрочитанных: ${result.data}`)
 * }
 * ```
 */
export async function getUnreadCount(userId: string): Promise<ActionResult<number>> {
  try {
    const count = await getUnreadNotificationsCount(userId)
    return { success: true, data: count }
  } catch (error) {
    console.error('[getUnreadCount] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка получения счётчика'
    }
  }
}

/**
 * Получить счётчики уведомлений по типам (для фильтров)
 *
 * @param userId - ID пользователя
 * @param options - Опции запроса
 * @returns Объект с количеством уведомлений по каждому типу
 *
 * @example
 * ```typescript
 * const result = await getNotificationTypeCounts('user-123', { includeArchived: false })
 * if (result.success) {
 *   console.log(result.data) // { announcement: 5, assignment: 3, section_comment: 2 }
 * }
 * ```
 */
export async function getNotificationTypeCounts(
  userId: string,
  options?: { includeArchived?: boolean }
): Promise<ActionResult<Record<string, number>>> {
  try {
    const counts = await getNotificationTypeCountsAPI(userId, options)
    return { success: true, data: counts }
  } catch (error) {
    console.error('[getNotificationTypeCounts] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка получения счётчиков типов'
    }
  }
}
