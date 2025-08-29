"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import * as Sentry from "@sentry/nextjs"
import { useRouter } from "next/navigation"

import { formatDistanceToNow, format, differenceInHours } from "date-fns"
import { ru } from "date-fns/locale"
import { AlertCircle, CheckCircle, Info, AlertTriangle, ChevronDown, Square, SquareCheck, Archive, Undo2, PencilIcon } from "lucide-react"
import { Notification } from "@/stores/useNotificationsStore"
import { useNotificationsStore } from "@/stores/useNotificationsStore"
import { useAnnouncementsStore } from "@/modules/announcements/store"
import { useProjectsStore } from "@/modules/projects/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAnnouncementsPermissions } from "@/modules/permissions/hooks/usePermissions"

interface NotificationItemProps {
  notification: Notification
  isVisible?: boolean // Для отслеживания видимости
  onEditAnnouncement?: (announcementId: string) => void // Функция для редактирования объявлений
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

export function NotificationItem({ notification, isVisible = false, onEditAnnouncement }: NotificationItemProps) {
  const Icon = typeIcons[notification.type || "info"]
  const iconColor = typeColors[notification.type || "info"]
  const notificationTag = getNotificationTag(notification.entityType)
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)
  
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

  const { markAsRead, markAsUnread, markAsReadInDB, markAsUnreadInDB, setArchivedInDB, setNotificationArchived } = useNotificationsStore()
  const { highlightAnnouncement, announcements } = useAnnouncementsStore()
  const { highlightSection } = useProjectsStore()
  // canManage permission allows full management of announcements (create, edit, delete, etc.)
  const { canManage: canManageAnnouncements } = useAnnouncementsPermissions()

  // Определяем, нужно ли показывать конкретное время (если прошло более 24 часов)
  const hoursSinceCreation = differenceInHours(new Date(), notification.createdAt)
  const shouldShowDateTime = hoursSinceCreation >= 24

  // ID объявления если он есть в payload
  const announcementId = (notification.entityType === 'announcement' || notification.entityType === 'announcements')
    ? (notification.payload?.announcement_id || notification.payload?.action?.data?.announcementId)
    : null

  // Пытаемся взять полный текст объявления из стора, иначе из payload
  const announcementFromStore = announcementId 
    ? announcements.find(a => a.id === announcementId)
    : undefined

  const fullAnnouncementText: string | undefined =
    (announcementFromStore?.text) ||
    (notification.payload?.announcement?.body) ||
    (notification.payload?.body) ||
    (notification.payload?.text)

  // Безопасное форматирование текста без использования dangerouslySetInnerHTML
  function formatAnnouncementText(text: string): string {
    // Экранируем HTML-символы для предотвращения XSS
    const escapeHtml = (str: string) => {
      const div = document.createElement('div')
      div.textContent = str
      return div.innerHTML
    }

    // Экранируем весь текст
    let escapedText = escapeHtml(text)

    // Применяем простое форматирование через безопасные замены
    escapedText = escapedText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
      .replace(/\n/g, '<br>')

    return escapedText
  }

  // Реф и вычисление: есть ли обрезка (только для анонсов)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [isExpandableAnnouncement, setIsExpandableAnnouncement] = useState(false)

