import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createClient } from "@/utils/supabase/client"
import { RealtimeChannel } from "@supabase/supabase-js"
import React from "react"
import { 
  getUserNotifications, 
  getUnreadNotificationsCount, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  getRecentNotifications,
  UserNotificationWithNotification 
} from "@/modules/notifications/api/notifications"
import { 
  generateAssignmentNotificationText,
  generateAnnouncementNotificationText 
} from "@/types/notifications"

// Типы для работы с базой данных
export interface DatabaseNotification {
  id: string
  entity_type_id: string
  payload: Record<string, any>
  rendered_text: string | null
  created_at: string
  updated_at: string
}

export interface DatabaseUserNotification {
  id: string
  notification_id: string
  user_id: string
  is_read: boolean
  created_at: string
}

export interface DatabaseEntityType {
  id: string
  entity_name: string
}

// Расширенный тип уведомления для UI
export interface Notification {
  id: string // ID из user_notifications
  notificationId: string // ID из notifications
  title: string
  message: string
  createdAt: Date
  isRead: boolean
  type?: "info" | "warning" | "error" | "success"
  payload?: Record<string, any>
  entityType?: string
}

interface NotificationsState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  error: string | null
  realtimeChannel: RealtimeChannel | null
  currentUserId: string | null
  
  // Методы для работы с уведомлениями
  setNotifications: (notifications: Notification[]) => void
  addNotification: (notification: Notification) => void
  markAsRead: (userNotificationId: string) => void
  markAsReadInDB: (userNotificationId: string) => Promise<void>
  markAllAsRead: () => void
  markAllAsReadInDB: () => Promise<void>
  removeNotification: (id: string) => void
  clearAll: () => void
  
  // Методы для состояния
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setCurrentUserId: (userId: string | null) => void
  
  // Методы для Realtime
  initializeRealtime: () => void
  subscribeToNotifications: () => void
  unsubscribeFromNotifications: () => void
  
  // Методы для загрузки данных
  fetchNotifications: () => Promise<void>
  fetchUnreadCount: () => Promise<void>
  
  // Обработчик новых уведомлений из Realtime
  handleNewNotification: (userNotification: DatabaseUserNotification) => void
}

