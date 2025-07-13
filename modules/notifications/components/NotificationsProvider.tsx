"use client"

import { createContext, useContext, useEffect, ReactNode, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useNotificationsStore } from '@/stores/useNotificationsStore'

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
    currentUserId,
  } = useNotificationsStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    
    // Получаем текущего пользователя
    const getCurrentUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setCurrentUserId(user.id)
      }
    }

    getCurrentUser()
  }, [setCurrentUserId, mounted])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    
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
  }, [currentUserId, fetchNotifications, initializeRealtime, unsubscribeFromNotifications, mounted])

  return <>{children}</>
}

// Экспортируем для использования в других компонентах
export default NotificationsProvider 