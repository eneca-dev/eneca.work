"use client"

import { useState, useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNotificationsStore } from "@/stores"
import { NotificationsPanel } from "./NotificationsPanel"
import { cn } from "@/lib/utils"

interface NotificationBellProps {
  collapsed?: boolean
}

export function NotificationBell({ collapsed = false }: NotificationBellProps) {
  const isOpen = useNotificationsStore((s) => s.isPanelOpen)
  const togglePanel = useNotificationsStore((s) => s.togglePanel)
  const closePanel = useNotificationsStore((s) => s.closePanel)
  const [mounted, setMounted] = useState(false)
  const unreadCount = useNotificationsStore((state) => state.unreadCount)
  
  // Проверяем, что компонент полностью гидратировался
  useEffect(() => {
    try {
      setMounted(true)
      
      Sentry.addBreadcrumb({
        message: 'NotificationBell component mounted',
        category: 'notifications',
        level: 'info',
        data: { 
          collapsed,
          timestamp: new Date().toISOString()
        }
      })
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          module: 'notifications',
          component: 'NotificationBell',
          action: 'mount',
          error_type: 'unexpected_error'
        },
        extra: {
          collapsed,
          timestamp: new Date().toISOString()
        }
      })
      console.error('Ошибка при монтировании NotificationBell:', error)
    }
  }, [collapsed])

  // Показываем только после монтирования, чтобы избежать проблем с гидратацией
  const hasUnread = mounted && unreadCount > 0

  const handleBellClick = () => {
    return Sentry.startSpan(
      {
        op: "ui.click",
        name: "Notification Bell Click",
      },
      (span) => {
        try {
          const newIsOpen = !isOpen
          span.setAttribute("bell.was_open", isOpen)
          span.setAttribute("bell.now_open", newIsOpen)
          span.setAttribute("bell.unread_count", unreadCount)
          span.setAttribute("bell.has_unread", hasUnread)
          
          togglePanel()
          
          Sentry.addBreadcrumb({
            message: newIsOpen ? 'Notifications panel opened' : 'Notifications panel closed',
            category: 'notifications',
            level: 'info',
            data: {
              was_open: isOpen,
              now_open: newIsOpen,
              unread_count: unreadCount,
              has_unread: hasUnread
            }
          })
        } catch (error) {
          span.recordException(error as Error)
          Sentry.captureException(error, {
            tags: {
              module: 'notifications',
              component: 'NotificationBell',
              action: 'bell_click',
              error_type: 'unexpected_error'
            },
            extra: {
              was_open: isOpen,
              unread_count: unreadCount,
              has_unread: hasUnread,
              collapsed,
              timestamp: new Date().toISOString()
            }
          })
          console.error('Ошибка при клике на колокольчик уведомлений:', error)
        }
      }
    )
  }

  const handlePanelClose = () => {
    try {
      closePanel()
      
      Sentry.addBreadcrumb({
        message: 'Notifications panel closed',
        category: 'notifications',
        level: 'info',
        data: {
          close_method: 'panel_callback',
          unread_count: unreadCount
        }
      })
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          module: 'notifications',
          component: 'NotificationBell',
          action: 'panel_close',
          error_type: 'unexpected_error'
        },
        extra: {
          unread_count: unreadCount,
          collapsed,
          timestamp: new Date().toISOString()
        }
      })
      console.error('Ошибка при закрытии панели уведомлений:', error)
      // Все равно закрываем панель, даже если произошла ошибка
      closePanel()
    }
  }

  return (
    <div className="relative" data-notifications-bell>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "relative h-9 w-9 transition-colors",
          hasUnread && "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300",
        )}
        onClick={handleBellClick}
      >
        <Bell className={cn("h-4 w-4", hasUnread && "animate-pulse")} />
        {hasUnread && (
          <span
            className={cn(
              "absolute -top-1 left-[calc(100%-1rem)] h-5 rounded-full bg-red-600 text-xs font-medium text-white flex items-center justify-center",
              unreadCount > 99 ? "px-1 min-w-[2rem]" : "w-5"
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && <NotificationsPanel onCloseAction={handlePanelClose} collapsed={collapsed} />}
    </div>
  )
}
