/**
 * Server Actions для чтения уведомлений
 *
 * @module modules/notifications/actions/queries
 */

'use server'

import type { ActionResult } from '@/modules/cache'
import { transformNotificationData, type Notification } from '@/modules/notifications/utils/transform'
import { createClient } from '@/utils/supabase/server'
import type { UserNotificationWithNotification } from '@/types/notifications'

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

    // Прямой запрос к Supabase
    const supabase = await createClient()
    const offset = (page - 1) * limit

    let query = supabase
      .from('user_notifications')
      .select(`
        *,
        notifications:notification_id (
          *,
          entity_types:entity_type_id (*)
        )
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Применяем фильтры
    if (filters?.onlyUnread) {
      query = query.eq('is_read', false)
    }

    if (!filters?.includeArchived) {
      query = query.eq('is_archived', false)
    }

    if (filters?.types && filters.types.length > 0) {
      // Фильтрация по типам - через JOIN с notifications.entity_types
      // Примечание: types должны быть строковыми значениями (напр., ['announcement', 'task'])
      console.log('🔍 [Server Action] Filtering by types:', filters.types)
      // Используем вложенный фильтр через notifications
      // ВАЖНО: Supabase не поддерживает фильтрацию по вложенным связям напрямую
      // Поэтому нужно сделать два запроса или использовать RPC функцию
      // Для простоты - делаем без фильтрации по типам в первом запросе
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error('[getNotificationsPaginated] Supabase error:', error)
      throw error
    }

    // Если есть фильтр по типам, фильтруем на клиенте (временно)
    let filteredData = data || []
    if (filters?.types && filters.types.length > 0) {
      filteredData = filteredData.filter(item => {
        const entityTypeName = (item.notifications as any)?.entity_types?.name
        return entityTypeName && filters.types!.includes(entityTypeName)
      })
    }

    const result = {
      notifications: filteredData as UserNotificationWithNotification[],
      totalCount: count || 0,
      hasMore: (count || 0) > offset + limit,
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
    const supabase = await createClient()

    const { count, error } = await supabase
      .from('user_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .eq('is_archived', false)

    if (error) throw error

    return { success: true, data: count || 0 }
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
    const supabase = await createClient()

    // Получаем все уведомления пользователя с типами
    let query = supabase
      .from('user_notifications')
      .select(`
        notifications:notification_id (
          entity_types:entity_type_id (name)
        )
      `)
      .eq('user_id', userId)

    if (!options?.includeArchived) {
      query = query.eq('is_archived', false)
    }

    const { data, error } = await query

    if (error) throw error

    // Подсчитываем количество уведомлений по типам
    const counts: Record<string, number> = {}

    if (data) {
      for (const item of data) {
        const typeName = (item.notifications as any)?.entity_types?.name
        if (typeName) {
          counts[typeName] = (counts[typeName] || 0) + 1
        }
      }
    }

    return { success: true, data: counts }
  } catch (error) {
    console.error('[getNotificationTypeCounts] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка получения счётчиков типов'
    }
  }
}
