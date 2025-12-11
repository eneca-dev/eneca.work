/**
 * Server Actions для мутаций уведомлений
 *
 * @module modules/notifications/actions/mutations
 */

'use server'

import * as Sentry from '@sentry/nextjs'
import type { ActionResult } from '@/modules/cache'
import type { MarkAsReadInput, ArchiveNotificationInput } from './types'
import { createClient } from '@/utils/supabase/server'
import { validateUserWithSpan } from './validate-user'

/**
 * Отметить уведомление как прочитанное
 *
 * @param input - { id: user_notifications.id }
 * @returns ActionResult<void>
 *
 * @example
 * ```typescript
 * const result = await markAsRead({ id: 'notif-123' })
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
        span.setAttribute('user_notification.id', input.id)

        // 1. Валидация авторизации
        const supabase = await createClient()
        const userOrError = await validateUserWithSpan(supabase, 'markAsRead', span)

        if ('error' in userOrError) {
          return { success: false, error: userOrError.error }
        }

        const userId = userOrError.userId

        // 2. Обновление уведомления
        const { error } = await supabase
          .from('user_notifications')
          .update({
            is_read: true,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('id', input.id)

        if (error) {
          console.error('[markAsRead] Supabase error:', error)
          throw error
        }

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
 * @param input - { id: user_notifications.id }
 * @returns ActionResult<void>
 *
 * @example
 * ```typescript
 * const result = await markAsUnread({ id: 'notif-123' })
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
        span.setAttribute('user_notification.id', input.id)

        // 1. Валидация авторизации
        const supabase = await createClient()
        const userOrError = await validateUserWithSpan(supabase, 'markAsUnread', span)

        if ('error' in userOrError) {
          return { success: false, error: userOrError.error }
        }

        const userId = userOrError.userId

        // 2. Обновление уведомления
        const { error } = await supabase
          .from('user_notifications')
          .update({
            is_read: false,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('id', input.id)

        if (error) {
          console.error('[markAsUnread] Supabase error:', error)
          throw error
        }

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
 * @param input - { id: user_notifications.id, isArchived: boolean }
 * @returns ActionResult<void>
 *
 * @example
 * ```typescript
 * // Архивировать
 * const result = await archiveNotification({ id: 'notif-123', isArchived: true })
 *
 * // Разархивировать
 * const result = await archiveNotification({ id: 'notif-123', isArchived: false })
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
        span.setAttribute('user_notification.id', input.id)
        span.setAttribute('archived.value', input.isArchived)

        // 1. Валидация авторизации
        const supabase = await createClient()
        const userOrError = await validateUserWithSpan(supabase, 'archiveNotification', span)

        if ('error' in userOrError) {
          return { success: false, error: userOrError.error }
        }

        const userId = userOrError.userId

        // 2. Обновление архивного статуса
        const { error } = await supabase
          .from('user_notifications')
          .update({
            is_archived: input.isArchived,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
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
 * @returns ActionResult<void>
 *
 * @example
 * ```typescript
 * const result = await markAllAsRead()
 * if (result.success) {
 *   console.log('All notifications marked as read')
 * }
 * ```
 */
export async function markAllAsRead(): Promise<ActionResult<void>> {
  return Sentry.startSpan(
    {
      op: 'notifications.mark_all_as_read_action',
      name: 'Mark All Notifications As Read (Action)',
    },
    async (span) => {
      try {
        // 1. Валидация авторизации
        const supabase = await createClient()
        const userOrError = await validateUserWithSpan(supabase, 'markAllAsRead', span)

        if ('error' in userOrError) {
          return { success: false, error: userOrError.error }
        }

        const userId = userOrError.userId

        // 2. Обновление всех непрочитанных уведомлений
        const { error } = await supabase
          .from('user_notifications')
          .update({
            is_read: true,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('is_read', false)

        if (error) {
          console.error('[markAllAsRead] Supabase error:', error)
          throw error
        }

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
