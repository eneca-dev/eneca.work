"use client"

import { createContext, useContext, useEffect, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useNotificationsStore } from '@/stores/useNotificationsStore'

interface NotificationsProviderProps {
  children: ReactNode
}

export function NotificationsProvider({ children }: NotificationsProviderProps) {
  const {
    setCurrentUserId,
    fetchNotifications,
    initializeRealtime,
    unsubscribeFromNotifications,
    currentUserId,
  } = useNotificationsStore()

  useEffect(() => {
    // Получаем текущего пользователя
    const getCurrentUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setCurrentUserId(user.id)
      }
    }

    getCurrentUser()
  }, [setCurrentUserId])

  useEffect(() => {
    if (currentUserId) {
      // Загружаем существующие уведомления
      fetchNotifications()
      
      // Инициализируем Realtime подписку
      initializeRealtime()
    }

    // Отписываемся при размонтировании
    return () => {
      unsubscribeFromNotifications()
    }
  }, [currentUserId, fetchNotifications, initializeRealtime, unsubscribeFromNotifications])

  return <>{children}</>
}

// Экспортируем для использования в других компонентах
export default NotificationsProvider 