/**
 * Утилиты для трансформации данных уведомлений
 *
 * @module modules/notifications/utils/transform
 */

import { UserNotificationWithNotification } from '@/modules/notifications/api/notifications'
import {
  generateAssignmentNotificationText,
  generateAnnouncementNotificationText
} from '@/types/notifications'

/**
 * UI-формат уведомления (используется в компонентах)
 */
export interface Notification {
  id: string // ID из user_notifications
  notificationId: string // ID из notifications
  title: string
  message: string
  createdAt: Date
  isRead: boolean
  isArchived?: boolean
  type?: "info" | "warning" | "error" | "success"
  payload?: Record<string, any>
  entityType?: string
}

/**
 * Преобразует данные из API в UI формат
 *
 * @param un - Уведомление из базы данных с JOIN
 * @returns Уведомление в UI-формате
 */
export function transformNotificationData(un: UserNotificationWithNotification): Notification {
  const notification = un.notifications
  const rawType = notification?.entity_types?.entity_name || 'unknown'
  const entityType = rawType

  // Извлекаем данные из payload
  const payload = notification?.payload || {}
  let title = ''
  let message = ''

  // Отладочная информация
  console.log('🔄 Трансформация уведомления:', {
    entityType,
    payload,
    userNotificationId: un.id,
    notificationId: un.notification_id,
    fullNotification: notification
  })

  // Генерируем текст на лету в зависимости от типа уведомления
  if (entityType === 'assignment') {
    // Проверяем, есть ли данные в payload.assignment или прямо в payload
    const assignmentData = payload.assignment || {
      project: payload.project,
      from_section: payload.from_section,
      amount: Number(payload.amount) || payload.amount
    }

    if (assignmentData.project && assignmentData.from_section && assignmentData.amount) {
      const generated = generateAssignmentNotificationText(assignmentData)
      title = generated.title
      message = generated.message
    } else {
      // Fallback для заданий
      title = payload.title || payload.project || 'Передача заданий'
      message = payload.message || `Вам передано ${payload.amount || 'несколько'} заданий`
    }
  } else if (entityType === 'announcement') {
    // Проверяем, есть ли данные в payload.announcement или прямо в payload
    const announcementData = payload.announcement || {
      user_name: payload.user_name,
      title: payload.title,
      body: payload.body
    }

    if (announcementData.user_name && announcementData.title && announcementData.body) {
      const generated = generateAnnouncementNotificationText(announcementData)
      title = generated.title
      message = generated.message
    } else {
      // Fallback для объявлений
      title = payload.title || 'Новое объявление'
      message = payload.message || payload.body || 'Нет описания'
    }
  } else if (entityType === 'section_comment') {
    // Обработка уведомлений о комментариях к разделам
    const commentData = payload.section_comment || {
      section_name: payload.section_name || 'Раздел',
      author_name: payload.author_name || 'Пользователь',
      comment_preview: payload.comment_preview || 'комментарий'
    }

    title = `Комментарий к разделу "${commentData.section_name}"`
    message = `${commentData.author_name}: "${commentData.comment_preview}"`
  } else {
    // Для других типов используем payload или fallback
    title = payload.title || notification?.rendered_text || 'Новое уведомление'
    message = payload.message || payload.description || 'Нет описания'
  }

  return {
    id: un.id,
    notificationId: un.notification_id,
    title,
    message,
    createdAt: new Date(un.created_at),
    isRead: un.is_read,
    isArchived: Boolean((un as any).is_archived || false),
    type: payload.type || 'info',
    payload: notification?.payload,
    entityType,
  }
}