// Вспомогательная функция для преобразования данных из API в UI формат
const transformNotificationData = (un: UserNotificationWithNotification): Notification => {
  const notification = un.notifications
  const entityType = notification?.entity_types?.entity_name || 'unknown'
  
  // Извлекаем данные из payload
  const payload = notification?.payload || {}
  let title = 'Новое уведомление'
  let message = 'Нет описания'
  
  // Генерируем текст на лету в зависимости от типа уведомления
  if (entityType === 'assignment' && payload.assignment) {
    const generated = generateAssignmentNotificationText(payload.assignment)
    title = generated.title
    message = generated.message
  } else if (entityType === 'announcement') {
    // Проверяем, есть ли данные в payload.announcement или прямо в payload
    const announcementData = payload.announcement || {
      user_name: payload.user_name,
      title: payload.title,
      body: payload.body
    }
    
    if (announcementData.user_name && announcementData.title && announcementData.body) {
      const generated = generateAnnouncementNotificationText(announcementData)
      title = generated.title
      message = generated.message
    } else {
      // Fallback для объявлений
      title = payload.title || 'Новое объявление'
      message = payload.message || payload.body || 'Нет описания'
    }
  } else {
    // Для других типов используем payload или fallback
    title = payload.title || notification?.rendered_text || 'Новое уведомление'
    message = payload.message || payload.description || 'Нет описания'
  }
  
  return {
    id: un.id,
    notificationId: un.notification_id,
    title,
    message,
    createdAt: new Date(un.created_at),
    isRead: un.is_read,
    type: payload.type || 'info',
    payload: notification?.payload,
    entityType,
  }
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      // Начальное состояние
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      realtimeChannel: null,
      currentUserId: null,

      // Методы для работы с уведомлениями
      setNotifications: (notifications) => {
        const unreadCount = notifications.filter(n => !n.isRead).length
        set({ notifications, unreadCount })
      },

      addNotification: (notification) => {
        set((state) => {
          const newNotifications = [notification, ...state.notifications]
          const unreadCount = newNotifications.filter(n => !n.isRead).length
          return { notifications: newNotifications, unreadCount }
        })
      },

      markAsRead: (userNotificationId) => {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === userNotificationId)
          if (!notification || notification.isRead) return state

          const updatedNotifications = state.notifications.map((n) => 
            n.id === userNotificationId ? { ...n, isRead: true } : n
          )
          
          return {
            notifications: updatedNotifications,
            unreadCount: Math.max(0, state.unreadCount - 1),
          }
        })
      },

      markAsReadInDB: async (userNotificationId) => {
        try {
          const state = get()
          if (!state.currentUserId) return
          
          await markNotificationAsRead(state.currentUserId, userNotificationId)
        } catch (error) {
          console.error('Ошибка при обновлении статуса уведомления:', error)
          get().setError('Ошибка при обновлении статуса уведомления')
        }
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        }))
      },

      markAllAsReadInDB: async () => {
        try {
          const state = get()
          if (!state.currentUserId) return
          
          await markAllNotificationsAsRead(state.currentUserId)
          get().fetchUnreadCount() // Обновляем счетчик после обновления
        } catch (error) {
          console.error('Ошибка при обновлении статуса всех уведомлений:', error)
          get().setError('Ошибка при обновлении статуса всех уведомлений')
        }
      },

      removeNotification: (id) => {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id)
          const wasUnread = notification && !notification.isRead

          return {
            notifications: state.notifications.filter((n) => n.id !== id),
            unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
          }
        })
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 })
      },

      // Методы для состояния
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setCurrentUserId: (userId) => set({ currentUserId: userId }),

      // Методы для Realtime
      initializeRealtime: () => {
        const state = get()
        if (!state.currentUserId) {
          console.warn('Нет текущего пользователя для подписки на уведомления')
          return
        }
        
        state.subscribeToNotifications()
      },

      subscribeToNotifications: () => {
        const state = get()
        if (!state.currentUserId) return

        const supabase = createClient()
        
        // Отписываемся от предыдущего канала
        if (state.realtimeChannel) {
          state.realtimeChannel.unsubscribe()
        }

        // Создаем новый канал
        const channel = supabase
          .channel('realtime:user_notifications')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'user_notifications',
              filter: `user_id=eq.${state.currentUserId}`
            },
            (payload) => {
              console.log('Получено новое уведомление:', payload)
              state.handleNewNotification(payload.new as DatabaseUserNotification)
            }
          )
          .subscribe()

        set({ realtimeChannel: channel })
      },

      unsubscribeFromNotifications: () => {
        const state = get()
        if (state.realtimeChannel) {
          state.realtimeChannel.unsubscribe()
          set({ realtimeChannel: null })
        }
      },

      // Загрузка уведомлений
      fetchNotifications: async () => {
        const state = get()
        if (!state.currentUserId) return

        try {
          set({ isLoading: true, error: null })
          
          const { notifications: userNotifications } = await getUserNotifications(state.currentUserId)
          const unreadCount = await getUnreadNotificationsCount(state.currentUserId)

          // Преобразуем данные в формат UI
          const notifications: Notification[] = userNotifications.map(transformNotificationData)

          set({ notifications, unreadCount })
        } catch (error) {
          console.error('Ошибка при загрузке уведомлений:', error)
          set({ error: 'Ошибка при загрузке уведомлений' })
        } finally {
          set({ isLoading: false })
        }
      },

      fetchUnreadCount: async () => {
        const state = get()
        if (!state.currentUserId) return

        try {
          const unreadCount = await getUnreadNotificationsCount(state.currentUserId)
          set({ unreadCount })
        } catch (error) {
          console.error('Ошибка при получении количества непрочитанных уведомлений:', error)
          set({ error: 'Ошибка при получении количества непрочитанных уведомлений' })
        }
      },

      // Обработчик новых уведомлений из Realtime
      handleNewNotification: async (userNotification: DatabaseUserNotification) => {
        try {
          const supabase = createClient()
          
          // Получаем полную информацию о уведомлении
          const { data: fullNotification, error } = await supabase
            .from('user_notifications')
            .select(`
              id,
              notification_id,
              user_id,
              is_read,
              created_at,
              notifications (
                id,
                entity_type_id,
                payload,
                rendered_text,
                created_at,
                updated_at,
                entity_types (
                  id,
                  entity_name
                )
              )
            `)
            .eq('id', userNotification.id)
            .single()

          if (error || !fullNotification) {
            console.error('Ошибка при получении полной информации об уведомлении:', error)
            return
          }

          // Преобразуем в формат UI
          const newNotification = transformNotificationData(fullNotification as any)
          
          // Добавляем в store
          get().addNotification(newNotification)
          
        } catch (error) {
          console.error('Ошибка при обработке нового уведомления:', error)
        }
      },
    }),
    {
      name: "notifications-storage-v3",
      // Не сохраняем Realtime канал в локальном хранилище
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        currentUserId: state.currentUserId,
      }),
    },
  ),
)

// Хук для удобного использования
export const useNotifications = () => {
  const store = useNotificationsStore()
  
  // Автоматически инициализируем Realtime при первом использовании
  React.useEffect(() => {
    if (store.currentUserId && !store.realtimeChannel) {
      store.initializeRealtime()
    }
    
    return () => {
      store.unsubscribeFromNotifications()
    }
  }, [store.currentUserId])

  return store
}
