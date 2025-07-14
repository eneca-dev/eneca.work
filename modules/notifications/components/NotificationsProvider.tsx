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