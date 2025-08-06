"use client"

import type React from "react"
import { useCallback } from "react"
import { useRouter } from "next/navigation"

import { formatDistanceToNow, format, differenceInHours } from "date-fns"
import { ru } from "date-fns/locale"
import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react"
import { Notification } from "@/stores/useNotificationsStore"
import { useNotificationsStore } from "@/stores/useNotificationsStore"
import { useAnnouncementsStore } from "@/modules/announcements/store"
import { useProjectsStore } from "@/modules/projects/store"
import { cn } from "@/lib/utils"

interface NotificationItemProps {
  notification: Notification
  isVisible?: boolean // Для отслеживания видимости
}

const typeIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
}

const typeColors = {
  info: "text-blue-500",
  success: "text-green-500",
  warning: "text-yellow-500",
  error: "text-red-500",
}

// Добавляем теги для типов уведомлений
const notificationTags = {
  announcement: {
    text: "Объявление",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-800/20 dark:text-purple-200",
  },
  announcements: {
    text: "Объявление",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-800/20 dark:text-purple-200",
  },
  assignment: {
    text: "Передача заданий",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-800/20 dark:text-orange-200",
  },
  assignments: {
    text: "Передача заданий",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-800/20 dark:text-orange-200",
  },
  section_comment: {
    text: "Комментарий",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-200",
  },
}

// Функция для получения тега уведомления
function getNotificationTag(entityType?: string) {
  if (!entityType) return null
  return notificationTags[entityType as keyof typeof notificationTags]
}

export function NotificationItem({ notification, isVisible = false }: NotificationItemProps) {
  const Icon = typeIcons[notification.type || "info"]
  const iconColor = typeColors[notification.type || "info"]
  const notificationTag = getNotificationTag(notification.entityType)
  const router = useRouter()
  
  // Получаем имя пользователя из payload для объявлений
  const userName = (notification.entityType === 'announcement' || notification.entityType === 'announcements') 
    ? notification.payload?.user_name 
    : null
  
  // Получаем название раздела из payload для заданий
  const fromSection = (notification.entityType === 'assignment' || notification.entityType === 'assignments') 
    ? notification.payload?.from_section
    : null

  // Получаем имя автора комментария из payload для комментариев
  const commentAuthor = (notification.entityType === 'section_comment') 
    ? notification.payload?.section_comment?.author_name 
    : null

  const { markAsRead, markAsReadInDB } = useNotificationsStore()
  const { highlightAnnouncement } = useAnnouncementsStore()
  const { highlightSection } = useProjectsStore()

  // Определяем, нужно ли показывать конкретное время (если прошло более 24 часов)
  const hoursSinceCreation = differenceInHours(new Date(), notification.createdAt)
  const shouldShowDateTime = hoursSinceCreation >= 24

  // Функция для обработки клика на уведомление
  const handleClick = useCallback(() => {
    // Если это уведомление об объявлении, переходим к нему
    if (notification.entityType === 'announcement' || notification.entityType === 'announcements') {
      const announcementId = notification.payload?.announcement_id || notification.payload?.action?.data?.announcementId
      
      if (announcementId) {
        // Выделяем объявление в store
        highlightAnnouncement(announcementId)
        
        // Переходим на страницу dashboard
        router.push('/dashboard')
      }
    }
    
    // Если это уведомление о комментарии, подсвечиваем раздел
    if (notification.entityType === 'section_comment') {
      const sectionId = notification.payload?.section_comment?.section_id
      
      if (sectionId) {
        // Подсвечиваем раздел (всегда открывает комментарии)
        highlightSection(sectionId)
        
        // Переходим на страницу проектов (чистый URL!)
        router.push('/dashboard/projects')
      }
    }
  }, [notification, highlightAnnouncement, router, highlightSection])

  return (
    <div
      data-notification-id={notification.id}
      onClick={handleClick}
      className={cn(
        "relative p-3 rounded-lg border transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer",
        "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
        // Зеленая рамочка для новых непрочитанных уведомлений, которые видны в панели
        !notification.isRead && isVisible && "border-l-4 border-l-green-500 bg-green-50/30 dark:bg-green-900/10"
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", iconColor)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {notification.title}
            </h4>
            {notificationTag && (
              <span className={cn(
                "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium shrink-0",
                notificationTag.color
              )}>
                {notificationTag.text}
              </span>
            )}
          </div>

          <p className="text-xs mt-1 line-clamp-2 text-gray-600 dark:text-gray-400">
            {notification.message}
          </p>

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {shouldShowDateTime 
                ? format(notification.createdAt, "dd.MM.yyyy HH:mm", { locale: ru })
                : formatDistanceToNow(notification.createdAt, {
                    addSuffix: true,
                    locale: ru,
                  })
              }
            </p>
            {userName && (
              <p className="text-xs text-gray-500 dark:text-gray-500 font-medium">
                {userName}
              </p>
            )}
            {fromSection && (
              <p className="text-xs text-gray-500 dark:text-gray-500 font-medium">
                из {fromSection}
              </p>
            )}
            {commentAuthor && (
              <p className="text-xs text-gray-500 dark:text-gray-500 font-medium">
                 {commentAuthor}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Индикатор нового уведомления */}
      {!notification.isRead && (
        <div className="absolute top-3 right-3 h-2 w-2 bg-green-600 rounded-full"></div>
      )}
    </div>
  )
}
