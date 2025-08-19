"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import * as Sentry from "@sentry/nextjs"
import { cn } from "@/lib/utils"
import { useNotificationsStore } from "@/stores/useNotificationsStore"
import { NotificationItem } from "./NotificationItem"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Search, Loader2, RefreshCw, Filter, ChevronDown, SlidersHorizontal, Check } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"

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
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'archived'>('all')
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false)
  const [isReadFilterOpen, setIsReadFilterOpen] = useState(false)
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
    clearAll 
  } = useNotificationsStore()

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
    setSearchQuery("")
    setSelectedTypes(new Set())
    setReadFilter('all')
  }, [])

  // Авто-прочтение отключено: больше не помечаем как прочитанные при появлении в зоне видимости

  // Закрытие панели при клике вне её
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      // Игнорируем клики по колокольчику, чтобы не было двойного toggle
      if (target && target.closest('[data-notifications-bell]')) {
        return
      }
      // Игнорируем клики по элементам фильтра (Popover)
      if (target && target.closest('[data-radix-popper-content-wrapper]')) {
        return
      }
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        console.log('🖱️ Клик вне панели - закрываем')
        handleClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [handleClose])

  // Обработка нажатия Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        console.log('⌨️ Нажата Escape - закрываем панель')
        handleClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [handleClose])

  // Фильтрация уведомлений по поисковому запросу и типам
  const filteredNotifications = notifications
    .filter((notification) => {
      // Фильтр по поисковому запросу
      const matchesSearch = 
        notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notification.message.toLowerCase().includes(searchQuery.toLowerCase())
      
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
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

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
  const hasActiveFilters = searchQuery || selectedTypes.size > 0 || readFilter !== 'all'

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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Поиск уведомлений..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
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

        {/* Действия */}
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Всего: {filteredNotifications.length}
                {hasActiveFilters && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400">
                    (из {notifications.length})
                  </span>
                )}
              </span>
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
                {hasActiveFilters ? "Уведомления по заданным фильтрам не найдены" : "Нет уведомлений"}
              </p>
              {hasActiveFilters && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                    className="px-4"
                  >
                    Сбросить фильтры
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
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
