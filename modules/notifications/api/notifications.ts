import * as Sentry from "@sentry/nextjs";
import { 
  CreateNotificationRequest,
  CreateNotificationResponse,
  CreateAssignmentNotificationRequest,
  CreateAnnouncementNotificationRequest,
  AssignmentPayload,
  AnnouncementPayload,
  generateAssignmentNotificationText,
  generateAnnouncementNotificationText,
  UserNotificationWithNotification,
  UserNotificationRow,
  NotificationRow
} from '@/types/notifications'

// Экспортируем тип для использования в других модулях
export type { UserNotificationWithNotification }
import { createClient } from '@/utils/supabase/client'

// URL для Edge Function
const NOTIFICATIONS_ENDPOINT = '/api/notifications'

/**
 * Отправляет уведомление через Supabase Edge Function
 */
export async function sendNotification(
  request: CreateNotificationRequest
): Promise<CreateNotificationResponse> {
  return Sentry.startSpan(
    {
      op: "notifications.send_notification",
      name: "Send Notification",
    },
    async (span) => {
      try {
        span.setAttribute("notification.entity_type", request.entityType)
        span.setAttribute("notification.user_count", request.userIds?.length || 0)
        span.setAttribute("notification.has_filters", !!request.filters)
        span.setAttribute("notification.has_payload", !!request.payload)

        const response = await fetch(NOTIFICATIONS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        })

        span.setAttribute("http.status_code", response.status)

        if (!response.ok) {
          const errorText = await response.text()
          span.setAttribute("send.success", false)
          span.setAttribute("send.error", errorText)
          
          const error = new Error(`HTTP ${response.status}: ${errorText}`)
          Sentry.captureException(error, {
            tags: {
              module: 'notifications',
              action: 'send_notification',
              error_type: 'http_error'
            },
            extra: {
              component: 'sendNotification',
              status: response.status,
              response_text: errorText,
              entity_type: request.entityType,
              user_count: request.userIds?.length,
              has_filters: !!request.filters,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        const result = await response.json()
        span.setAttribute("send.success", true)
        span.setAttribute("notification.sent_count", result.sentCount || 0)

        Sentry.addBreadcrumb({
          message: 'Notification sent successfully',
          category: 'notifications',
          level: 'info',
          data: {
            entity_type: request.entityType,
            user_count: request.userIds?.length,
            sent_count: result.sentCount,
            status: response.status
          }
        })

        return result
      } catch (error) {
        span.setAttribute("send.success", false)
        span.recordException(error as Error)
        Sentry.captureException(error, {
          tags: {
            module: 'notifications',
            action: 'send_notification',
            error_type: 'unexpected_error'
          },
          extra: {
            component: 'sendNotification',
            entity_type: request.entityType,
            user_count: request.userIds?.length,
            has_filters: !!request.filters,
            timestamp: new Date().toISOString()
          }
        })
        console.error('Ошибка при отправке уведомления:', error)
        throw error
      }
    }
  )
}

/**
 * Отправляет уведомление конкретным пользователям
 */
export async function sendNotificationToUsers(
  entityType: string,
  payload: {
    title: string
    message: string
    type?: 'info' | 'warning' | 'error' | 'success'
    action?: {
      type: string
      url?: string
      data?: Record<string, any>
    }
  },
  userIds: string[]
): Promise<CreateNotificationResponse> {
  return sendNotification({
    entityType,
    payload,
    userIds,
  })
}

/**
 * Отправляет уведомление по фильтрам
 */
export async function sendNotificationByFilters(
  entityType: string,
  payload: {
    title: string
    message: string
    type?: 'info' | 'warning' | 'error' | 'success'
    action?: {
      type: string
      url?: string
      data?: Record<string, any>
    }
  },
  filters: {
    departmentId?: string
    positionId?: string
    roleId?: string
    teamId?: string
    workFormat?: string
    categoryId?: string
    isHourly?: boolean
    cityId?: string
    countryId?: string
  }
): Promise<CreateNotificationResponse> {
  return sendNotification({
    entityType,
    payload,
    filters,
  })
}

/**
 * Отправляет уведомление всем пользователям отдела
 */
export async function sendNotificationToDepartment(
  entityType: string,
  payload: {
    title: string
    message: string
    type?: 'info' | 'warning' | 'error' | 'success'
    action?: {
      type: string
      url?: string
      data?: Record<string, any>
    }
  },
  departmentId: string
): Promise<CreateNotificationResponse> {
  return sendNotificationByFilters(entityType, payload, { departmentId })
}

/**
 * Отправляет уведомление всем пользователям команды
 */
export async function sendNotificationToTeam(
  entityType: string,
  payload: {
    title: string
    message: string
    type?: 'info' | 'warning' | 'error' | 'success'
    action?: {
      type: string
      url?: string
      data?: Record<string, any>
    }
  },
  teamId: string
): Promise<CreateNotificationResponse> {
  return sendNotificationByFilters(entityType, payload, { teamId })
}

/**
 * Отправляет уведомление всем пользователям с определенной ролью
 */
export async function sendNotificationToRole(
  entityType: string,
  payload: {
    title: string
    message: string
    type?: 'info' | 'warning' | 'error' | 'success'
    action?: {
      type: string
      url?: string
      data?: Record<string, any>
    }
  },
  roleId: string
): Promise<CreateNotificationResponse> {
  return sendNotificationByFilters(entityType, payload, { roleId })
}

/**
 * Отправляет уведомление всем пользователям из определенного города
 */
export async function sendNotificationToCity(
  entityType: string,
  payload: {
    title: string
    message: string
    type?: 'info' | 'warning' | 'error' | 'success'
    action?: {
      type: string
      url?: string
      data?: Record<string, any>
    }
  },
  cityId: string
): Promise<CreateNotificationResponse> {
  return sendNotificationByFilters(entityType, payload, { cityId })
}

/**
 * Отправляет уведомление всем пользователям из определенной страны
 */
export async function sendNotificationToCountry(
  entityType: string,
  payload: {
    title: string
    message: string
    type?: 'info' | 'warning' | 'error' | 'success'
    action?: {
      type: string
      url?: string
      data?: Record<string, any>
    }
  },
  countryId: string
): Promise<CreateNotificationResponse> {
  return sendNotificationByFilters(entityType, payload, { countryId })
}

/**
 * Отправляет уведомление о передаче заданий
 */
export async function sendAssignmentNotification(
  request: CreateAssignmentNotificationRequest
): Promise<CreateNotificationResponse> {
  const { project, from_section, amount, userIds, filters } = request
  
  const payload: AssignmentPayload = {
    project,
    from_section,
    amount
  }

  const { title, message } = generateAssignmentNotificationText(payload)

  return sendNotification({
    entityType: 'assignment',
    payload: {
      title,
      message,
      type: 'info',
      assignment: payload,
      action: {
        type: 'navigate',
        url: '/dashboard/tasks'
      }
    },
    userIds,
    filters
  })
}

/**
 * Отправляет уведомление об объявлении
 */
export async function sendAnnouncementNotification(
  request: CreateAnnouncementNotificationRequest
): Promise<CreateNotificationResponse> {
  const { user_name, title, body, userIds, filters } = request
  
  const payload: AnnouncementPayload = {
    user_name,
    title,
    body
  }

  const { title: notificationTitle, message } = generateAnnouncementNotificationText(payload)

  return sendNotification({
    entityType: 'announcement',
    payload: {
      title: notificationTitle,
      message,
      type: 'info',
      announcement: payload,
      action: {
        type: 'navigate',
        url: '/dashboard/announcements'
      }
    },
    userIds,
    filters
  })
}

// Удобные функции для частых случаев использования

/**
 * Передача заданий пользователю
 */
export async function notifyTaskAssignment(
  project: string,
  fromSection: string,
  amount: number,
  userIds: string[]
): Promise<CreateNotificationResponse> {
  return sendAssignmentNotification({
    project,
    from_section: fromSection,
    amount,
    userIds
  })
}

/**
 * Передача заданий команде
 */
export async function notifyTaskAssignmentToTeam(
  project: string,
  fromSection: string,
  amount: number,
  teamId: string
): Promise<CreateNotificationResponse> {
  return sendAssignmentNotification({
    project,
    from_section: fromSection,
    amount,
    filters: { teamId }
  })
}

/**
 * Передача заданий отделу
 */
export async function notifyTaskAssignmentToDepartment(
  project: string,
  fromSection: string,
  amount: number,
  departmentId: string
): Promise<CreateNotificationResponse> {
  return sendAssignmentNotification({
    project,
    from_section: fromSection,
    amount,
    filters: { departmentId }
  })
}

/**
 * Объявление для конкретных пользователей
 */
export async function notifyAnnouncementToUsers(
  userName: string,
  title: string,
  body: string,
  userIds: string[]
): Promise<CreateNotificationResponse> {
  return sendAnnouncementNotification({
    user_name: userName,
    title,
    body,
    userIds
  })
}

/**
 * Объявление для всего отдела
 */
export async function notifyAnnouncementToDepartment(
  userName: string,
  title: string,
  body: string,
  departmentId: string
): Promise<CreateNotificationResponse> {
  return sendAnnouncementNotification({
    user_name: userName,
    title,
    body,
    filters: { departmentId }
  })
}

/**
 * Объявление для всех пользователей
 */
export async function notifyAnnouncementToAll(
  userName: string,
  title: string,
  body: string
): Promise<CreateNotificationResponse> {
  return sendAnnouncementNotification({
    user_name: userName,
    title,
    body,
    filters: {} // Пустые фильтры = всем пользователям
  })
}

// Примеры использования:

/**
 * Пример: Уведомление о новом проекте
 */
export async function notifyProjectCreated(
  projectName: string,
  creatorName: string,
  teamId: string
): Promise<CreateNotificationResponse> {
  return sendNotificationToTeam(
    'project_created',
    {
      title: 'Новый проект создан',
      message: `Проект "${projectName}" был создан пользователем ${creatorName}`,
      type: 'success',
      action: {
        type: 'navigate',
        url: '/dashboard/projects',
      },
    },
    teamId
  )
}

/**
 * Пример: Уведомление о назначении задачи
 */
export async function notifyTaskAssigned(
  taskTitle: string,
  assignedToUserId: string,
  projectName: string,
  dueDate?: string
): Promise<CreateNotificationResponse> {
  return sendNotificationToUsers(
    'task_assigned',
    {
      title: 'Новая задача назначена',
      message: `Вам назначена задача "${taskTitle}" в проекте "${projectName}"${
        dueDate ? ` до ${dueDate}` : ''
      }`,
      type: 'info',
      action: {
        type: 'navigate',
        url: '/dashboard/tasks',
      },
    },
    [assignedToUserId]
  )
}

/**
 * Пример: Уведомление о приближающемся дедлайне
 */
export async function notifyDeadlineApproaching(
  taskTitle: string,
  daysLeft: number,
  assignedToUserId: string
): Promise<CreateNotificationResponse> {
  return sendNotificationToUsers(
    'deadline_approaching',
    {
      title: 'Приближается дедлайн',
      message: `До завершения задачи "${taskTitle}" осталось ${daysLeft} дн.`,
      type: 'warning',
      action: {
        type: 'navigate',
        url: '/dashboard/tasks',
      },
    },
    [assignedToUserId]
  )
}

/**
 * Пример: Уведомление об объявлении
 */
export async function notifyAnnouncement(
  title: string,
  content: string,
  departmentId?: string
): Promise<CreateNotificationResponse> {
  if (departmentId) {
    return sendNotificationToDepartment(
      'announcement',
      {
        title,
        message: content,
        type: 'info',
        action: {
          type: 'navigate',
          url: '/dashboard/announcements',
        },
      },
      departmentId
    )
  } else {
    // Отправляем всем пользователям
    return sendNotification({
      entityType: 'announcement',
      payload: {
        title,
        message: content,
        type: 'info',
        action: {
          type: 'navigate',
          url: '/dashboard/announcements',
        },
      },
      filters: {}, // Пустые фильтры = все пользователи
    })
  }
}

/**
 * Пример: Уведомление пользователям из определенного города
 */
export async function notifyAnnouncementToCity(
  title: string,
  content: string,
  cityId: string
): Promise<CreateNotificationResponse> {
  return sendNotificationToCity(
    'city_announcement',
    {
      title,
      message: content,
      type: 'info',
      action: {
        type: 'navigate',
        url: '/dashboard/announcements',
      },
    },
    cityId
  )
}

/**
 * Пример: Уведомление пользователям из определенной страны
 */
export async function notifyAnnouncementToCountry(
  title: string,
  content: string,
  countryId: string
): Promise<CreateNotificationResponse> {
  return sendNotificationToCountry(
    'country_announcement',
    {
      title,
      message: content,
      type: 'info',
      action: {
        type: 'navigate',
        url: '/dashboard/announcements',
      },
    },
    countryId
  )
}

// =============================================================================
// ФУНКЦИИ ДЛЯ ПОЛУЧЕНИЯ ДАННЫХ ИЗ БД
// =============================================================================

/**
 * Получить все уведомления пользователя с пагинацией
 */
export async function getUserNotifications(
  userId: string,
  page: number = 1,
  limit: number = 20,
  onlyUnread: boolean = false
): Promise<{
  notifications: UserNotificationWithNotification[]
  totalCount: number
  hasMore: boolean
}> {
  return Sentry.startSpan(
    {
      op: "notifications.get_user_notifications",
      name: "Get User Notifications",
    },
    async (span) => {
      try {
        const supabase = createClient()
        const offset = (page - 1) * limit

        span.setAttribute("user.id", userId)
        span.setAttribute("pagination.page", page)
        span.setAttribute("pagination.limit", limit)
        span.setAttribute("pagination.offset", offset)
        span.setAttribute("filter.only_unread", onlyUnread)

        console.log('🔍 getUserNotifications: запрос для пользователя:', userId)
        console.log('🔍 getUserNotifications: параметры:', { page, limit, onlyUnread, offset })

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

        if (onlyUnread) {
          query = query.eq('is_read', false)
        }

        const { data, error, count } = await query
          .range(offset, offset + limit - 1)

        console.log('🔍 getUserNotifications: результат запроса:', { data, error, count })
        console.log('🔍 getUserNotifications: количество записей:', data?.length || 0)
        
        if (data && data.length > 0) {
          console.log('🔍 getUserNotifications: первая запись:', data[0])
          console.log('🔍 getUserNotifications: структура notifications в первой записи:', data[0].notifications)
          console.log('🔍 getUserNotifications: структура entity_types в первой записи:', data[0].notifications?.entity_types)
          
          // Проверяем все записи на наличие связанных данных
          data.forEach((item, index) => {
            console.log(`🔍 getUserNotifications: запись ${index}:`, {
              id: item.id,
              notification_id: item.notification_id,
              has_notifications: !!item.notifications,
              notifications_id: item.notifications?.id,
              has_entity_types: !!item.notifications?.entity_types,
              entity_name: item.notifications?.entity_types?.entity_name,
              payload: item.notifications?.payload
            })
          })
        }

        if (error) {
          span.setAttribute("fetch.success", false)
          span.setAttribute("fetch.error", error.message)
          Sentry.captureException(error, {
            tags: {
              module: 'notifications',
              action: 'get_user_notifications',
              error_type: 'db_error'
            },
            extra: {
              component: 'getUserNotifications',
              user_id: userId,
              page,
              limit,
              only_unread: onlyUnread,
              timestamp: new Date().toISOString()
            }
          })
          console.error('Ошибка при получении уведомлений:', error)
          throw error
        }

        span.setAttribute("fetch.success", true)
        span.setAttribute("notifications.count", data?.length || 0)
        span.setAttribute("notifications.total_count", count || 0)
        span.setAttribute("notifications.has_more", (count || 0) > offset + limit)

        Sentry.addBreadcrumb({
          message: 'User notifications fetched successfully',
          category: 'notifications',
          level: 'info',
          data: {
            user_id: userId,
            count: data?.length || 0,
            total_count: count || 0,
            page,
            limit,
            only_unread: onlyUnread
          }
        })

        return {
          notifications: data || [],
          totalCount: count || 0,
          hasMore: (count || 0) > offset + limit
        }
      } catch (error) {
        span.setAttribute("fetch.success", false)
        span.recordException(error as Error)
        Sentry.captureException(error, {
          tags: {
            module: 'notifications',
            action: 'get_user_notifications',
            error_type: 'unexpected_error'
          },
          extra: {
            component: 'getUserNotifications',
            user_id: userId,
            page,
            limit,
            only_unread: onlyUnread,
            timestamp: new Date().toISOString()
          }
        })
        throw error
      }
    }
  )
}

/**
 * Получить количество непрочитанных уведомлений
 */
export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('user_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    console.error('Ошибка при получении количества непрочитанных уведомлений:', error)
    throw error
  }

  return count || 0
}

/**
 * Отметить уведомление как прочитанное
 */
export async function markNotificationAsRead(
  userId: string,
  userNotificationId: string
): Promise<void> {
  return Sentry.startSpan(
    {
      op: "notifications.mark_as_read",
      name: "Mark Notification As Read",
    },
    async (span) => {
      try {
        const supabase = createClient()

        span.setAttribute("user.id", userId)
        span.setAttribute("user_notification.id", userNotificationId)

        console.log('📝 Помечаем уведомление как прочитанное:', {
          userId,
          userNotificationId
        })

        const { error, data } = await supabase
          .from('user_notifications')
          .update({ 
            is_read: true,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('id', userNotificationId)
          .select()

        if (error) {
          span.setAttribute("mark.success", false)
          span.setAttribute("mark.error", error.message)
          Sentry.captureException(error, {
            tags: {
              module: 'notifications',
              action: 'mark_as_read',
              error_type: 'db_error'
            },
            extra: {
              component: 'markNotificationAsRead',
              user_id: userId,
              user_notification_id: userNotificationId,
              timestamp: new Date().toISOString()
            }
          })
          console.error('❌ Ошибка при отметке уведомления как прочитанного:', error)
          throw error
        }

        span.setAttribute("mark.success", true)
        span.setAttribute("updated.count", data?.length || 0)

        Sentry.addBreadcrumb({
          message: 'Notification marked as read successfully',
          category: 'notifications',
          level: 'info',
          data: {
            user_id: userId,
            user_notification_id: userNotificationId,
            updated_count: data?.length || 0
          }
        })

        console.log('✅ Уведомление успешно помечено как прочитанное:', data)
      } catch (error) {
        span.setAttribute("mark.success", false)
        span.recordException(error as Error)
        Sentry.captureException(error, {
          tags: {
            module: 'notifications',
            action: 'mark_as_read',
            error_type: 'unexpected_error'
          },
          extra: {
            component: 'markNotificationAsRead',
            user_id: userId,
            user_notification_id: userNotificationId,
            timestamp: new Date().toISOString()
          }
        })
        throw error
      }
    }
  )
}

/**
 * Отметить уведомление как непрочитанное
 */
export async function markNotificationAsUnread(
  userId: string,
  userNotificationId: string
): Promise<void> {
  return Sentry.startSpan(
    {
      op: "notifications.mark_as_unread",
      name: "Mark Notification As Unread",
    },
    async (span) => {
      try {
        const supabase = createClient()

        span.setAttribute("user.id", userId)
        span.setAttribute("user_notification.id", userNotificationId)

        const { error, data } = await supabase
          .from('user_notifications')
          .update({ 
            is_read: false,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('id', userNotificationId)
          .select()

        if (error) {
          span.setAttribute("unmark.success", false)
          span.setAttribute("unmark.error", error.message)
          Sentry.captureException(error, {
            tags: {
              module: 'notifications',
              action: 'mark_as_unread',
              error_type: 'db_error'
            },
            extra: {
              component: 'markNotificationAsUnread',
              user_id: userId,
              user_notification_id: userNotificationId,
              timestamp: new Date().toISOString()
            }
          })
          console.error('❌ Ошибка при отметке уведомления как непрочитанного:', error)
          throw error
        }

        span.setAttribute("unmark.success", true)
        span.setAttribute("updated.count", data?.length || 0)
      } catch (error) {
        span.setAttribute("unmark.success", false)
        span.recordException(error as Error)
        Sentry.captureException(error, {
          tags: {
            module: 'notifications',
            action: 'mark_as_unread',
            error_type: 'unexpected_error'
          },
          extra: {
            component: 'markNotificationAsUnread',
            user_id: userId,
            user_notification_id: userNotificationId,
            timestamp: new Date().toISOString()
          }
        })
        throw error
      }
    }
  )
}

/**
 * Установить флаг архива для уведомления пользователя
 */
export async function setUserNotificationArchived(
  userId: string,
  userNotificationId: string,
  isArchived: boolean
): Promise<void> {
  return Sentry.startSpan(
    {
      op: "notifications.set_archived",
      name: "Set User Notification Archived",
    },
    async (span) => {
      try {
        const supabase = createClient()
        span.setAttribute("user.id", userId)
        span.setAttribute("user_notification.id", userNotificationId)
        span.setAttribute("archived.value", isArchived)

        const { error, data } = await supabase
          .from('user_notifications')
          .update({ 
            is_archived: isArchived,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('id', userNotificationId)
          .select()

        if (error) {
          span.setAttribute("archived.success", false)
          span.setAttribute("archived.error", error.message)
          Sentry.captureException(error, {
            tags: {
              module: 'notifications',
              action: 'set_archived',
              error_type: 'db_error'
            },
            extra: {
              component: 'setUserNotificationArchived',
              user_id: userId,
              user_notification_id: userNotificationId,
              is_archived: isArchived,
              timestamp: new Date().toISOString()
            }
          })
          console.error('❌ Ошибка при установке архива для уведомления:', error)
          throw error
        }

        span.setAttribute("archived.success", true)
        span.setAttribute("updated.count", data?.length || 0)
      } catch (error) {
        span.setAttribute("archived.success", false)
        span.recordException(error as Error)
        Sentry.captureException(error, {
          tags: {
            module: 'notifications',
            action: 'set_archived',
            error_type: 'unexpected_error'
          },
          extra: {
            component: 'setUserNotificationArchived',
            user_id: userId,
            user_notification_id: userNotificationId,
            is_archived: isArchived,
            timestamp: new Date().toISOString()
          }
        })
        throw error
      }
    }
  )
}
/**
 * Отметить все уведомления как прочитанные
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('user_notifications')
    .update({ 
      is_read: true,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    console.error('Ошибка при отметке всех уведомлений как прочитанных:', error)
    throw error
  }
}

/**
 * Получить конкретное уведомление пользователя
 */
export async function getUserNotification(
  userId: string,
  notificationId: string
): Promise<UserNotificationWithNotification | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('user_notifications')
    .select(`
      *,
      notifications:notification_id (
        *,
        entity_types:entity_type_id (*)
      )
    `)
    .eq('user_id', userId)
    .eq('notification_id', notificationId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Уведомление не найдено
      return null
    }
    console.error('Ошибка при получении уведомления:', error)
    throw error
  }

  return data
}

/**
 * Удалить уведомление пользователя
 */
export async function deleteUserNotification(
  userId: string,
  notificationId: string
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('user_notifications')
    .delete()
    .eq('user_id', userId)
    .eq('notification_id', notificationId)

  if (error) {
    console.error('Ошибка при удалении уведомления:', error)
    throw error
  }
}

/**
 * Получить последние уведомления пользователя (для звонка/колокольчика)
 */
export async function getRecentNotifications(
  userId: string,
  limit: number = 5
): Promise<UserNotificationWithNotification[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('user_notifications')
    .select(`
      *,
      notifications:notification_id (
        *,
        entity_types:entity_type_id (*)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Ошибка при получении последних уведомлений:', error)
    throw error
  }

  return data || []
} 

/**
 * Временная функция для отладки - проверяет все записи в user_notifications
 */
export async function debugUserNotifications(userId: string): Promise<void> {
  const supabase = createClient()
  
  console.log('🔍 DEBUG: Проверка user_notifications для пользователя:', userId)
  
  // Проверяем все записи в user_notifications для этого пользователя
  const { data: userNotifications, error: userError } = await supabase
    .from('user_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)
    
  console.log('🔍 DEBUG: user_notifications записи:', userNotifications?.length || 0)
  if (userNotifications && userNotifications.length > 0) {
    console.log('🔍 DEBUG: последние user_notifications:', userNotifications)
  }
  
  if (userError) {
    console.error('🔍 DEBUG: ошибка user_notifications:', userError)
  }
  
  // Проверяем полный JOIN запрос - такой же как в getUserNotifications
  const { data: joinedData, error: joinError } = await supabase
    .from('user_notifications')
    .select(`
      *,
      notifications:notification_id (
        *,
        entity_types:entity_type_id (*)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5)
    
  console.log('🔍 DEBUG: JOIN запрос результат:', joinedData?.length || 0)
  if (joinedData && joinedData.length > 0) {
    console.log('🔍 DEBUG: полные данные JOIN:', JSON.stringify(joinedData, null, 2))
  }
  
  if (joinError) {
    console.error('🔍 DEBUG: ошибка JOIN запроса:', joinError)
  }
  
  // Проверяем все записи в notifications
  const { data: notifications, error: notifError } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)
    
  console.log('🔍 DEBUG: notifications записи:', notifications?.length || 0)
  if (notifications && notifications.length > 0) {
    console.log('🔍 DEBUG: последние notifications:', notifications)
  }
  
  if (notifError) {
    console.error('🔍 DEBUG: ошибка notifications:', notifError)
  }
  
  // Проверяем entity_types
  const { data: entityTypes, error: entityError } = await supabase
    .from('entity_types')
    .select('*')
    
  console.log('🔍 DEBUG: entity_types записи:', entityTypes?.length || 0)
  if (entityTypes && entityTypes.length > 0) {
    console.log('🔍 DEBUG: entity_types:', entityTypes)
  }
  
  if (entityError) {
    console.error('🔍 DEBUG: ошибка entity_types:', entityError)
  }
  
  // Проверяем конкретные notification_id из вашей таблицы
  const testNotificationIds = [
    '18c5808d-ebd1-4989-8f94-d9db531ca7e7',
    '1e3ff8c4-ddb6-426c-adc9-3eeb98fbcdf3',
    '7140d06a-b69e-4ebd-b245-079967dd2e39',
    'cd960712-8a2f-4fbb-9ded-180b2bff63d3',
    '4792c6f4-daaf-42f9-8d10-d2af9a417968'
  ]
  
  for (const notifId of testNotificationIds) {
    const { data: notifData, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notifId)
      .single()
      
    console.log(`🔍 DEBUG: notification ${notifId}:`, notifData || 'НЕ НАЙДЕНО', notifError?.message || '')
  }
}

/**
 * Тестовая функция для создания тестового уведомления
 */
export async function createTestNotification(userId: string): Promise<void> {
  const supabase = createClient()
  
  try {
    // Сначала проверим, есть ли entity_type для 'test'
    let { data: entityType, error: entityError } = await supabase
      .from('entity_types')
      .select('*')
      .eq('entity_name', 'test')
      .single()
    
    if (entityError || !entityType) {
      // Создаем entity_type если его нет
      const { data: newEntityType, error: createEntityError } = await supabase
        .from('entity_types')
        .insert({ entity_name: 'test' })
        .select()
        .single()
      
      if (createEntityError) {
        console.error('❌ Ошибка создания entity_type:', createEntityError)
        return
      }
      
      entityType = newEntityType
    }
    
    // Создаем уведомление
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        entity_type_id: entityType.id,
        payload: {
          title: 'Тестовое уведомление',
          message: 'Это тестовое уведомление для проверки системы',
          type: 'info'
        },
        rendered_text: 'Тестовое уведомление: Это тестовое уведомление для проверки системы'
      })
      .select()
      .single()
    
    if (notificationError) {
      console.error('❌ Ошибка создания уведомления:', notificationError)
      return
    }
    
    // Создаем user_notification
    const { data: userNotification, error: userNotificationError } = await supabase
      .from('user_notifications')
      .insert({
        notification_id: notification.id,
        user_id: userId,
        is_read: false,
        is_archived: false
      })
      .select()
      .single()
    
    if (userNotificationError) {
      console.error('❌ Ошибка создания user_notification:', userNotificationError)
      return
    }
    
    console.log('✅ Тестовое уведомление создано:', {
      notification: notification.id,
      userNotification: userNotification.id
    })
  } catch (error) {
    console.error('❌ Ошибка при создании тестового уведомления:', error)
  }
} 