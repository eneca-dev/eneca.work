/**
 * Server Actions для мутаций уведомлений
 *
 * @module modules/notifications/actions/mutations
 */

'use server'

import * as Sentry from '@sentry/nextjs'
import type { ActionResult } from '@/modules/cache'
import type { MarkAsReadInput, ArchiveNotificationInput } from './types'
import {
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
} from '@/modules/notifications/api/notifications'
import { createClient } from '@/utils/supabase/server'

/**
 * Отметить уведомление как прочитанное
 *
 * @param input - { id: user_notifications.id, userId: string }
 * @returns ActionResult<void>
 *
 * @example
 * ```typescript
 * const result = await markAsRead({ id: 'notif-123', userId: 'user-456' })
 * if (result.success) {
 *   console.log('Marked as read')
 * }
 * ```
 */
export async function markAsRead(
  input: MarkAsReadInput
): Promise<ActionResult<void>> {
  return Sentry.startSpan(
    {
      op: 'notifications.mark_as_read_action',
      name: 'Mark Notification As Read (Action)',
    },
    async (span) => {
      try {
        span.setAttribute('user.id', input.userId)
        span.setAttribute('user_notification.id', input.id)

        await markNotificationAsRead(input.userId, input.id)

        span.setAttribute('mark.success', true)
        return { success: true, data: undefined }
      } catch (error) {
        span.setAttribute('mark.success', false)
        span.recordException(error as Error)

        Sentry.captureException(error, {
          tags: {
            module: 'notifications',
            action: 'mark_as_read_action',
            error_type: 'mutation_error',
          },
          extra: {
            user_id: input.userId,
            user_notification_id: input.id,
            timestamp: new Date().toISOString(),
          },
        })

        console.error('[markAsRead] Error:', error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Ошибка отметки уведомления как прочитанного',
        }
      }
    }
  )
}

/**
 * Отметить уведомление как непрочитанное
 *
 * @param input - { id: user_notifications.id, userId: string }
 * @returns ActionResult<void>
 *
 * @example
 * ```typescript
 * const result = await markAsUnread({ id: 'notif-123', userId: 'user-456' })
 * if (result.success) {
 *   console.log('Marked as unread')
 * }
 * ```
 */
export async function markAsUnread(
  input: MarkAsReadInput
): Promise<ActionResult<void>> {
  return Sentry.startSpan(
    {
      op: 'notifications.mark_as_unread_action',
      name: 'Mark Notification As Unread (Action)',
    },
    async (span) => {
      try {
        span.setAttribute('user.id', input.userId)
        span.setAttribute('user_notification.id', input.id)

        await markNotificationAsUnread(input.userId, input.id)

        span.setAttribute('unmark.success', true)
        return { success: true, data: undefined }
      } catch (error) {
        span.setAttribute('unmark.success', false)
        span.recordException(error as Error)

        Sentry.captureException(error, {
          tags: {
            module: 'notifications',
            action: 'mark_as_unread_action',
            error_type: 'mutation_error',
          },
          extra: {
            user_id: input.userId,
            user_notification_id: input.id,
            timestamp: new Date().toISOString(),
          },
        })

        console.error('[markAsUnread] Error:', error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Ошибка отметки уведомления как непрочитанного',
        }
      }
    }
  )
}

/**
 * Архивировать/разархивировать уведомление
 *
 * @param input - { id: user_notifications.id, userId: string, isArchived: boolean }
 * @returns ActionResult<void>
 *
 * @example
 * ```typescript
 * // Архивировать
 * const result = await archiveNotification({ id: 'notif-123', userId: 'user-456', isArchived: true })
 *
 * // Разархивировать
 * const result = await archiveNotification({ id: 'notif-123', userId: 'user-456', isArchived: false })
 * ```
 */
export async function archiveNotification(
  input: ArchiveNotificationInput
): Promise<ActionResult<void>> {
  return Sentry.startSpan(
    {
      op: 'notifications.archive_notification_action',
      name: 'Archive Notification (Action)',
    },
    async (span) => {
      try {
        span.setAttribute('user.id', input.userId)
        span.setAttribute('user_notification.id', input.id)
        span.setAttribute('archived.value', input.isArchived)

        // ВАЖНО: Используем прямой запрос с серверным клиентом
        // Избегаем использования API-функции setUserNotificationArchived(),
        // которая использует клиентский Supabase client и падает с "Not authenticated" в Server Action
        const supabase = await createClient()
        const { error } = await supabase
          .from('user_notifications')
          .update({
            is_archived: input.isArchived,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', input.userId)
          .eq('id', input.id)

        if (error) {
          console.error('[archiveNotification] Supabase error:', error)
          throw error
        }

        span.setAttribute('archive.success', true)
        return { success: true, data: undefined }
      } catch (error) {
        span.setAttribute('archive.success', false)
        span.recordException(error as Error)

        Sentry.captureException(error, {
          tags: {
            module: 'notifications',
            action: 'archive_notification_action',
            error_type: 'mutation_error',
          },
          extra: {
            user_id: input.userId,
            user_notification_id: input.id,
            is_archived: input.isArchived,
            timestamp: new Date().toISOString(),
          },
        })

        console.error('[archiveNotification] Error:', error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Ошибка архивирования уведомления',
        }
      }
    }
  )
}

/**
 * Отметить все уведомления пользователя как прочитанные
 *
 * @param input - { userId: string }
 * @returns ActionResult<void>
 *
 * @example
 * ```typescript
 * const result = await markAllAsRead({ userId: 'user-456' })
 * if (result.success) {
 *   console.log('All notifications marked as read')
 * }
 * ```
 */
export async function markAllAsRead(input: {
  userId: string
}): Promise<ActionResult<void>> {
  return Sentry.startSpan(
    {
      op: 'notifications.mark_all_as_read_action',
      name: 'Mark All Notifications As Read (Action)',
    },
    async (span) => {
      try {
        span.setAttribute('user.id', input.userId)

        await markAllNotificationsAsRead(input.userId)

        span.setAttribute('mark_all.success', true)
        return { success: true, data: undefined }
      } catch (error) {
        span.setAttribute('mark_all.success', false)
        span.recordException(error as Error)

        Sentry.captureException(error, {
          tags: {
            module: 'notifications',
            action: 'mark_all_as_read_action',
            error_type: 'mutation_error',
          },
          extra: {
            user_id: input.userId,
            timestamp: new Date().toISOString(),
          },
        })

        console.error('[markAllAsRead] Error:', error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Ошибка отметки всех уведомлений как прочитанных',
        }
      }
    }
  )
}
