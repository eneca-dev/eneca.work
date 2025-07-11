"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useNotificationsStore } from "@/stores/useNotificationsStore"
import { NotificationItem } from "./NotificationItem"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Search, Loader2, RefreshCw } from "lucide-react"

interface NotificationsPanelProps {
  onClose: () => void
  collapsed?: boolean
}

export function NotificationsPanel({ onClose, collapsed = false }: NotificationsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const panelRef = useRef<HTMLDivElement>(null)

  const { 
    notifications, 
    isLoading, 
    error, 
    fetchNotifications, 
    markAllAsRead,
    markAllAsReadInDB,
    clearAll 
  } = useNotificationsStore()

  // Закрытие панели при клике вне её
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  // Фильтрация уведомлений по поисковому запросу
  const filteredNotifications = notifications
    .filter(
      (notification) =>
        notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notification.message.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Обновление уведомлений
  const handleRefresh = async () => {
    await fetchNotifications()
  }



  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute top-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50",
        collapsed ? "left-0 w-80" : "left-0 w-96",
      )}
    >
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
          <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Поиск */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Поиск уведомлений..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Действия */}
      {notifications.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Всего: {filteredNotifications.length}
            </span>
          </div>
        </div>
      )}

      {/* Список уведомлений */}
      <div className="h-80 overflow-y-auto">
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
            {searchQuery ? "Уведомления не найдены" : "Нет уведомлений"}
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredNotifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
