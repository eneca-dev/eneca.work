"use client"

import { createContext, useContext, useEffect, ReactNode, useState, useCallback } from 'react'
import * as Sentry from "@sentry/nextjs"
import { createClient } from '@/utils/supabase/client'
import { useNotificationsStore } from '@/stores/useNotificationsStore'
import { useAnnouncements } from '@/modules/announcements/hooks/useAnnouncements'

interface NotificationsProviderProps {
  children: ReactNode
}

export function NotificationsProvider({ children }: NotificationsProviderProps) {
  const [mounted, setMounted] = useState(false)
  const {
    setCurrentUserId,
    fetchNotifications,
    initializeRealtime,
    unsubscribeFromNotifications,
    setModuleUpdateCallback,
    currentUserId,
  } = useNotificationsStore()

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
            case 'announcements':
              span.setAttribute("module.name", "announcements")
              console.log('📢 Обновляем модуль объявлений')
              await fetchAnnouncements()
              span.setAttribute("update.success", true)
              break
            
            case 'assignment':
            case 'assignments':
              span.setAttribute("module.name", "assignments")
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

  // Устанавливаем колбэк для обновления модулей
  useEffect(() => {
    setModuleUpdateCallback(updateModuleByEntityType)
    
    // Очищаем колбэк при размонтировании
    return () => {
      setModuleUpdateCallback(null)
    }
  }, [setModuleUpdateCallback, updateModuleByEntityType])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    
    const supabase = createClient()
    
    // Получаем текущего пользователя
    const getCurrentUser = async () => {
      return Sentry.startSpan(
        {
          op: "notifications.get_current_user",
          name: "Get Current User",
        },
        async (span) => {
          try {
            console.log('🔍 NotificationsProvider: Получение текущего пользователя...')
            const { data: { user }, error } = await supabase.auth.getUser()
            
            if (error) {
              span.setAttribute("auth.success", false)
              span.setAttribute("auth.error", error.message)
              Sentry.captureException(error, {
                tags: {
                  module: 'notifications',
                  component: 'NotificationsProvider',
                  action: 'get_current_user',
                  error_type: 'auth_error'
                },
                extra: {
                  timestamp: new Date().toISOString()
                }
              })
              console.error('❌ NotificationsProvider: Ошибка получения пользователя:', error)
              setCurrentUserId(null) // Очищаем при ошибке
              return
            }
            
            if (user) {
              span.setAttribute("auth.success", true)
              span.setAttribute("user.id", user.id)
              span.setAttribute("user.found", true)
              
              console.log('👤 NotificationsProvider: Пользователь найден:', user.id)
              setCurrentUserId(user.id)
              
              Sentry.addBreadcrumb({
                message: 'Current user retrieved successfully',
                category: 'notifications',
                level: 'info',
                data: {
                  user_id: user.id
                }
              })
            } else {
              span.setAttribute("auth.success", true)
              span.setAttribute("user.found", false)
              console.warn('⚠️ NotificationsProvider: Пользователь не найден')
              setCurrentUserId(null) // Очищаем если пользователя нет
            }
          } catch (error) {
            span.setAttribute("auth.success", false)
            span.recordException(error as Error)
            Sentry.captureException(error, {
              tags: {
                module: 'notifications',
                component: 'NotificationsProvider',
                action: 'get_current_user',
                error_type: 'unexpected_error'
              },
              extra: {
                timestamp: new Date().toISOString()
              }
            })
            console.error('❌ NotificationsProvider: Неожиданная ошибка при получении пользователя:', error)
            setCurrentUserId(null) // Очищаем при ошибке
          }
        }
      )
    }

    // Подписываемся на изменения аутентификации
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 NotificationsProvider: Auth state change:', event, session?.user?.id)
      
      if (event === 'SIGNED_OUT') {
        console.log('👋 NotificationsProvider: Пользователь вышел')
        setCurrentUserId(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const userId = session?.user?.id || null
        console.log('👤 NotificationsProvider: Пользователь вошел:', userId)
        setCurrentUserId(userId)
      } else if (event === 'USER_UPDATED') {
        const userId = session?.user?.id || null
        console.log('🔄 NotificationsProvider: Данные пользователя обновлены:', userId)
        setCurrentUserId(userId)
      }
    })

    // Получаем текущего пользователя при инициализации
    getCurrentUser()

    // Отписываемся при размонтировании
    return () => {
      subscription.unsubscribe()
    }
  }, [setCurrentUserId, mounted])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    
    const initializeProvider = async () => {
      if (currentUserId) {
        console.log('🚀 NotificationsProvider: Инициализация для пользователя:', currentUserId)
        
        // Загружаем существующие уведомления
        console.log('📥 NotificationsProvider: Загрузка уведомлений...')
        
        // Отладочная проверка базы данных
        const { debugUserNotifications, createTestNotification } = await import('../api/notifications')
        await debugUserNotifications(currentUserId)
        
        // Временно: создаем тестовое уведомление для диагностики
        // Раскомментируйте следующую строку если нужно создать тестовое уведомление:
        // await createTestNotification(currentUserId)
        
        fetchNotifications()
        
        // Инициализируем Realtime подписку
        console.log('📡 NotificationsProvider: Инициализация Realtime...')
        initializeRealtime()
      } else {
        console.log('⏳ NotificationsProvider: currentUserId не установлен, очищаем уведомления')
        // Если пользователя нет, отписываемся от всех подписок
        unsubscribeFromNotifications()
      }
    }

    initializeProvider()
  }, [currentUserId, fetchNotifications, initializeRealtime, unsubscribeFromNotifications, mounted])

  return <>{children}</>
}

// Экспортируем для использования в других компонентах
export default NotificationsProvider 