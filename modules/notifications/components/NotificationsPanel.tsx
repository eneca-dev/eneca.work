"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { throttle } from "@/utils/throttle"
import * as Sentry from "@sentry/nextjs"
import { cn } from "@/lib/utils"
import { useNotificationsUiStore } from "@/stores/useNotificationsUiStore"
import { NotificationItem } from "./NotificationItem"
import { Button } from "@/components/ui/button"
import { X, Loader2, RefreshCw, Filter, SlidersHorizontal, Check, Megaphone } from "lucide-react"
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
import { toast } from "@/components/ui/use-toast"
import { useUserStore } from "@/stores/useUserStore"
import {
  useNotificationsInfinite,
  useNotificationTypeCounts,
} from "../hooks/use-notifications"

interface NotificationsPanelProps {
  // Переименовано для соответствия правилу сериализуемых пропсов в Next.js
  onCloseAction: () => void
  collapsed?: boolean
}

// Доступные типы уведомлений
const NOTIFICATION_TYPES = [
  { value: 'announcement', label: 'Объявления', color: 'bg-purple-100 text-purple-800 dark:bg-purple-800/20 dark:text-purple-200' },
  { value: 'assignment', label: 'Передача заданий', color: 'bg-orange-100 text-orange-800 dark:bg-orange-800/20 dark:text-orange-200' },
  { value: 'section_comment', label: 'Комментарии', color: 'bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-200' },
  { value: 'task', label: 'Задачи', color: 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-200' },
]

// Нормализация типов больше не используется

export function NotificationsPanel({ onCloseAction, collapsed = false }: NotificationsPanelProps) {
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'archived'>('all')
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false)
  const [isReadFilterOpen, setIsReadFilterOpen] = useState(false)
  const [isAnnouncementFormOpen, setIsAnnouncementFormOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null)
  const [hasPanelBeenOpened, setHasPanelBeenOpened] = useState(false)
  const [isRefreshingOnOpen, setIsRefreshingOnOpen] = useState(false)
  // Дебаг-панель отключена
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Трекинг позиции указателя внутри панели для устойчивого hover
  const setPointerPosition = useNotificationsUiStore((s) => s.setPointerPosition)
  const clearPointerPosition = useNotificationsUiStore((s) => s.clearPointerPosition)
  const panelWidthPx = useNotificationsUiStore((s) => s.panelWidthPx)
  const allFilteredRef = useRef(0)
  const isMountedRef = useRef(true)

  // Мемоизированная троттлинговая функция (~60fps)
  const throttledSetPointerPosition = useMemo(() =>
    throttle((pos: { x: number; y: number }) => {
      setPointerPosition(pos.x, pos.y)
    }, 16)
  , [setPointerPosition])

  // Локальный индикатор ручного обновления по кнопке
  const [isManualRefreshing, setIsManualRefreshing] = useState(false)
  // Количество точек в анимации загрузки счетчиков типов (1..3)
  const [loadingDots, setLoadingDots] = useState(1)

  // Получаем текущего пользователя (currentUserId больше не в store)
  const userId = useUserStore((s) => s.id)

  // TanStack Query hooks для данных
  const {
    data: queryData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending: isLoading,
    error: queryError,
    refetch
  } = useNotificationsInfinite({
    userId: userId!,
    filters: {
      onlyUnread: readFilter === 'unread',
      includeArchived: readFilter === 'archived',
      types: selectedTypes.size > 0 ? Array.from(selectedTypes) : undefined,
    }
  }, { enabled: !!userId })

  // Преобразуем страницы в плоский массив
  const notifications = useMemo(() => queryData?.pages.flat() ?? [], [queryData])

  // Алиасы для совместимости
  const hasMore = hasNextPage
  const isLoadingMore = isFetchingNextPage
  const error = queryError?.message || null

  // Счётчики типов
  const { data: typeCounts = {}, isPending: isLoadingTypeCounts } = useNotificationTypeCounts({
    userId: userId!,
    options: { includeArchived: readFilter === 'archived' }
  }, { enabled: !!userId && isTypeFilterOpen })

  // Локальные состояния для клиентской пагинации при активных фильтрах
  // Клиентская предзагрузка не используется
  const [visibleFilteredCount, setVisibleFilteredCount] = useState(10)
  // Server-side filtering handles all filters now (types, read status, archived)
  // No client-side filtering needed
  const isClientFilterMode = false

  // Форматирование даты не используется (дебаг отключен)


  // Дедупликация уведомлений по id, чтобы избежать повторов
  const dedupedNotifications = useMemo(() => {
    const seen = new Set<string>()
    const result: typeof notifications = []
    for (const n of notifications) {
      const id = (n as any)?.id
      if (id && !seen.has(id)) {
        seen.add(id)
        result.push(n)
      }
    }
    return result
  }, [notifications])

  // Автодогрузка для клиентского фильтра по статусу (типов нет) больше не нужна.
  // Догрузка теперь обрабатывается единообразно обработчиком скролла ниже через hasMore.

  // Хуки для работы с объявлениями
  const { removeAnnouncement, fetchAnnouncements: fetchAnnouncementsData } = useAnnouncements()
  const { canManage: canManageAnnouncements } = useAnnouncementsPermissions()
  const { announcements } = useAnnouncementsStore()

  // Поиск временно отключен

  // Функция для закрытия панели
  const handleClose = useCallback(() => {
    console.log('🔒 Закрываем панель уведомлений')
    
    // Очищаем состояние фильтров
    setSelectedTypes(new Set())
    setReadFilter('all')
    onCloseAction()
  }, [onCloseAction])

  // Фоновая предзагрузка отключена вместе с поиском

  // Счётчики типов загружаются через TanStack Query hook выше

  // Анимация точек во время загрузки счетчиков типов
  useEffect(() => {
    if (!isTypeFilterOpen || !isLoadingTypeCounts) return
    // Сбрасываем при каждом запуске загрузки
    setLoadingDots(1)
    const id = setInterval(() => {
      setLoadingDots((prev) => (prev >= 3 ? 1 : prev + 1))
    }, 400)
    return () => clearInterval(id)
  }, [isTypeFilterOpen, isLoadingTypeCounts])

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
    setVisibleFilteredCount(10)
  }, [])

  // Сброс всех фильтров
  const handleClearFilters = useCallback(() => {
    setSelectedTypes(new Set())
    setReadFilter('all')
    setVisibleFilteredCount(10)
  }, [])

  // TanStack Query автоматически refetch при изменении selectedTypes через query key

  // Обработчики для модального окна создания объявлений
  const handleCreateAnnouncement = useCallback(() => {
    setEditingAnnouncement(null)
    setIsAnnouncementFormOpen(true)
  }, [])

  const handleEditAnnouncement = useCallback(async (announcementId: string) => {
    try {
      // Сначала ищем в локальном store
      let announcement = announcements.find((a: any) => a.id === announcementId)
      
      // Если не найдено, загружаем свежие данные
      if (!announcement) {
        await fetchAnnouncementsData()
        // После загрузки ищем в обновленном store
        const updatedAnnouncements = useAnnouncementsStore.getState().announcements
        announcement = updatedAnnouncements.find((a: any) => a.id === announcementId)
      }
      
      if (announcement) {
        setEditingAnnouncement(announcement)
        setIsAnnouncementFormOpen(true)
      } else {
        console.error('Объявление не найдено:', announcementId)
        toast({
          title: "Ошибка",
          description: "Не удалось найти объявление для редактирования",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Ошибка при загрузке объявления:', error)
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при загрузке объявления",
        variant: "destructive"
      })
    }
  }, [announcements, fetchAnnouncementsData])

  const handleCloseAnnouncementForm = useCallback(() => {
    setIsAnnouncementFormOpen(false)
    setEditingAnnouncement(null)
  }, [])

  // Обработка прокрутки для бесконечной загрузки
  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200

      if (isClientFilterMode) {
        if (isNearBottom) {
          const totalFiltered = allFilteredRef.current
          if (visibleFilteredCount < totalFiltered) {
            setVisibleFilteredCount((prev) => Math.min(prev + 10, totalFiltered))
          }
        }
        return
      }

      if (isNearBottom && hasMore && !isLoadingMore && !isLoading) {
        console.log('📜 Достигнут конец списка, загружаем дополнительные уведомления')
        fetchNextPage()
      }
    }

    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollElement.removeEventListener('scroll', handleScroll)
  }, [hasMore, isLoadingMore, isLoading, fetchNextPage, isClientFilterMode, visibleFilteredCount])

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
      // Игнорируем клики по переключателю темы
      if (target && (target.closest('[data-theme-toggle]') || (target as HTMLElement).hasAttribute('data-theme-toggle'))) {
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
      // Игнорируем клики по элементам, которые намеренно не должны закрывать панель (навигация с главной)
      if (target && target.closest('[data-keep-notifications-open]')) {
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

  // Отслеживание состояния монтирования компонента
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Очистка таймеров троттлинга при размонтировании, чтобы избежать утечек и устаревших обновлений
  useEffect(() => {
    return () => {
      throttledSetPointerPosition.cancel()
    }
  }, [throttledSetPointerPosition])

  // Эффект для обновления уведомлений при первом открытии панели
  useEffect(() => {
    // Проверяем условия для обновления уведомлений
    if (hasPanelBeenOpened || !userId) return

    console.log('🔄 Панель уведомлений открыта впервые - обновляем уведомления')
    setHasPanelBeenOpened(true)
    setIsRefreshingOnOpen(true)

    // Запускаем обновление уведомлений
    refetch()
      .then(() => {
        console.log('✅ Уведомления успешно обновлены при открытии панели')
      })
      .catch((error) => {
        console.error('❌ Ошибка при обновлении уведомлений при открытии панели:', error)
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsRefreshingOnOpen(false)
        }
      })
  }, [hasPanelBeenOpened, userId, refetch])

  // Фильтрация уведомлений
  const filteredNotifications = useMemo(() => {
    // В обычном режиме применяем все фильтры
    const allFiltered = dedupedNotifications.filter((notification) => {
      // Фильтр по типам на клиенте отключен: доверяем серверу при выбранных типах,
      // а при отсутствии выбранных типов показываем все
      const matchesType = true
      
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
      
      return matchesType && matchesRead
    }).sort((a, b) => {
      // Стабильная сортировка: сначала по дате, затем по id для детерминизма
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (diff !== 0) return diff
      if (a.id === b.id) return 0
      return a.id < b.id ? -1 : 1
    })

    // Обновляем общее количество отфильтрованных
    allFilteredRef.current = allFiltered.length

    // В режиме клиентских фильтров отдаем только видимую часть
    if (isClientFilterMode) {
      return allFiltered.slice(0, visibleFilteredCount)
    }

    return allFiltered
  }, [dedupedNotifications, readFilter, isClientFilterMode, visibleFilteredCount])

  // Дебаг-списки отключены

  // При входе в режим клиентских фильтров просто сбрасываем лимит (без принудительной полной предзагрузки)
  useEffect(() => {
    if (isClientFilterMode) {
      setVisibleFilteredCount(10)
    }
  }, [isClientFilterMode])

  // Обновление уведомлений
  const handleRefresh = async () => {
    // Отображаем полноэкранный индикатор загрузки в панели
    setIsManualRefreshing(true)
    return Sentry.startSpan(
      {
        op: "ui.click",
        name: "Refresh Notifications",
      },
      async (span) => {
        try {
          span.setAttribute("refresh.trigger", "manual")
          span.setAttribute("notifications.current_count", notifications.length)

          await refetch()

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
        } finally {
          // Скрываем уведомления и показываем спиннер только в период ручного обновления
          setIsManualRefreshing(false)
        }
      }
    )
  }

  // Проверяем, есть ли активные фильтры
  const hasActiveFilters = selectedTypes.size > 0 || readFilter !== 'all'

  return (
    <div
      ref={panelRef}
      className={cn(
        // Фиксированная панель на всю высоту экрана, располагается сразу справа от сайдбара
        "fixed inset-y-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg z-50",
      )}
      // Панель без дебаг-колонки
      style={{ width: panelWidthPx, left: collapsed ? 80 : 256 }}
      onMouseMove={(e) => throttledSetPointerPosition({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => clearPointerPosition()}
    >
      {/* Контент панели: header + scrollable list, full height */}
      <div className="flex h-full flex-col">
        {/* Заголовок + компактные фильтры */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {(isRefreshingOnOpen || isManualRefreshing) ? "Обновление уведомлений..." : "Уведомления"}
            </h3>
            <div className="flex items-center gap-2">
              {/* Кнопка создания объявлений */}
              {canManageAnnouncements && (
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
                disabled={isLoading || isRefreshingOnOpen || isManualRefreshing}
                className="h-6 w-6"
              >
                <RefreshCw className={cn("h-4 w-4", (isLoading || isRefreshingOnOpen || isManualRefreshing) && "animate-spin")} />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleClose} className="h-6 w-6">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Компактные фильтры под кнопками действий */}
          <div className="mt-2 flex items-center gap-2">
            {/* Фильтр по статусу (иконка-меню) */}
            <Popover open={isReadFilterOpen} onOpenChange={setIsReadFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "relative h-8 w-8",
                    readFilter !== 'all' && "text-blue-600 border-blue-300 dark:text-blue-400"
                  )}
                  aria-label="Фильтр уведомлений"
                  title="Фильтр уведомлений"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
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
                  className="relative h-8 w-8"
                >
                  <Filter className="h-3.5 w-3.5" />
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
                          {isLoadingTypeCounts
                            ? '.'.repeat(loadingDots)
                            : (typeCounts[type.value] || 0)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>



        {/* Основная зона: список уведомлений */}
        <div className="flex-1 flex overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {(isLoading || isManualRefreshing) ? (
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
                      {"Сбросить фильтры"}
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
                    onClosePanel={handleClose}
                  />
                ))}
                
                {/* Индикатор загрузки дополнительных уведомлений */}
                {isLoadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Загрузка...</span>
                  </div>
                )}
                
                {/* Сообщение о том, что все уведомления загружены */}
                {!hasMore && filteredNotifications.length > 0 && (
                  <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                    Все уведомления загружены
                  </div>
                )}
                {/* Триггер для догрузки при достижении низа (страховка) */}
                {hasMore && !isLoadingMore && (
                  <div className="flex justify-center py-2">
                    <Button variant="ghost" size="sm" onClick={() => fetchNextPage()}>
                      Загрузить ещё
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно создания/редактирования объявлений */}
      <Modal 
        isOpen={isAnnouncementFormOpen} 
        onClose={handleCloseAnnouncementForm} 
        size="lg"
        closeOnOverlayClick={true}
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
            />
          </div>
        </Modal.Body>
      </Modal>
    </div>
  )
}
