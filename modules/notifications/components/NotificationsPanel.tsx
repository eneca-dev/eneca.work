"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import * as Sentry from "@sentry/nextjs"
import { cn } from "@/lib/utils"
import { useNotificationsStore } from "@/stores/useNotificationsStore"
import { NotificationItem } from "./NotificationItem"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Search, Loader2, RefreshCw, Filter, ChevronDown, SlidersHorizontal, Check, Megaphone } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/modals"
import { AnnouncementForm } from "@/modules/announcements/components/AnnouncementForm"
import { useAnnouncements } from "@/modules/announcements/hooks/useAnnouncements"
import { useAnnouncementsPermissions } from "@/modules/permissions/hooks/usePermissions"
import { useAnnouncementsStore } from "@/modules/announcements/store"

interface NotificationsPanelProps {
  // Переименовано для соответствия правилу сериализуемых пропсов в Next.js
  onCloseAction: () => void
  collapsed?: boolean
}

// Доступные типы уведомлений
const NOTIFICATION_TYPES = [
  { value: 'announcement', label: 'Объявления', color: 'bg-purple-100 text-purple-800 dark:bg-purple-800/20 dark:text-purple-200' },
  { value: 'assignments', label: 'Передача заданий', color: 'bg-orange-100 text-orange-800 dark:bg-orange-800/20 dark:text-orange-200' },
  { value: 'section_comment', label: 'Комментарии', color: 'bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-200' },
  { value: 'task', label: 'Задачи', color: 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-200' },
]

export function NotificationsPanel({ onCloseAction, collapsed = false }: NotificationsPanelProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState("")
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'archived'>('all')
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false)
  const [isReadFilterOpen, setIsReadFilterOpen] = useState(false)
  const [isAnnouncementFormOpen, setIsAnnouncementFormOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelWidthPx = useNotificationsStore((s) => s.panelWidthPx)

  const { 
    notifications, 
    isLoading, 
    error, 
    fetchNotifications, 
    markAsRead,
    markAsReadInDB,
    clearAll,
    // Поля для пагинации
    hasMore,
    isLoadingMore,
    loadMoreNotifications,
    // Поля для поиска
    searchQuery: storeSearchQuery,
    isSearchMode,
    searchNotifications,
    clearSearch,
    setSearchQuery
  } = useNotificationsStore()

  // Хуки для работы с объявлениями
  const { removeAnnouncement, fetchAnnouncements: fetchAnnouncementsData } = useAnnouncements()
  const { canCreate: canCreateAnnouncements } = useAnnouncementsPermissions()
  const { announcements } = useAnnouncementsStore()

  // Debounced поиск
  const debouncedSearchQuery = useMemo(() => {
    const timeoutId = setTimeout(() => {
      if (localSearchQuery !== storeSearchQuery) {
        if (localSearchQuery.trim()) {
          searchNotifications(localSearchQuery)
        } else {
          clearSearch()
        }
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [localSearchQuery, storeSearchQuery, searchNotifications, clearSearch])

  useEffect(() => {
    return debouncedSearchQuery
  }, [debouncedSearchQuery])

  // Функция для закрытия панели
  const handleClose = useCallback(() => {
    console.log('🔒 Закрываем панель уведомлений')
    
    // Очищаем состояние фильтров
    setSelectedTypes(new Set())
    setReadFilter('all')
    onCloseAction()
  }, [onCloseAction])

  // Обработка изменения фильтра по типам
  const handleTypeFilterChange = useCallback((type: string, checked: boolean) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(type)
      } else {
        newSet.delete(type)
      }
      return newSet
    })
  }, [])

  // Сброс всех фильтров
  const handleClearFilters = useCallback(() => {
    setLocalSearchQuery("")
    setSelectedTypes(new Set())
    setReadFilter('all')
    clearSearch() // Очищаем серверный поиск
  }, [clearSearch])

  // Обработчики для модального окна создания объявлений
  const handleCreateAnnouncement = useCallback(() => {
    setEditingAnnouncement(null)
    setIsAnnouncementFormOpen(true)
  }, [])

  const handleEditAnnouncement = useCallback(async (announcementId: string) => {
    try {
      // Сначала попробуем найти объявление в локальном store
      let announcement = announcements.find(a => a.id === announcementId)
      
      // Если не найдено в store, попробуем загрузить все объявления
      if (!announcement) {
        await fetchAnnouncementsData()
        announcement = announcements.find(a => a.id === announcementId)
      }
      
      if (announcement) {
        setEditingAnnouncement(announcement)
        setIsAnnouncementFormOpen(true)
      } else {
        console.error('Объявление не найдено:', announcementId)
      }
    } catch (error) {
      console.error('Ошибка при загрузке объявления:', error)
    }
  }, [announcements, fetchAnnouncementsData])

  const handleCloseAnnouncementForm = useCallback(() => {
    setIsAnnouncementFormOpen(false)
    setEditingAnnouncement(null)
  }, [])

  // Обработка прокрутки для бесконечной загрузки (отключаем в режиме поиска)
  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement || isSearchMode) return // Отключаем пагинацию в режиме поиска

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200 // Загружаем за 200px до конца

      if (isNearBottom && hasMore && !isLoadingMore && !isLoading) {
        console.log('📜 Достигнут конец списка, загружаем дополнительные уведомления')
        loadMoreNotifications()
      }
    }

    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollElement.removeEventListener('scroll', handleScroll)
  }, [hasMore, isLoadingMore, isLoading, loadMoreNotifications, isSearchMode])

  // Авто-прочтение отключено: больше не помечаем как прочитанные при появлении в зоне видимости

  // Закрытие панели при клике вне её
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Не закрываем панель, если открыто модальное окно создания объявлений
      if (isAnnouncementFormOpen) {
        return
      }
      
      const target = event.target as HTMLElement | null
      // Игнорируем клики по колокольчику, чтобы не было двойного toggle
      if (target && target.closest('[data-notifications-bell]')) {
        return
      }
      // Игнорируем клики по элементам фильтра (Popover)
      if (target && target.closest('[data-radix-popper-content-wrapper]')) {
        return
      }
      // Игнорируем клики в модальном окне создания объявлений
      if (target && target.closest('[role="dialog"]')) {
        return
      }
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        console.log('🖱️ Клик вне панели - закрываем')
        handleClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [handleClose, isAnnouncementFormOpen])

  // Обработка нажатия Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        // Если открыто модальное окно, не закрываем панель (модальное окно само обработает Escape)
        if (isAnnouncementFormOpen) {
          return
        }
        console.log('⌨️ Нажата Escape - закрываем панель')
        handleClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [handleClose, isAnnouncementFormOpen])

  // Фильтрация уведомлений
  const filteredNotifications = useMemo(() => {
    // В режиме поиска показываем результаты как есть (поиск уже выполнен на сервере)
    if (isSearchMode) {
      return notifications.filter((notification) => {
        // Применяем только клиентские фильтры (типы и статус)
        const matchesType = selectedTypes.size === 0 || 
          (notification.entityType && selectedTypes.has(notification.entityType))
        
        let matchesRead = true
        if (readFilter === 'unread') {
          matchesRead = !notification.isRead && !Boolean((notification as any).isArchived)
        } else if (readFilter === 'archived') {
          matchesRead = Boolean((notification as any).isArchived)
        } else {
          matchesRead = !Boolean((notification as any).isArchived)
        }
        
        return matchesType && matchesRead
      })
    }

    // В обычном режиме применяем все фильтры
    return notifications.filter((notification) => {
      // Фильтр по поисковому запросу (только если не в режиме серверного поиска)
      const matchesSearch = 
        localSearchQuery === '' ||
        notification.title.toLowerCase().includes(localSearchQuery.toLowerCase()) ||
        notification.message.toLowerCase().includes(localSearchQuery.toLowerCase())
      
      // Фильтр по типам (если выбраны типы)
      const matchesType = selectedTypes.size === 0 || 
        (notification.entityType && selectedTypes.has(notification.entityType))
      
      // Фильтр по статусу прочтения/архиву
      let matchesRead = true
      if (readFilter === 'unread') {
        // Показываем только непрочитанные и незаархивированные
        matchesRead = !notification.isRead && !Boolean((notification as any).isArchived)
      } else if (readFilter === 'archived') {
        matchesRead = Boolean((notification as any).isArchived)
      } else {
        // В "Все" скрываем заархивированные
        matchesRead = !Boolean((notification as any).isArchived)
      }
      
      return matchesSearch && matchesType && matchesRead
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [notifications, localSearchQuery, selectedTypes, readFilter, isSearchMode])

  // Обновление уведомлений
  const handleRefresh = async () => {
    return Sentry.startSpan(
      {
        op: "ui.click",
        name: "Refresh Notifications",
      },
      async (span) => {
        try {
          span.setAttribute("refresh.trigger", "manual")
          span.setAttribute("notifications.current_count", notifications.length)
          
          await fetchNotifications()
          
          span.setAttribute("refresh.success", true)
          
          Sentry.addBreadcrumb({
            message: 'Notifications refreshed manually',
            category: 'notifications',
            level: 'info',
            data: {
              trigger: 'manual',
              previous_count: notifications.length
            }
          })
        } catch (error) {
          span.setAttribute("refresh.success", false)
          span.recordException(error as Error)
          Sentry.captureException(error, {
            tags: {
              module: 'notifications',
              component: 'NotificationsPanel',
              action: 'refresh',
              error_type: 'unexpected_error'
            },
            extra: {
              trigger: 'manual',
              current_count: notifications.length,
              timestamp: new Date().toISOString()
            }
          })
          console.error('Ошибка при обновлении уведомлений:', error)
        }
      }
    )
  }

  // Проверяем, есть ли активные фильтры
  const hasActiveFilters = localSearchQuery || selectedTypes.size > 0 || readFilter !== 'all' || isSearchMode

  return (
    <div
      ref={panelRef}
      className={cn(
        // Фиксированная панель на всю высоту экрана, располагается сразу справа от сайдбара
        "fixed inset-y-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg z-30",
      )}
      style={{ width: panelWidthPx, left: collapsed ? 80 : 256 }}
    >
      {/* Контент панели: header + scrollable list, full height */}
      <div className="flex h-full flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Уведомления
          </h3>
          <div className="flex items-center gap-2">
            {/* Кнопка создания объявлений */}
            {canCreateAnnouncements && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleCreateAnnouncement}
                className="h-6 w-6"
                title="Создать объявление"
              >
                <Megaphone className="h-4 w-4" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-6 w-6"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-6 w-6">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Поиск и фильтры */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {/* Поиск */}
            <div className="relative flex-1">
              <Search className={cn(
                "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4",
                isSearchMode ? "text-blue-500" : "text-gray-400"
              )} />
              <Input
                placeholder={isSearchMode ? "Поиск по всем уведомлениям..." : "Поиск уведомлений..."}
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                className={cn(
                  "pl-10",
                  isSearchMode && "border-blue-300 ring-1 ring-blue-200"
                )}
              />
              {isSearchMode && (
                <button
                  onClick={() => {
                    setLocalSearchQuery("")
                    clearSearch()
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Очистить поиск"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* Фильтр по статусу (иконка-меню) */}
            <Popover open={isReadFilterOpen} onOpenChange={setIsReadFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "relative h-10 w-10",
                    readFilter !== 'all' && "text-blue-600 border-blue-300 dark:text-blue-400"
                  )}
                  aria-label="Фильтр уведомлений"
                  title="Фильтр уведомлений"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="end">
                <div className="flex flex-col">
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn("justify-start gap-2", readFilter === 'all' && "bg-gray-100 dark:bg-gray-800")}
                    onClick={() => { setReadFilter('all'); setIsReadFilterOpen(false) }}
                  >
                    {readFilter === 'all' && <Check className="h-4 w-4" />} Все
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("justify-start gap-2", readFilter === 'unread' && "bg-gray-100 dark:bg-gray-800")}
                    onClick={() => { setReadFilter('unread'); setIsReadFilterOpen(false) }}
                  >
                    {readFilter === 'unread' && <Check className="h-4 w-4" />} Непрочитанное
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("justify-start gap-2", readFilter === 'archived' && "bg-gray-100 dark:bg-gray-800")}
                    onClick={() => { setReadFilter('archived'); setIsReadFilterOpen(false) }}
                  >
                    {readFilter === 'archived' && <Check className="h-4 w-4" />} Архив
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Фильтр по типам */}
            <Popover open={isTypeFilterOpen} onOpenChange={setIsTypeFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="relative h-10 w-10"
                >
                  <Filter className="h-4 w-4" />
                  {/* Счетчик выбранных типов */}
                  {selectedTypes.size > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center bg-blue-600 text-white"
                    >
                      {selectedTypes.size}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <div className="p-3">
                  {/* Заголовок с кнопкой сброса */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Типы уведомлений
                    </span>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearFilters}
                        className="h-6 px-2 text-xs"
                      >
                        Сбросить
                      </Button>
                    )}
                  </div>
                  
                  {/* Список типов */}
                  <div className="space-y-2">
                    {NOTIFICATION_TYPES.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={type.value}
                          checked={selectedTypes.has(type.value)}
                          onCheckedChange={(checked) => 
                            handleTypeFilterChange(type.value, checked as boolean)
                          }
                        />
                        <label
                          htmlFor={type.value}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                        >
                          {type.label}
                        </label>
                        <Badge 
                          variant="secondary" 
                          className={cn("text-xs", type.color)}
                        >
                          {notifications.filter(n => n.entityType === type.value).length}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Информация о поиске */}
        {isSearchMode && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-700 dark:text-blue-300">
                Поиск: "{storeSearchQuery}" • Найдено: {filteredNotifications.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLocalSearchQuery("")
                  clearSearch()
                }}
                className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
              >
                Очистить
              </Button>
            </div>
          </div>
        )}

        {/* Список уведомлений */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Загрузка...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500 dark:text-red-400">
              <p className="text-sm">Ошибка загрузки уведомлений</p>
              <p className="text-xs mt-1 text-gray-500">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="mt-3"
              >
                Попробовать снова
              </Button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p className="mb-4">
                {isSearchMode 
                  ? `Уведомления по запросу "${storeSearchQuery}" не найдены`
                  : hasActiveFilters 
                    ? "Уведомления по заданным фильтрам не найдены" 
                    : "Нет уведомлений"
                }
              </p>
              {(hasActiveFilters || isSearchMode) && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={isSearchMode ? () => {
                      setLocalSearchQuery("")
                      clearSearch()
                    } : handleClearFilters}
                    className="px-4"
                  >
                    {isSearchMode ? "Очистить поиск" : "Сбросить фильтры"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {filteredNotifications.map((notification) => (
                <NotificationItem 
                  key={notification.id} 
                  notification={notification}
                  onEditAnnouncement={handleEditAnnouncement}
                />
              ))}
              
              {/* Индикатор загрузки дополнительных уведомлений (только не в режиме поиска) */}
              {!isSearchMode && isLoadingMore && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Загрузка...</span>
                </div>
              )}
              
              {/* Сообщение о том, что все уведомления загружены (только не в режиме поиска) */}
              {!isSearchMode && !hasMore && filteredNotifications.length > 0 && (
                <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                  Все уведомления загружены
                </div>
              )}
              
              {/* Информация в режиме поиска */}
              {isSearchMode && filteredNotifications.length > 0 && (
                <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                  Показаны все найденные уведомления
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно создания/редактирования объявлений */}
      <Modal 
        isOpen={isAnnouncementFormOpen} 
        onClose={handleCloseAnnouncementForm} 
        size="lg"
        closeOnOverlayClick={false}
      >
        <Modal.Header 
          title={editingAnnouncement ? "Редактировать объявление" : "Создать объявление"} 
          onClose={handleCloseAnnouncementForm} 
        />
        <Modal.Body>
          <div onClick={(e) => e.stopPropagation()}>
            <AnnouncementForm 
              onClose={handleCloseAnnouncementForm}
              editingAnnouncement={editingAnnouncement}
              onDelete={removeAnnouncement}
            />
          </div>
        </Modal.Body>
      </Modal>
    </div>
  )
}
