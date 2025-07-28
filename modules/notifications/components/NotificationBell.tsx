"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNotificationsStore } from "@/stores"
import { NotificationsPanel } from "./NotificationsPanel"
import { cn } from "@/lib/utils"

interface NotificationBellProps {
  collapsed?: boolean
}

export function NotificationBell({ collapsed = false }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const unreadCount = useNotificationsStore((state) => state.unreadCount)
  
  // Проверяем, что компонент полностью гидратировался
  useEffect(() => {
    setMounted(true)
  }, [])

  // Показываем только после монтирования, чтобы избежать проблем с гидратацией
  const hasUnread = mounted && unreadCount > 0

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "relative h-9 w-9 transition-colors",
          hasUnread && "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300",
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className={cn("h-4 w-4", hasUnread && "animate-pulse")} />
        {hasUnread && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 text-xs font-medium text-white flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && <NotificationsPanel onClose={() => setIsOpen(false)} collapsed={collapsed} />}
    </div>
  )
}