  useEffect(() => {
    if (!(notification.entityType === 'announcement' || notification.entityType === 'announcements')) {
      setIsExpandableAnnouncement(false)
      return
    }

    const el = contentRef.current
    if (!el || !fullAnnouncementText) {
      setIsExpandableAnnouncement(false)
      return
    }

    const measure = () => {
      try {
        const styleAny = el.style as any
        const prevWebkitLineClamp = styleAny.webkitLineClamp
        const prevWebkitBoxOrient = styleAny.webkitBoxOrient
        const prevDisplay = el.style.display
        const prevOverflow = el.style.overflow

        // Временно убираем line-clamp, чтобы получить натуральную высоту
        styleAny.webkitLineClamp = 'unset'
        styleAny.webkitBoxOrient = 'unset'
        el.style.display = 'block'
        el.style.overflow = 'visible'

        // Принудительный рефлоу
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.offsetHeight

        const computed = window.getComputedStyle(el)
        const lineHeight = parseFloat(computed.lineHeight)
        const naturalHeight = el.scrollHeight

        // Возвращаем исходные стили
        styleAny.webkitLineClamp = prevWebkitLineClamp
        styleAny.webkitBoxOrient = prevWebkitBoxOrient
        el.style.display = prevDisplay
        el.style.overflow = prevOverflow

        if (lineHeight > 0) {
          const lines = naturalHeight / lineHeight
          setIsExpandableAnnouncement(lines > 2.1)
        } else {
          // Фоллбек: грубая эвристика по длине текста
          const plain = formatAnnouncementText(fullAnnouncementText)
            .replace(/<[^>]*>/g, "")
            .replace(/\s+/g, " ")
            .trim()
          setIsExpandableAnnouncement(plain.length > 160)
        }
      } catch {
        setIsExpandableAnnouncement(false)
      }
    }

    measure()
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [notification.entityType, fullAnnouncementText])

  // Функция для обработки клика на уведомление
  const handleClick = useCallback(() => {
    // Для объявлений клики по карточке отключены полностью
    if (notification.entityType === 'announcement' || notification.entityType === 'announcements') {
      return
    }
    Sentry.startSpan(
      {
        op: "ui.click",
        name: "Notification Item Click",
      },
      (span) => {
        try {
          span.setAttribute("notification.id", notification.id)
          span.setAttribute("notification.entity_type", notification.entityType || "unknown")
          span.setAttribute("notification.is_read", notification.isRead)
          span.setAttribute("notification.type", notification.type || "info")
          
          span.setAttribute("click.skipped", true)
          span.setAttribute("click.skip_reason", "unsupported_entity_type_or_disabled")
        } catch (error) {
          span.setAttribute("click.success", false)
          span.recordException(error as Error)
          Sentry.captureException(error, {
            tags: {
              module: 'notifications',
              component: 'NotificationItem',
              action: 'handle_click',
              error_type: 'unexpected_error'
            },
            extra: {
              notification_id: notification.id,
              notification_entity_type: notification.entityType,
              notification_is_read: notification.isRead,
              timestamp: new Date().toISOString()
            }
          })
          console.error('Ошибка при клике на уведомление:', error)
        }
      }
    );
    
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
        "relative p-4 rounded-lg border transition-colors",
        // Ховер и курсор только если это не объявление
        (notification.entityType === 'announcement' || notification.entityType === 'announcements')
          ? "cursor-default"
          : "hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer",
        "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
        // Зеленая окантовка и подсветка для непрочитанных уведомлений
        !notification.isRead && "border-green-500 bg-green-50/30 dark:bg-green-900/10"
      )}
    >
      {/* Первый уровень: иконка слева, кнопки действий справа */}
      <div className="flex items-center justify-between mb-3">
        <Icon className={cn("h-4 w-4 flex-shrink-0", iconColor)} />
        <div className="flex items-center gap-1">
          {/* Если уведомление не в архиве — показываем чекбокс и иконку Архива */}
          {!notification.isArchived && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={async (e) => {
                  e.stopPropagation()
                  try {
                    await Sentry.startSpan({ op: "notifications.toggle_read_click", name: "Toggle Read Click" }, async (span) => {
                      span.setAttribute("notification.id", notification.id)
                      if (!notification.isRead) {
                        markAsRead(notification.id)
                        try {
                          await markAsReadInDB(notification.id)
                          span.setAttribute("mark.success", true)
                        } catch (error) {
                          span.setAttribute("mark.success", false)
                          span.recordException(error as Error)
                          Sentry.captureException(error, {
                            tags: { module: 'notifications', component: 'NotificationItem', action: 'toggle_read_click', error_type: 'db_error' },
                            extra: { notification_id: notification.id, timestamp: new Date().toISOString() }
                          })
                        }
                      } else {
                        // Делаем непрочитанным локально и в БД
                        markAsUnread(notification.id)
                        try {
                          await markAsUnreadInDB(notification.id)
                          span.setAttribute("unmark.success", true)
                        } catch (error) {
                          span.setAttribute("unmark.success", false)
                          span.recordException(error as Error)
                          Sentry.captureException(error, {
                            tags: { module: 'notifications', component: 'NotificationItem', action: 'toggle_unread_click', error_type: 'db_error' },
                            extra: { notification_id: notification.id, timestamp: new Date().toISOString() }
                          })
                        }
                      }
                    })
                  } catch (error) {
                    Sentry.captureException(error, {
                      tags: { module: 'notifications', component: 'NotificationItem', action: 'toggle_read_click', error_type: 'unexpected_error' },
                      extra: { notification_id: notification.id, timestamp: new Date().toISOString() }
                    })
                  }
                }}
                className={cn("h-7 w-7", notification.isRead ? "text-gray-400" : "text-green-600 hover:text-green-700")}
                aria-label={notification.isRead ? "Прочитано" : "Отметить прочитанным"}
                title={notification.isRead ? "Сделать непрочитанным" : "Отметить прочитанным"}
              >
                {notification.isRead ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <SquareCheck className="h-4 w-4" />
                )}
              </Button>

              {/* Кнопка редактирования для объявлений */}
              {(notification.entityType === 'announcement' || notification.entityType === 'announcements') && 
               canManageAnnouncements && 
               onEditAnnouncement && 
               announcementId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditAnnouncement(announcementId)
                  }}
                  className="h-7 w-7 text-gray-500 hover:text-blue-600"
                  aria-label="Редактировать объявление"
                  title="Редактировать объявление"
                >
                  <PencilIcon className="h-4 w-4" />
                </Button>
              )}

              {/* Архив */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={async (e) => {
                  e.stopPropagation()
                  try {
                    await Sentry.startSpan({ op: "notifications.archive_click", name: "Archive Notification" }, async (span) => {
                      span.setAttribute("notification.id", notification.id)
                      // При архивации помечаем прочитанным
                      if (!notification.isRead) {
                        markAsRead(notification.id)
                        try { await markAsReadInDB(notification.id) } catch {}
                      }
                      setNotificationArchived(notification.id, true)
                      try {
                        await setArchivedInDB(notification.id, true)
                        span.setAttribute("archive.success", true)
                      } catch (error) {
                        span.setAttribute("archive.success", false)
                        span.recordException(error as Error)
                        Sentry.captureException(error, {
                          tags: { module: 'notifications', component: 'NotificationItem', action: 'archive_click', error_type: 'db_error' },
                          extra: { notification_id: notification.id, timestamp: new Date().toISOString() }
                        })
                      }
                    })
                  } catch (error) {
                    Sentry.captureException(error, {
                      tags: { module: 'notifications', component: 'NotificationItem', action: 'archive_click', error_type: 'unexpected_error' },
                      extra: { notification_id: notification.id, timestamp: new Date().toISOString() }
                    })
                  }
                }}
                className="h-7 w-7 text-gray-500 hover:text-gray-700"
                aria-label="В архив"
                title="В архив"
              >
                <Archive className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Если уведомление в архиве — показываем кнопку разархивации */}
          {notification.isArchived && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={async (e) => {
                e.stopPropagation()
                try {
                  await Sentry.startSpan({ op: "notifications.unarchive_click", name: "Unarchive Notification" }, async (span) => {
                    span.setAttribute("notification.id", notification.id)
                    setNotificationArchived(notification.id, false)
                    try {
                      await setArchivedInDB(notification.id, false)
                      span.setAttribute("unarchive.success", true)
                    } catch (error) {
                      span.setAttribute("unarchive.success", false)
                      span.recordException(error as Error)
                      Sentry.captureException(error, {
                        tags: { module: 'notifications', component: 'NotificationItem', action: 'unarchive_click', error_type: 'db_error' },
                        extra: { notification_id: notification.id, timestamp: new Date().toISOString() }
                      })
                    }
                  })
                } catch (error) {
                  Sentry.captureException(error, {
                    tags: { module: 'notifications', component: 'NotificationItem', action: 'unarchive_click', error_type: 'unexpected_error' },
                    extra: { notification_id: notification.id, timestamp: new Date().toISOString() }
                  })
                }
              }}
              className="h-7 w-7 text-gray-500 hover:text-gray-700"
              aria-label="Вернуть из архива"
              title="Вернуть из архива"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Второй уровень: заголовок слева, тип уведомления справа */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
            {notification.title}
          </h4>
        </div>
        {notificationTag && (
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0",
            notificationTag.color
          )}>
            {notificationTag.text}
          </span>
        )}
      </div>

      {/* Контент уведомления */}
      <div className="mb-3">
        {(notification.entityType === 'announcement' || notification.entityType === 'announcements') && fullAnnouncementText ? (
          <div
            className={cn(
              "text-xs text-gray-600 dark:text-gray-400 break-words",
              isExpanded ? "whitespace-pre-wrap" : "line-clamp-2"
            )}
            ref={contentRef}
            dangerouslySetInnerHTML={{ __html: formatAnnouncementText(fullAnnouncementText) }}
          />
        ) : (
          <p className="text-xs line-clamp-2 text-gray-600 dark:text-gray-400 break-words">
            {notification.message}
          </p>
        )}
      </div>

      {/* Кнопка раскрытия для объявлений */}
      {(notification.entityType === 'announcement' || notification.entityType === 'announcements') && fullAnnouncementText && isExpandableAnnouncement && (
        <div className="mb-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsExpanded((prev) => !prev) }}
            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
            {isExpanded ? 'Свернуть' : 'Читать полностью'}
          </button>
        </div>
      )}

      {/* Нижняя строка: время и дополнительная информация */}
      <div className="flex items-center justify-between">
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
  )
}
