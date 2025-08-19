"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import * as Sentry from "@sentry/nextjs"
import { cn } from "@/lib/utils"
import { useNotificationsStore } from "@/stores/useNotificationsStore"
import { NotificationItem } from "./NotificationItem"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Search, Loader2, RefreshCw } from "lucide-react"

interface NotificationsPanelProps {
  // Переименовано для соответствия правилу сериализуемых пропсов в Next.js
  onCloseAction: () => void
  collapsed?: boolean
}

export function NotificationsPanel({ onCloseAction, collapsed = false }: NotificationsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [visibleNotifications, setVisibleNotifications] = useState<Set<string>>(new Set())
  const [processedNotifications, setProcessedNotifications] = useState<Set<string>>(new Set())
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const markAsReadRealtimeRef = useRef<((notificationId: string) => Promise<void>) | undefined>(undefined)
  const panelWidthPx = useNotificationsStore((s) => s.panelWidthPx)

  const { 
    notifications, 
    isLoading, 
    error, 
    fetchNotifications, 
    markAsRead,
    markAsReadInDB,
    clearAll 
  } = useNotificationsStore()

  // Функция для пометки уведомления как прочитанного в реальном времени
  const markNotificationAsReadRealtime = useCallback(async (notificationId: string) => {
    return Sentry.startSpan(
      {
        op: "notifications.mark_as_read_realtime",
        name: "Mark Notification As Read Realtime",
      },
      async (span) => {
        try {
          const notification = notifications.find(n => n.id === notificationId)
          
          span.setAttribute("notification.id", notificationId)
          span.setAttribute("notification.found", !!notification)
          span.setAttribute("notification.is_read", notification?.isRead || false)
          
          if (notification && !notification.isRead) {
            console.log('📖 Помечаем уведомление как прочитанное в реальном времени:', notificationId)
            
            // Сначала обновляем локальное состояние (счетчик уменьшится автоматически)
            markAsRead(notificationId)
            
            // Затем обновляем в базе данных
            try {
              await markAsReadInDB(notificationId)
              span.setAttribute("mark.success", true)
              
              Sentry.addBreadcrumb({
                message: 'Notification marked as read in realtime',
                category: 'notifications',
                level: 'info',
                data: {
                  notification_id: notificationId,
                  entity_type: notification.entityType
                }
              })
            } catch (error) {
              span.setAttribute("mark.success", false)
              span.recordException(error as Error)
              Sentry.captureException(error, {
                tags: {
                  module: 'notifications',
                  component: 'NotificationsPanel',
                  action: 'mark_as_read_realtime',
                  error_type: 'db_error'
                },
                extra: {
                  notification_id: notificationId,
                  notification_entity_type: notification.entityType,
                  timestamp: new Date().toISOString()
                }
              })
              console.error(`❌ Ошибка при пометке уведомления ${notificationId} как прочитанного в БД:`, error)
            }
          } else {
            span.setAttribute("mark.skipped", true)
            span.setAttribute("mark.skip_reason", notification ? "already_read" : "not_found")
          }
        } catch (error) {
          span.setAttribute("mark.success", false)
          span.recordException(error as Error)
          Sentry.captureException(error, {
            tags: {
              module: 'notifications',
              component: 'NotificationsPanel',
              action: 'mark_as_read_realtime',
              error_type: 'unexpected_error'
            },
            extra: {
              notification_id: notificationId,
              timestamp: new Date().toISOString()
            }
          })
          console.error('Ошибка в markNotificationAsReadRealtime:', error)
        }
      }
    )
  }, [notifications, markAsRead, markAsReadInDB])

  // Обновляем ref при изменении функции
  markAsReadRealtimeRef.current = markNotificationAsReadRealtime

  // Функция для закрытия панели
  const handleClose = useCallback(() => {
    console.log('🔒 Закрываем панель уведомлений')
    
    // Очищаем состояние
    setVisibleNotifications(new Set())
    setProcessedNotifications(new Set())
    onCloseAction()
  }, [onCloseAction])

  // Intersection Observer для отслеживания видимых уведомлений
  useEffect(() => {
    try {
      if (!scrollRef.current) return

      console.log('👀 Инициализируем Intersection Observer для', notifications.length, 'уведомлений')

      Sentry.addBreadcrumb({
        message: 'Initializing Intersection Observer',
        category: 'notifications',
        level: 'info',
        data: {
          notifications_count: notifications.length,
          processed_count: processedNotifications.size
        }
      })

      const observer = new IntersectionObserver(
        (entries) => {
          try {
            entries.forEach((entry) => {
              const notificationId = entry.target.getAttribute('data-notification-id')
              if (notificationId && entry.isIntersecting) {
                console.log(`👁️ Уведомление ${notificationId} стало видимым`)
                
                // Добавляем в видимые
                setVisibleNotifications(prev => new Set(prev).add(notificationId))
                
                // Помечаем как прочитанное, если еще не обработано
                if (!processedNotifications.has(notificationId)) {
                  const notification = notifications.find(n => n.id === notificationId)
                  if (notification && !notification.isRead) {
                    if (markAsReadRealtimeRef.current) {
                      markAsReadRealtimeRef.current(notificationId)
                    }
                    setProcessedNotifications(prev => new Set(prev).add(notificationId))
                  }
                }
              }
            })
          } catch (error) {
            Sentry.captureException(error, {
              tags: {
                module: 'notifications',
                component: 'NotificationsPanel',
                action: 'intersection_observer_callback',
                error_type: 'unexpected_error'
              },
              extra: {
                entries_count: entries.length,
                timestamp: new Date().toISOString()
              }
            })
            console.error('Ошибка в Intersection Observer callback:', error)
          }
        },
        {
          root: scrollRef.current,
          threshold: 0.5 // Считаем видимым, когда 50% элемента видно
        }
      )

      // Наблюдаем за всеми элементами уведомлений
      const notificationElements = scrollRef.current.querySelectorAll('[data-notification-id]')
      console.log('🔍 Найдено элементов уведомлений для отслеживания:', notificationElements.length)
      
      Sentry.addBreadcrumb({
        message: 'Starting observation of notification elements',
        category: 'notifications',
        level: 'info',
        data: {
          elements_count: notificationElements.length
        }
      })
      
      notificationElements.forEach(element => observer.observe(element))

      return () => {
        try {
          observer.disconnect()
        } catch (error) {
          Sentry.captureException(error, {
            tags: {
              module: 'notifications',
              component: 'NotificationsPanel',
              action: 'intersection_observer_cleanup',
              error_type: 'unexpected_error'
            },
            extra: {
              timestamp: new Date().toISOString()
            }
          })
          console.error('Ошибка при отключении Intersection Observer:', error)
        }
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          module: 'notifications',
          component: 'NotificationsPanel',
          action: 'intersection_observer_init',
          error_type: 'unexpected_error'
        },
        extra: {
          notifications_count: notifications.length,
          processed_count: processedNotifications.size,
          timestamp: new Date().toISOString()
        }
      })
      console.error('Ошибка при инициализации Intersection Observer:', error)
    }
  }, [notifications, processedNotifications])

  // Закрытие панели при клике вне её
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      // Игнорируем клики по колокольчику, чтобы не было двойного toggle
      if (target && target.closest('[data-notifications-bell]')) {
        return
      }
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        console.log('🖱️ Клик вне панели - закрываем')
        handleClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [handleClose])

  // Обработка нажатия Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        console.log('⌨️ Нажата Escape - закрываем панель')
        handleClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [handleClose])

  // Фильтрация уведомлений по поисковому запросу
  const filteredNotifications = notifications
    .filter(
      (notification) =>
        notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notification.message.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Обновление уведомлений
  const handleRefresh = async () => {
    return Sentry.startSpan(
      {
        op: "ui.click",
        name: "Refresh Notifications",
      },
      async (span) => {
        try {
          span.setAttribute("refresh.trigger", "manual")
          span.setAttribute("notifications.current_count", notifications.length)
          
          await fetchNotifications()
          
          span.setAttribute("refresh.success", true)
          
          Sentry.addBreadcrumb({
            message: 'Notifications refreshed manually',
            category: 'notifications',
            level: 'info',
            data: {
              trigger: 'manual',
              previous_count: notifications.length
            }
          })
        } catch (error) {
          span.setAttribute("refresh.success", false)
          span.recordException(error as Error)
          Sentry.captureException(error, {
            tags: {
              module: 'notifications',
              component: 'NotificationsPanel',
              action: 'refresh',
              error_type: 'unexpected_error'
            },
            extra: {
              trigger: 'manual',
              current_count: notifications.length,
              timestamp: new Date().toISOString()
            }
          })
          console.error('Ошибка при обновлении уведомлений:', error)
        }
      }
    )
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        // Фиксированная панель на всю высоту экрана, располагается сразу справа от сайдбара
        "fixed inset-y-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg z-30",
      )}
      style={{ width: panelWidthPx, left: collapsed ? 80 : 256 }}
    >
      {/* Контент панели: header + scrollable list, full height */}
      <div className="flex h-full flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Уведомления
          </h3>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-6 w-6"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-6 w-6">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Поиск */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Поиск уведомлений..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Действия */}
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Всего: {filteredNotifications.length}
              </span>
            </div>
          </div>
        )}

        {/* Список уведомлений */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Загрузка...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500 dark:text-red-400">
              <p className="text-sm">Ошибка загрузки уведомлений</p>
              <p className="text-xs mt-1 text-gray-500">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="mt-3"
              >
                Попробовать снова
              </Button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              {searchQuery ? "Уведомления не найдены" : "Нет уведомлений"}
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {filteredNotifications.map((notification) => (
                <NotificationItem 
                  key={notification.id} 
                  notification={notification} 
                  isVisible={visibleNotifications.has(notification.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
