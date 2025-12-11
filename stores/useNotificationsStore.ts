import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createClient } from "@/utils/supabase/client"
import { RealtimeChannel } from "@supabase/supabase-js"
import React from "react"
import { 
  getUserNotifications, 
  getUnreadNotificationsCount, 
  getRecentNotifications,
  UserNotificationWithNotification 
} from "@/modules/notifications/api/notifications"
import { 
  setUserNotificationArchived,
  getUserNotificationsByTypes
} from "@/modules/notifications/api/notifications"
import {
  transformNotificationData,
  type Notification
} from "@/modules/notifications/utils/transform"

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

interface NotificationsState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  error: string | null
  realtimeChannel: RealtimeChannel | null
  currentUserId: string | null
  // Состояние UI панели уведомлений
  isPanelOpen: boolean
  panelWidthPx: number
  // Наведение на уведомление (устойчивое к ремоунтам)
  hoveredNotificationId: string | null
  // Последняя позиция указателя внутри панели (для восстановления hover при ререндере)
  lastPointerPosition: { x: number, y: number } | null
  
  // Пагинация
  hasMore: boolean
  isLoadingMore: boolean
  currentPage: number
  // Режим серверной фильтрации по типам
  filterMode: 'none' | 'types'
  filterTypes: string[]
  
  // Поиск
  searchQuery: string
  isSearchMode: boolean
  allNotifications: Notification[] // Все уведомления для поиска
  
  // Колбэк для обновления модулей
  onModuleUpdate: ((entityType: string) => void) | null
  
  // Методы для работы с уведомлениями
  setNotifications: (notifications: Notification[]) => void
  addNotification: (notification: Notification) => void
  markAsRead: (userNotificationId: string) => void
  markAsUnread: (userNotificationId: string) => void
  markAsReadInDB: (userNotificationId: string) => Promise<void>
  markAsUnreadInDB: (userNotificationId: string) => Promise<void>
  setArchivedInDB: (userNotificationId: string, isArchived: boolean) => Promise<void>
  setNotificationArchived: (userNotificationId: string, isArchived: boolean) => void
  markAllAsRead: () => void
  markAllAsReadInDB: () => Promise<void>
  removeNotification: (id: string) => void
  clearAll: () => void
  
  // Методы для состояния
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setCurrentUserId: (userId: string | null) => void
  setModuleUpdateCallback: (callback: ((entityType: string) => void) | null) => void
  // Управление наведением
  setHoveredNotification: (id: string) => void
  clearHoveredNotification: () => void
  setPointerPosition: (pos: { x: number, y: number }) => void
  clearPointerPosition: () => void
  
  // Методы управления панелью уведомлений
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  setPanelWidth: (widthPx: number) => void
  
  // Методы для Realtime
  initializeRealtime: () => void
  subscribeToNotifications: () => void
  unsubscribeFromNotifications: () => void
  
  // Методы для загрузки данных
  fetchNotifications: () => Promise<void>
  fetchUnreadCount: () => Promise<void>
  loadMoreNotifications: () => Promise<void>
  resetPagination: () => void
  // Серверная фильтрация по типам
  setServerTypeFilter: (types: string[]) => Promise<void>
  clearServerFilters: () => void
  
  // Методы для поиска
  searchNotifications: (query: string) => Promise<void>
  clearSearch: () => void
  setSearchQuery: (query: string) => void
  
  // Диагностические методы
  debugStore: () => NotificationsState
  
  // Обработчик новых уведомлений из Realtime
  handleNewNotification: (userNotification: DatabaseUserNotification) => void

  // Синхронизация данных уведомлений с изменениями сущностей
  updateAnnouncementTitle: (announcementId: string, newTitle: string) => void
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
      onModuleUpdate: null, // Инициализируем колбэк
      isPanelOpen: false,
      panelWidthPx: 420,
      hoveredNotificationId: null,
      lastPointerPosition: null,
      
      // Пагинация
      hasMore: true,
      isLoadingMore: false,
      currentPage: 1,
      filterMode: 'none',
      filterTypes: [],
      
      // Поиск
      searchQuery: '',
      isSearchMode: false,
      allNotifications: [],

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

      markAsUnread: (userNotificationId) => {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === userNotificationId)
          if (!notification || !notification.isRead) return state

          const updatedNotifications = state.notifications.map((n) => 
            n.id === userNotificationId ? { ...n, isRead: false } : n
          )

          return {
            notifications: updatedNotifications,
            unreadCount: state.unreadCount + 1,
          }
        })
      },

      markAsReadInDB: async (userNotificationId) => {
        try {
          const state = get()
          
          console.log('🔄 markAsReadInDB вызвана:', {
            userNotificationId,
            currentUserId: state.currentUserId
          })
          
          if (!state.currentUserId) {
            console.warn('⚠️ currentUserId не установлен, пропускаем обновление БД')
            return
          }
          
          // await markNotificationAsRead(state.currentUserId, userNotificationId)
        } catch (error) {
          console.error('❌ Ошибка при обновлении статуса уведомления:', error)
          get().setError('Ошибка при обновлении статуса уведомления')
        }
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        }))
      },

      markAsUnreadInDB: async (userNotificationId) => {
        try {
          const state = get()
          if (!state.currentUserId) return
          // await markNotificationAsUnread(state.currentUserId, userNotificationId)
        } catch (error) {
          console.error('❌ Ошибка при отметке уведомления как непрочитанного:', error)
          get().setError('Ошибка при обновлении статуса уведомления')
        }
      },

      setArchivedInDB: async (userNotificationId, isArchived) => {
        try {
          const state = get()
          if (!state.currentUserId) return
          await setUserNotificationArchived(state.currentUserId, userNotificationId, isArchived)
        } catch (error) {
          console.error('❌ Ошибка при обновлении архива уведомления:', error)
          get().setError('Ошибка при обновлении архива уведомления')
        }
      },

      markAllAsReadInDB: async () => {
        try {
          const state = get()
          if (!state.currentUserId) return
          
          // await markAllNotificationsAsRead(state.currentUserId)
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

      // Локально обновляем заголовки уведомлений, связанных с объявлением
      updateAnnouncementTitle: (announcementId, newTitle) => {
        set((state) => {
          const updateList = (list: Notification[]) => list.map((n) => {
            if (n.entityType !== 'announcement') return n
            const payload = n.payload || {}
            const idFromPayload = payload.announcement_id || payload?.action?.data?.announcementId
            if (idFromPayload === announcementId) {
              return { ...n, title: newTitle }
            }
            return n
          })

          return {
            notifications: updateList(state.notifications),
            allNotifications: state.allNotifications && state.allNotifications.length > 0
              ? updateList(state.allNotifications)
              : state.allNotifications,
          }
        })
      },

      setNotificationArchived: (userNotificationId, isArchived) => {
        set((state) => {
          const updatedNotifications = state.notifications.map((n) => 
            n.id === userNotificationId ? { ...n, isArchived } : n
          )
          return { notifications: updatedNotifications }
        })
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 })
      },

      // Методы для состояния
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setCurrentUserId: (userId) => {
        const currentState = get()
        
        // Если пользователь изменился, очищаем все данные
        if (currentState.currentUserId !== userId) {
          console.log('👤 Смена пользователя:', {
            from: currentState.currentUserId,
            to: userId
          })
          
          // Отписываемся от текущих Realtime подписок
          if (currentState.realtimeChannel) {
            currentState.realtimeChannel.unsubscribe()
          }
          
          // Очищаем все данные уведомлений
          set({ 
            currentUserId: userId,
            notifications: [],
            unreadCount: 0,
            realtimeChannel: null,
            error: null,
            isLoading: false,
            // Сбрасываем пагинацию
            currentPage: 1,
            hasMore: true,
            isLoadingMore: false,
            // Сбрасываем поиск
            searchQuery: '',
            isSearchMode: false,
            allNotifications: []
          })
          
          // Если новый пользователь установлен, загружаем его данные
          if (userId) {
            // Инициализируем заново для нового пользователя
            setTimeout(() => {
              const newState = get()
              newState.fetchNotifications()
              newState.initializeRealtime()
            }, 100)
          }
        } else {
          // Если пользователь тот же, просто обновляем ID
          set({ currentUserId: userId })
        }
      },
      setModuleUpdateCallback: (callback) => set({ onModuleUpdate: callback }),
      
      // Методы для пагинации
      resetPagination: () => {
        set({ 
          currentPage: 1, 
          hasMore: true, 
          isLoadingMore: false 
        })
      },

      // Установка серверного фильтра по типам с загрузкой первой страницы
      setServerTypeFilter: async (types) => {
        const state = get()
        const requestUserId = state.currentUserId
        if (!requestUserId) {
          console.warn('⚠️ Нет currentUserId для фильтрации по типам')
          return
        }

        // Типы больше не требуют полной нормализации — выполняется только дедупликация
        const normalized = Array.from(new Set(types))

        // Сбрасываем состояние списка под новый фильтр
        set({
          isLoading: true,
          error: null,
          notifications: [],
          currentPage: 1,
          hasMore: true,
          isLoadingMore: false,
          filterMode: 'types',
          filterTypes: normalized,
        })

        try {
          const { notifications: userNotifications, hasMore } = await getUserNotificationsByTypes(
            requestUserId,
            normalized,
            1,
            10,
            { includeArchived: false }
          )

          // Проверяем актуальность запроса
          const currentState = get()
          if (currentState.currentUserId !== requestUserId) return

          const mapped = userNotifications.map(transformNotificationData)
          set({
            notifications: mapped,
            currentPage: 1,
            hasMore,
            isLoading: false,
            isLoadingMore: false,
          })
        } catch (error) {
          const currentState = get()
          if (currentState.currentUserId === requestUserId) {
            console.error('❌ Ошибка при загрузке уведомлений по типам:', error)
            set({ isLoading: false, isLoadingMore: false, error: 'Ошибка при загрузке уведомлений' })
          }
        }
      },

      // Очистка серверных фильтров и возврат к обычной пагинации
      clearServerFilters: () => {
        set({ filterMode: 'none', filterTypes: [], currentPage: 1, hasMore: true, isLoadingMore: false })
        get().fetchNotifications()
      },
      
      // Методы для поиска
      setSearchQuery: (query) => {
        set({ searchQuery: query })
      },
      
      searchNotifications: async (query) => {
        const state = get()
        const requestUserId = state.currentUserId
        
        if (!requestUserId) {
          console.warn('⚠️ Нет currentUserId для поиска уведомлений')
          return
        }

        const trimmedQuery = query.trim()
        console.log('🔍 Поиск уведомлений:', trimmedQuery)

        try {
          set({ 
            isLoading: state.allNotifications.length === 0, // Показываем загрузку только если еще не загружали все уведомления
            error: null, 
            searchQuery: trimmedQuery,
            isSearchMode: true
          })
          
          let allNotifications = state.allNotifications
          
          // Если у нас еще нет всех уведомлений, загружаем их
          if (allNotifications.length === 0) {
            console.log('📥 Загрузка всех уведомлений для поиска...')
            const allUserNotifications: UserNotificationWithNotification[] = []
            let currentPage = 1
            let hasMorePages = true
            
            while (hasMorePages) {
              const { notifications: pageNotifications, hasMore } = await getUserNotifications(
                requestUserId, 
                currentPage, 
                100 // Загружаем большими порциями
              )
              
              allUserNotifications.push(...pageNotifications)
              hasMorePages = hasMore
              currentPage++
              
              console.log(`📦 Загружена страница ${currentPage - 1}, получено ${pageNotifications.length} уведомлений, всего: ${allUserNotifications.length}`)
            }
            
            console.log(`✅ Загружено всего ${allUserNotifications.length} уведомлений для поиска`)
            
            // Проверяем, не изменился ли пользователь во время запроса
            const currentState = get()
            if (currentState.currentUserId !== requestUserId) {
              console.log('⚠️ Пользователь изменился во время поиска, отменяем обновление')
              return
            }

            // Преобразуем данные в формат UI
            allNotifications = allUserNotifications.map(transformNotificationData)
          } else {
            console.log('🔍 Используем уже загруженные уведомления для поиска')
          }
          
          // Фильтруем по поисковому запросу
          const filteredNotifications = trimmedQuery 
            ? allNotifications.filter(notification => 
                notification.title.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
                notification.message.toLowerCase().includes(trimmedQuery.toLowerCase())
              )
            : allNotifications
          
          console.log(`🔍 Найдено ${filteredNotifications.length} уведомлений по запросу "${trimmedQuery}"`)
          
          set({ 
            notifications: filteredNotifications,
            allNotifications: allNotifications, // Сохраняем все для дальнейшего поиска
            hasMore: false, // В режиме поиска пагинация отключена
            currentPage: 1,
            isLoadingMore: false
          })
          
          console.log('✅ Результаты поиска загружены')
        } catch (error) {
          const currentState = get()
          if (currentState.currentUserId === requestUserId) {
            console.error('❌ Ошибка при поиске уведомлений:', error)
            set({ error: 'Ошибка при поиске уведомлений' })
          }
        } finally {
          const currentState = get()
          if (currentState.currentUserId === requestUserId) {
            set({ isLoading: false })
          }
        }
      },
      
      clearSearch: () => {
        console.log('🧹 Очищаем поиск')
        set({ 
          searchQuery: '', 
          isSearchMode: false,
          allNotifications: [],
          currentPage: 1,
          hasMore: true,
          isLoadingMore: false
        })
        // Перезагружаем обычные уведомления
        get().fetchNotifications()
      },
      
      // Управление панелью
      openPanel: () => set({ isPanelOpen: true }),
      closePanel: () => set({ isPanelOpen: false }),
      togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
      setPanelWidth: (widthPx) => set({ panelWidthPx: Math.max(320, Math.min(720, Math.round(widthPx))) }),

      // Управление наведением
      setHoveredNotification: (id) => set({ hoveredNotificationId: id }),
      clearHoveredNotification: () => set({ hoveredNotificationId: null }),
      setPointerPosition: (pos) => set({ lastPointerPosition: pos }),
      clearPointerPosition: () => set({ lastPointerPosition: null }),

      // Методы для Realtime
      initializeRealtime: () => {
        const state = get()
        if (!state.currentUserId) {
          console.warn('NOTIFICATIONS Нет текущего пользователя для подписки на уведомления')
          return
        }
        
        state.subscribeToNotifications()
      },

      subscribeToNotifications: () => {
        const state = get()
        if (!state.currentUserId) {
          console.log('⚠️ NOTIFICATIONS Нет currentUserId для подписки на Realtime')
          return
        }

        const supabase = createClient()
        
        // Отписываемся от предыдущего канала
        if (state.realtimeChannel) {
          console.log('🔄 NOTIFICATIONS Отписываемся от предыдущего Realtime канала')
          state.realtimeChannel.unsubscribe()
        }

        console.log('📡 NOTIFICATIONS Подписываемся на Realtime для пользователя:', state.currentUserId)

        // Создаем новый канал
        const channel = supabase
          .channel(`realtime:user_notifications:${state.currentUserId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'user_notifications',
              filter: `user_id=eq.${state.currentUserId}`
            },
            (payload) => {
              console.log('📨 Получено новое уведомление:', payload)
              state.handleNewNotification(payload.new as DatabaseUserNotification)
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'user_notifications',
              filter: `user_id=eq.${state.currentUserId}`
            },
            (payload) => {
              console.log('🔄 Обновлено уведомление:', payload)
              // Можно добавить обработку обновлений уведомлений
            }
          )
          .subscribe((status) => {
            console.log('📡 NOTIFICATIONS Realtime статус подписки:', status)
          })

        set({ realtimeChannel: channel })
      },

      unsubscribeFromNotifications: () => {
        const state = get()
        if (state.realtimeChannel) {
          console.log('🔌 NOTIFICATIONS Отписываемся от Realtime уведомлений')
          state.realtimeChannel.unsubscribe()
          set({ realtimeChannel: null })
        }
      },

      // Загрузка уведомлений (первые 10)
      fetchNotifications: async () => {
        const state = get()
        const requestUserId = state.currentUserId
        console.log('🔄 Загрузка первых 10 уведомлений для пользователя:', requestUserId)
        
        if (!requestUserId) {
          console.warn('⚠️ Нет currentUserId для загрузки уведомлений')
          return
        }

        try {
          set({ isLoading: true, error: null })
          
          console.log('📥 Получение первых 10 уведомлений из базы данных...')
          const { notifications: userNotifications, hasMore } = await getUserNotifications(requestUserId, 1, 10)
          console.log('📦 Получено уведомлений из базы:', userNotifications?.length || 0, 'hasMore:', hasMore)
          
          // Проверяем, не изменился ли пользователь во время запроса
          const currentState = get()
          if (currentState.currentUserId !== requestUserId) {
            console.log('⚠️ Пользователь изменился во время загрузки, отменяем обновление')
            return
          }
          
          const unreadCount = await getUnreadNotificationsCount(requestUserId)
          console.log('📊 Количество непрочитанных:', unreadCount)

          // Еще раз проверяем, не изменился ли пользователь
          const finalState = get()
          if (finalState.currentUserId !== requestUserId) {
            console.log('⚠️ Пользователь изменился во время загрузки, отменяем обновление')
            return
          }

          // Преобразуем данные в формат UI
          const notifications: Notification[] = userNotifications.map(transformNotificationData)
          console.log('✨ Преобразованные уведомления:', notifications.length)
          
          if (notifications.length > 0) {
            console.log('✨ Первое преобразованное уведомление:', notifications[0])
            console.log('✨ Все преобразованные уведомления:', notifications)
          }

          set({ 
            notifications, 
            unreadCount,
            currentPage: 1,
            hasMore,
            isLoadingMore: false
          })
          console.log('✅ Первые 10 уведомлений успешно загружены в стор')
        } catch (error) {
          // Проверяем, актуален ли еще этот запрос
          const currentState = get()
          if (currentState.currentUserId === requestUserId) {
            console.error('❌ Ошибка при загрузке уведомлений:', error)
            set({ error: 'Ошибка при загрузке уведомлений' })
          } else {
            console.log('⚠️ Ошибка загрузки для устаревшего пользователя, игнорируем')
          }
        } finally {
          // Сбрасываем loading только если пользователь не изменился
          const currentState = get()
          if (currentState.currentUserId === requestUserId) {
            set({ isLoading: false })
          }
        }
      },

      // Загрузка дополнительных уведомлений
      loadMoreNotifications: async () => {
        const state = get()
        const requestUserId = state.currentUserId
        
        if (!requestUserId || !state.hasMore || state.isLoadingMore || state.isLoading) {
          console.log('🚫 Отменяем загрузку дополнительных уведомлений:', {
            hasUserId: !!requestUserId,
            hasMore: state.hasMore,
            isLoadingMore: state.isLoadingMore,
            isLoading: state.isLoading
          })
          return
        }

        const nextPage = state.currentPage + 1
        console.log('🔄 Загрузка дополнительных уведомлений, страница:', nextPage)

        try {
          set({ isLoadingMore: true, error: null })

          let result:
            | { notifications: UserNotificationWithNotification[]; hasMore: boolean }
            | null = null

          if (state.filterMode === 'types' && state.filterTypes.length > 0) {
            result = await getUserNotificationsByTypes(requestUserId, state.filterTypes, nextPage, 10, { includeArchived: false })
          } else {
            result = await getUserNotifications(requestUserId, nextPage, 10)
          }

          const { notifications: userNotifications, hasMore } = result
          console.log('📦 Получено дополнительных уведомлений:', userNotifications?.length || 0, 'hasMore:', hasMore)

          // Проверяем, не изменился ли пользователь во время запроса
          const currentState = get()
          if (currentState.currentUserId !== requestUserId) {
            console.log('⚠️ Пользователь изменился во время загрузки, отменяем обновление')
            return
          }

          const newNotifications: Notification[] = userNotifications.map(transformNotificationData)

          set((prevState) => ({
            notifications: [...prevState.notifications, ...newNotifications],
            currentPage: nextPage,
            hasMore,
            isLoadingMore: false
          }))

          console.log('✅ Дополнительные уведомления успешно загружены')
        } catch (error) {
          // Проверяем, актуален ли еще этот запрос
          const currentState = get()
          if (currentState.currentUserId === requestUserId) {
            console.error('❌ Ошибка при загрузке дополнительных уведомлений:', error)
            set({ error: 'Ошибка при загрузке дополнительных уведомлений' })
          } else {
            console.log('⚠️ Ошибка загрузки для устаревшего пользователя, игнорируем')
          }
        } finally {
          // Сбрасываем loading только если пользователь не изменился
          const currentState = get()
          if (currentState.currentUserId === requestUserId) {
            set({ isLoadingMore: false })
          }
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

      // Диагностическая функция для проверки состояния store
      debugStore: () => {
        const state = get()
        console.log('🔍 DEBUG Store состояние:', {
          currentUserId: state.currentUserId,
          notificationsCount: state.notifications.length,
          unreadCount: state.unreadCount,
          isLoading: state.isLoading,
          error: state.error,
          hasRealtimeChannel: !!state.realtimeChannel,
          isPanelOpen: state.isPanelOpen
        })
        return state
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

          // Вызываем колбэк для обновления модулей, если тип уведомления соответствует
          const state = get()
          if (state.onModuleUpdate && newNotification.entityType) {
            state.onModuleUpdate(newNotification.entityType)
          }
          
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
        // Сохраняем состояние пагинации
        currentPage: state.currentPage,
        hasMore: state.hasMore,
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
