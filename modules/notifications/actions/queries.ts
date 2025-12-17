/**
 * Server Actions для чтения уведомлений
 *
 * @module modules/notifications/actions/queries
 */

'use server'

import type { ActionResult } from '@/modules/cache'
import { transformNotificationData, adaptRpcToNested, type Notification } from '@/modules/notifications/utils/transform'
import { createClient } from '@/utils/supabase/server'
import type { UserNotificationWithNotification } from '@/types/notifications'
import type { RpcNotificationRow } from './types'

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
    const offset = (page - 1) * limit

    // DEBUG: Логируем входные параметры
    console.log('🔍 [RPC] getNotificationsPaginated called:', {
      userId,
      page,
      limit,
      offset,
      filters,
    })

    const supabase = await createClient()

    // Call RPC function with server-side filtering
    // Type assertion needed because RPC is not in generated types yet
    const { data, error } = await (supabase.rpc as any)('get_user_notifications_filtered', {
      p_user_id: userId,
      p_limit: limit,
      p_offset: offset,
      p_only_unread: filters?.onlyUnread ?? false,
      p_include_archived: filters?.includeArchived ?? false,
      p_types: filters?.types && filters.types.length > 0 ? filters.types : null,
    }) as { data: RpcNotificationRow[] | null; error: any }

    if (error) {
      console.error('[getNotificationsPaginated] RPC error:', error)
      throw error
    }

    // Extract total_count from first row (window function returns same value in all rows)
    const totalCount = data && data.length > 0 ? data[0].total_count : 0

    console.log('🔍 [RPC] Results:', {
      rowsReturned: data?.length ?? 0,
      totalCount,
      hasMore: totalCount > offset + limit,
    })

    // Transform: flat RPC → nested → UI format
    const notifications = (data || []).map((rpcRow) => {
      const nested = adaptRpcToNested(rpcRow)
      return transformNotificationData(nested)
    })

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
          entity_types:entity_type_id (entity_name)
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
        const typeName = (item.notifications as any)?.entity_types?.entity_name
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
