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
  try {
    const response = await fetch(NOTIFICATIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Ошибка при отправке уведомления:', error)
    throw error
  }
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
  const supabase = createClient()
  const offset = (page - 1) * limit

  let query = supabase
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

  if (onlyUnread) {
    query = query.eq('is_read', false)
  }

  const { data, error, count } = await query
    .range(offset, offset + limit - 1)
    .limit(limit)

  if (error) {
    console.error('Ошибка при получении уведомлений:', error)
    throw error
  }

  return {
    notifications: data || [],
    totalCount: count || 0,
    hasMore: (count || 0) > offset + limit
  }
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
  notificationId: string
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('user_notifications')
    .update({ 
      is_read: true,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('notification_id', notificationId)

  if (error) {
    console.error('Ошибка при отметке уведомления как прочитанного:', error)
    throw error
  }
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