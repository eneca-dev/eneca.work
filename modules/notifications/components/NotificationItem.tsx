"use client"

import type React from "react"
import { useEffect, useRef, useCallback } from "react"

import { formatDistanceToNow } from "date-fns"
import { ru } from "date-fns/locale"
import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react"
import { Notification } from "@/stores/useNotificationsStore"
import { useNotificationsStore } from "@/stores/useNotificationsStore"
import { cn } from "@/lib/utils"

interface NotificationItemProps {
  notification: Notification
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

export function NotificationItem({ notification }: NotificationItemProps) {
  const Icon = typeIcons[notification.type || "info"]
  const iconColor = typeColors[notification.type || "info"]
  const elementRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const hasBeenMarkedAsRead = useRef(false)

  const { markAsRead, markAsReadInDB } = useNotificationsStore()

  // Функция для пометки уведомления как прочитанного
  const handleMarkAsRead = useCallback(async () => {
    if (notification.isRead || hasBeenMarkedAsRead.current) return

    hasBeenMarkedAsRead.current = true
    
    try {
      // Сначала обновляем локальное состояние
      markAsRead(notification.id)
      
      // Затем обновляем в базе данных
      await markAsReadInDB(notification.id)
      
      console.log(`Уведомление ${notification.id} помечено как прочитанное`)
    } catch (error) {
      console.error('Ошибка при пометке уведомления как прочитанного:', error)
      // Откатываем изменения при ошибке
      hasBeenMarkedAsRead.current = false
    }
  }, [notification.id, notification.isRead, markAsRead, markAsReadInDB])

  // Инициализация Intersection Observer
  useEffect(() => {
    if (notification.isRead || !elementRef.current) return

    // Создаем наблюдатель с порогом 50%
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasBeenMarkedAsRead.current) {
          console.log(`Уведомление ${notification.id} стало видимым`)
          handleMarkAsRead()
          
          // Прекращаем наблюдение после первого срабатывания
          if (observerRef.current && entry.target) {
            observerRef.current.unobserve(entry.target)
          }
        }
      },
      { 
        threshold: 0.5, // Срабатывает когда 50% элемента становится видимым
        rootMargin: '0px 0px -50px 0px' // Дополнительный отступ снизу
      }
    )

    // Начинаем наблюдение
    observerRef.current.observe(elementRef.current)

    // Очистка при размонтировании
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [notification.id, notification.isRead, handleMarkAsRead])

  // Очистка observer при изменении статуса прочтения
  useEffect(() => {
    if (notification.isRead && observerRef.current) {
      observerRef.current.disconnect()
    }
  }, [notification.isRead])

  return (
    <div
      ref={elementRef}
      data-notification-id={notification.id}
      className={cn(
        "relative p-3 rounded-lg border transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50",
        notification.isRead
          ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
          : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", iconColor)} />

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
            {notification.title}
          </h4>

          <p className="text-xs mt-1 line-clamp-2 text-gray-600 dark:text-gray-400">
            {notification.message}
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            {formatDistanceToNow(notification.createdAt, {
              addSuffix: true,
              locale: ru,
            })}
          </p>
        </div>
      </div>

      {!notification.isRead && (
        <div className="absolute top-3 right-3 h-2 w-2 bg-blue-600 rounded-full"></div>
      )}
    </div>
  )
}
