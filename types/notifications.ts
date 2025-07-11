// Типы для таблиц уведомлений
export interface NotificationRow {
  id: string
  entity_type_id: string
  payload: Record<string, any>
  rendered_text: string | null
  created_at: string
  updated_at: string
}

export interface UserNotificationRow {
  id: string
  notification_id: string
  user_id: string
  is_read: boolean
  created_at: string
}

export interface EntityTypeRow {
  id: string
  entity_name: string
}

// Типы для вставки данных
export interface NotificationInsert {
  entity_type_id: string
  payload: Record<string, any>
  rendered_text?: string | null
}

export interface UserNotificationInsert {
  notification_id: string
  user_id: string
  is_read?: boolean
}

export interface EntityTypeInsert {
  entity_name: string
}

// Типы для обновления данных
export interface NotificationUpdate {
  entity_type_id?: string
  payload?: Record<string, any>
  rendered_text?: string | null
}

export interface UserNotificationUpdate {
  notification_id?: string
  user_id?: string
  is_read?: boolean
}

export interface EntityTypeUpdate {
  entity_name?: string
}

// Расширенные типы для JOIN запросов
export interface NotificationWithEntityType extends NotificationRow {
  entity_types: EntityTypeRow
}

export interface UserNotificationWithNotification extends UserNotificationRow {
  notifications: NotificationWithEntityType
}

// Типы для специфичных уведомлений
export interface AssignmentPayload {
  project: string
  from_section: string
  amount: number
}

export interface AnnouncementPayload {
  user_name: string
  title: string
  body: string
}

// Типы для полезной нагрузки уведомлений
export interface NotificationPayload {
  title?: string
  message?: string
  description?: string
  type?: 'info' | 'warning' | 'error' | 'success'
  action?: {
    type: string
    url?: string
    data?: Record<string, any>
  }
  metadata?: Record<string, any>
  assignment?: AssignmentPayload
  announcement?: AnnouncementPayload
}

// Типы для создания уведомлений
export interface CreateNotificationRequest {
  entityType: string
  payload: NotificationPayload
  userIds?: string[]
  filters?: {
    departmentId?: string
    positionId?: string
    roleId?: string
    teamId?: string
    workFormat?: string
    categoryId?: string
    isHourly?: boolean
  }
}

export interface CreateNotificationResponse {
  notificationId: string
}

// Типы для специфичных запросов
export interface CreateAssignmentNotificationRequest {
  project: string
  from_section: string
  amount: number
  userIds?: string[]
  filters?: {
    departmentId?: string
    positionId?: string
    roleId?: string
    teamId?: string
    workFormat?: string
    categoryId?: string
    isHourly?: boolean
  }
}

export interface CreateAnnouncementNotificationRequest {
  user_name: string
  title: string
  body: string
  userIds?: string[]
  filters?: {
    departmentId?: string
    positionId?: string
    roleId?: string
    teamId?: string
    workFormat?: string
    categoryId?: string
    isHourly?: boolean
  }
}

// Функции для генерации текста уведомлений
export function generateAssignmentNotificationText(payload: AssignmentPayload): { title: string; message: string } {
  return {
    title: 'Передача заданий',
    message: `Вам передано ${payload.amount} заданий по проекту "${payload.project}" из раздела "${payload.from_section}"`
  }
}

export function generateAnnouncementNotificationText(payload: AnnouncementPayload): { title: string; message: string } {
  return {
    title: `Новое объявление ${payload.title} от ${payload.user_name}`,
    message: `${payload.body}`
  }
} 