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
import { useHoverWithPortalSupport } from "@/hooks/useHoverWithPortalSupport"

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
    color: "bg-purple-100 text-purple-800 border border-purple-800/30 dark:bg-purple-800/30 dark:text-purple-200 dark:border-purple-200/30",
  },
  announcements: {
    text: "Объявление",
    color: "bg-purple-100 text-purple-800 border border-purple-800/30 dark:bg-purple-800/30 dark:text-purple-200 dark:border-purple-200/30 ",
  },
  assignment: {
    text: "Передача заданий",
    color: "bg-orange-100 text-orange-800 border border-orange-800/30 dark:bg-orange-800/30 dark:text-orange-200 dark:border-orange-200/30",
  },
  assignments: {
    text: "Передача заданий",
    color: "bg-orange-100 text-orange-800 border border-orange-800/30 dark:bg-orange-800/30 dark:text-orange-200 dark:border-orange-200/30",
  },
  section_comment: {
    text: "Комментарий",
    color: "bg-blue-100 text-blue-800 border border-blue-800/30 dark:bg-blue-800/30 dark:text-blue-200 dark:border-blue-200/30",
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
  const hoveredNotificationId = useNotificationsStore((s) => s.hoveredNotificationId)
  const setHoveredNotification = useNotificationsStore((s) => s.setHoveredNotification)
  const clearHoveredNotification = useNotificationsStore((s) => s.clearHoveredNotification)
  // Подписываемся на координаты курсора из стора, чтобы реактивно восстанавливать hover
  const lastPointerPosition = useNotificationsStore((s) => s.lastPointerPosition)
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

  // Универсальная проверка: находится ли указатель внутри элемента
  function isPointerInsideElement(element: HTMLElement | null, clientX: number, clientY: number): boolean {
    if (!element) return false
    const rect = element.getBoundingClientRect()
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  }

  // Реф и вычисление: есть ли обрезка (только для анонсов)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const { ref: rootRef, isHovered: isRootHovered, handlers: rootHoverHandlers } = useHoverWithPortalSupport<HTMLDivElement>()

  // Синхронизируем локальный hover с глобальным стором
  useEffect(() => {
    if (isRootHovered) {
      setHoveredNotification(notification.id)
    } else {
      clearHoveredNotification()
    }
  }, [isRootHovered, notification.id, setHoveredNotification, clearHoveredNotification])
  // Рефы для кнопок управления (прочитано/редактировать/архив)
  const readBtnRef = useRef<HTMLButtonElement | null>(null)
  const editBtnRef = useRef<HTMLButtonElement | null>(null)
  const archiveBtnRef = useRef<HTMLButtonElement | null>(null)
  const [isExpandableAnnouncement, setIsExpandableAnnouncement] = useState(false)
  // Локальные флаги для устойчивого hover кнопок, чтобы не зависеть от :hover при ремоунтах
  const [isReadButtonHovered, setIsReadButtonHovered] = useState(false)
  const [isEditButtonHovered, setIsEditButtonHovered] = useState(false)
  const [isArchiveButtonHovered, setIsArchiveButtonHovered] = useState(false)

  // Фабричный хелпер: создает устойчивые hover-обработчики для кнопок на основе ref и сеттера
  function createButtonHoverHandlers(
    buttonRef: { current: HTMLElement | null },
    setHovered: (value: boolean) => void
  ) {
    return {
      onMouseEnter: () => setHovered(true),
      onMouseMove: () => setHovered(true),
      onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
        const el = buttonRef.current
        if (!el) { setHovered(false); return }
        const rect = el.getBoundingClientRect()
        const x = e.clientX
        const y = e.clientY
        const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
        if (inside) return
        setHovered(false)
      },
    }
  }

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

  // Восстанавливаем hover, если курсор неподвижен внутри карточки, но произошел ререндер/пересоздание DOM
  useEffect(() => {
    const el = rootRef.current
    const pos = lastPointerPosition
    if (!pos) return
    if (isPointerInsideElement(el, pos.x, pos.y)) {
      setHoveredNotification(notification.id)
    }
  }, [notification.id, setHoveredNotification, lastPointerPosition])

  // Восстанавливаем hover для кнопок, если курсор неподвижен поверх них
  useEffect(() => {
    const pos = lastPointerPosition
    if (!pos) return
    setIsReadButtonHovered(isPointerInsideElement(readBtnRef.current, pos.x, pos.y))
    setIsEditButtonHovered(isPointerInsideElement(editBtnRef.current, pos.x, pos.y))
    setIsArchiveButtonHovered(isPointerInsideElement(archiveBtnRef.current, pos.x, pos.y))
  }, [hoveredNotificationId, notification.id, notification.isArchived, lastPointerPosition])

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
      ref={rootRef}
      data-notification-id={notification.id}
      onClick={handleClick}
      // Используем pointer-события из хука для устойчивого hover без дублирования геометрии
      onPointerEnter={rootHoverHandlers.onPointerEnter}
      onPointerLeave={rootHoverHandlers.onPointerLeave}
      className={cn(
        "relative p-4 rounded-lg border transition-colors group",
        // Курсор: для объявлений оставляем обычный курсор, для остальных — pointer
        (notification.entityType === 'announcement' || notification.entityType === 'announcements')
          ? "cursor-default"
          : "cursor-pointer",
        "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-500",
        // Мгновенная реакция на hover через CSS, плюс устойчивый hover через стор
        "hover:bg-gray-100 dark:hover:bg-gray-700/40",
        hoveredNotificationId === notification.id && "bg-gray-100 dark:bg-gray-700/40"
      )}
    >
      {notificationTag && (
        <div className="absolute right-2 top-6 -translate-y-1/2 z-10 inline-flex items-start gap-2">
          <span
            className={cn(
              "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
              notificationTag.color
            )}
          >
            {notificationTag.text}
          </span>
          {!notification.isRead && (
            <span
              className="h-2 w-2 rounded-full bg-blue-500"
              aria-label="Непрочитанное уведомление"
            />
          )}
        </div>
      )}

      <div className={cn(
        // Мгновенное появление при hover без задержки за счет CSS
        "absolute top-2 right-2 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-0",
        // Дополнительно держим панель видимой, если hover зафиксирован в сторе
        hoveredNotificationId === notification.id && "opacity-100"
      )}>
        <div
          className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-1 py-0.5 pointer-events-auto"
          onMouseEnter={() => setHoveredNotification(notification.id)}
          onMouseMove={() => setHoveredNotification(notification.id)}
        >
          {!notification.isArchived ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                ref={readBtnRef}
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
                {...createButtonHoverHandlers(readBtnRef, setIsReadButtonHovered)}
                className={cn(
                  "h-7 w-7 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 pointer-events-auto",
                  // Реплика состояния :hover у ghost-кнопки, чтобы не пропадало при статичном курсоре
                  isReadButtonHovered && "bg-accent text-accent-foreground"
                )}
                aria-label={notification.isRead ? "Прочитано" : "Отметить прочитанным"}
                title={notification.isRead ? "Сделать непрочитанным" : "Отметить прочитанным"}
              >
                {notification.isRead ? (
                  <SquareCheck className="h-4 w-4" />
                ) : (
                  <span className="relative inline-flex h-4 w-4 items-center justify-center">
                    <Square className="h-4 w-4" />
                    <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                  </span>
                )}
              </Button>

              {(notification.entityType === 'announcement' || notification.entityType === 'announcements') && 
               canManageAnnouncements && 
               onEditAnnouncement && 
               announcementId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  ref={editBtnRef}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditAnnouncement(announcementId)
                  }}
                  {...createButtonHoverHandlers(editBtnRef, setIsEditButtonHovered)}
                  className={cn(
                    "h-7 w-7 text-gray-500 hover:text-blue-600 pointer-events-auto",
                    // Реплика состояния :hover у ghost-кнопки + фирменный цвет текста
                    isEditButtonHovered && "bg-accent text-blue-600"
                  )}
                  aria-label="Редактировать объявление"
                  title="Редактировать объявление"
                >
                  <PencilIcon className="h-4 w-4" />
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                ref={archiveBtnRef}
                onClick={async (e) => {
                  e.stopPropagation()
                  try {
                    await Sentry.startSpan({ op: "notifications.archive_click", name: "Archive Notification" }, async (span) => {
                      span.setAttribute("notification.id", notification.id)
                      if (!notification.isRead) {
                        markAsRead(notification.id)
                        try {
                          await markAsReadInDB(notification.id)
                        } catch (error) {
                          // Логируем ошибку вместо молчаливого игнорирования и делаем минимальное восстановление (ретрай)
                          Sentry.captureException(error, {
                            tags: { module: 'notifications', component: 'NotificationItem', action: 'archive_click_mark_read', error_type: 'db_error' },
                            extra: { notification_id: notification.id, timestamp: new Date().toISOString() }
                          })
                          console.error('Не удалось отметить уведомление прочитанным в БД перед архивированием', {
                            notificationId: notification.id,
                            error,
                          })

                          // Минимальное восстановление: однократная отложенная попытка
                          setTimeout(() => {
                            markAsReadInDB(notification.id).catch((retryError) => {
                              Sentry.captureException(retryError, {
                                tags: { module: 'notifications', component: 'NotificationItem', action: 'archive_click_mark_read_retry', error_type: 'db_error' },
                                extra: { notification_id: notification.id, timestamp: new Date().toISOString() }
                              })
                              console.error('Повторная попытка отметить прочитанным в БД не удалась', {
                                notificationId: notification.id,
                                error: retryError,
                              })
                            })
                          }, 2000)
                        }
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
                {...createButtonHoverHandlers(archiveBtnRef, setIsArchiveButtonHovered)}
                className={cn(
                  "h-7 w-7 text-gray-500 hover:text-gray-700 pointer-events-auto",
                  // Реплика состояния :hover у ghost-кнопки
                  isArchiveButtonHovered && "bg-accent text-accent-foreground"
                )}
                aria-label="В архив"
                title="В архив"
              >
                <Archive className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              ref={archiveBtnRef}
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
              {...createButtonHoverHandlers(archiveBtnRef, setIsArchiveButtonHovered)}
              className={cn(
                "h-7 w-7 text-gray-500 hover:text-gray-700 pointer-events-auto",
                // Реплика состояния :hover у ghost-кнопки
                isArchiveButtonHovered && "bg-accent text-accent-foreground"
              )}
              aria-label="Вернуть из архива"
              title="Вернуть из архива"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {/* Первый уровень: иконка слева */}
      <div className="flex items-center mb-3">
        <Icon className={cn("h-4 w-4 flex-shrink-0", iconColor)} />
      </div>

      {/* Второй уровень: заголовок слева, тип уведомления справа */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
            {notification.title}
          </h4>
        </div>
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
