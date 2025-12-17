"use client"

import { useEffect, ReactNode, useCallback } from 'react'
import * as Sentry from "@sentry/nextjs"
import { useNotificationsUiStore } from '@/stores/useNotificationsUiStore'
import { useAnnouncements } from '@/modules/announcements/hooks/useAnnouncements'

interface NotificationsProviderProps {
  children: ReactNode
}

/**
 * NotificationsProvider - упрощённый провайдер для модуля уведомлений
 *
 * Теперь провайдер ТОЛЬКО управляет callback для обновления модулей.
 * Все остальное (данные, Realtime, пагинация) управляется через:
 * - TanStack Query (modules/notifications/hooks/use-notifications.ts)
 * - Cache Module Realtime (modules/cache/realtime/config.ts)
 */
export function NotificationsProvider({ children }: NotificationsProviderProps) {
  const { setModuleUpdateCallback } = useNotificationsUiStore()

  // Хуки для обновления модулей
  const { fetchAnnouncements } = useAnnouncements()

  // Функция для обновления модулей на основе типа уведомления
  const updateModuleByEntityType = useCallback(async (entityType: string) => {
    return Sentry.startSpan(
      {
        op: "notifications.update_module",
        name: "Update Module By Entity Type",
      },
      async (span) => {
        try {
          span.setAttribute("entity.type", entityType)
          console.log('🔄 Обновляем модуль для типа:', entityType)
          
          switch (entityType) {
            case 'announcement':
              span.setAttribute("module.name", "announcement")
              console.log('📢 Обновляем модуль объявлений')
              await fetchAnnouncements()
              span.setAttribute("update.success", true)
              break
            
            case 'assignment':
              span.setAttribute("module.name", "assignment")
              console.log('📋 Обновляем модуль заданий')
              // Здесь можно добавить обновление модуля заданий
              // await fetchAssignments()
              span.setAttribute("update.skipped", true)
              span.setAttribute("update.skip_reason", "not_implemented")
              break
            
            case 'task':
            case 'tasks':
              span.setAttribute("module.name", "tasks")
              console.log('📝 Обновляем модуль задач')
              // Здесь можно добавить обновление модуля задач
              // await fetchTasks()
              span.setAttribute("update.skipped", true)
              span.setAttribute("update.skip_reason", "not_implemented")
              break
            
            default:
              span.setAttribute("module.name", "unknown")
              span.setAttribute("update.skipped", true)
              span.setAttribute("update.skip_reason", "unknown_entity_type")
              console.log('ℹ️ Неизвестный тип уведомления:', entityType)
              break
          }
          
          Sentry.addBreadcrumb({
            message: 'Module updated based on notification entity type',
            category: 'notifications',
            level: 'info',
            data: {
              entity_type: entityType
            }
          })
        } catch (error) {
          span.setAttribute("update.success", false)
          span.recordException(error as Error)
          Sentry.captureException(error, {
            tags: {
              module: 'notifications',
              component: 'NotificationsProvider',
              action: 'update_module',
              error_type: 'unexpected_error'
            },
            extra: {
              entity_type: entityType,
              timestamp: new Date().toISOString()
            }
          })
          console.error('❌ Ошибка при обновлении модуля:', error)
        }
      }
    )
  }, [fetchAnnouncements]) // Добавляем зависимости для стабильности

  // Устанавливаем колбэк для обновления модулей при клике на уведомление
  useEffect(() => {
    setModuleUpdateCallback(updateModuleByEntityType)

    // Очищаем колбэк при размонтировании
    return () => {
      setModuleUpdateCallback(null)
    }
  }, [setModuleUpdateCallback, updateModuleByEntityType])

  return <>{children}</>
}

// Экспортируем для использования в других компонентах
export default NotificationsProvider 