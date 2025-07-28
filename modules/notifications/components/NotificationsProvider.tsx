"use client"

import { createContext, useContext, useEffect, ReactNode, useState, useCallback } from 'react'
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
    try {
      console.log('🔄 Обновляем модуль для типа:', entityType)
      
      switch (entityType) {
        case 'announcement':
        case 'announcements':
          console.log('📢 Обновляем модуль объявлений')
          await fetchAnnouncements()
          break
        
        case 'assignment':
        case 'assignments':
          console.log('📋 Обновляем модуль заданий')
          // Здесь можно добавить обновление модуля заданий
          // await fetchAssignments()
          break
        
        case 'task':
        case 'tasks':
          console.log('📝 Обновляем модуль задач')
          // Здесь можно добавить обновление модуля задач
          // await fetchTasks()
          break
        
        default:
          console.log('ℹ️ Неизвестный тип уведомления:', entityType)
          break
      }
    } catch (error) {
      console.error('❌ Ошибка при обновлении модуля:', error)
    }
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
    
    // Получаем текущего пользователя
    const getCurrentUser = async () => {
      console.log('🔍 NotificationsProvider: Получение текущего пользователя...')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        console.log('👤 NotificationsProvider: Пользователь найден:', user.id)
        setCurrentUserId(user.id)
      } else {
        console.warn('⚠️ NotificationsProvider: Пользователь не найден')
      }
    }

    getCurrentUser()
  }, [setCurrentUserId, mounted])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    
    const initializeProvider = async () => {
      if (currentUserId) {
        console.log('🚀 NotificationsProvider: Инициализация для пользователя:', currentUserId)
        
        // Загружаем существующие уведомления
        console.log('📥 NotificationsProvider: Загрузка уведомлений...')
        
        // Отладочная проверка базы данных
        const { debugUserNotifications } = await import('../api/notifications')
        await debugUserNotifications(currentUserId)
        
        fetchNotifications()
        
        // Инициализируем Realtime подписку
        console.log('📡 NotificationsProvider: Инициализация Realtime...')
        initializeRealtime()
      } else {
        console.log('⏳ NotificationsProvider: Ожидание currentUserId...')
      }
    }

    initializeProvider()

    // Отписываемся при размонтировании
    return () => {
      unsubscribeFromNotifications()
    }
  }, [currentUserId, fetchNotifications, initializeRealtime, unsubscribeFromNotifications, mounted])

  return <>{children}</>
}

// Экспортируем для использования в других компонентах
export default NotificationsProvider 