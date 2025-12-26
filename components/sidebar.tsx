"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/ui/user-avatar"
import { LogOut, Home, ChevronLeft, BarChart, Users, MessageSquare, FolderOpen, CalendarDays, List, FileText, LineChart, Columns3 } from "lucide-react"
import { useUserStore } from "@/stores/useUserStore"
import { WeeklyCalendar } from "@/components/weekly-calendar"
import { NotificationBell } from "@/modules/notifications/components/NotificationBell"
import { useAuthContext } from "@/modules/auth"

interface SidebarProps {
  user: {
    name: string
    email: string
  }
  collapsed: boolean
  onToggle: () => void
  isUsersActive?: boolean
  handleLogout?: () => void
}

export function Sidebar({ user, collapsed, onToggle, isUsersActive, handleLogout }: SidebarProps) {
  const pathname = usePathname()
  const { signOut } = useAuthContext()

  // Получаем данные из store
  const { id: userId, name: storeName, email: storeEmail, profile } = useUserStore()

  // Проверяем доступ к аналитике через API
  const [hasAnalyticsAccess, setHasAnalyticsAccess] = useState(false)
  const [accessCheckDone, setAccessCheckDone] = useState(false)

  useEffect(() => {
    if (!userId || accessCheckDone) {
      if (!userId) {
        setHasAnalyticsAccess(false)
      }
      return
    }

    const abortController = new AbortController()
    let timeoutId: NodeJS.Timeout

    const checkAnalyticsAccess = async () => {
      try {
        const response = await fetch('/api/feedback-analytics/access', {
          signal: abortController.signal,
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (abortController.signal.aborted) return

        if (!response.ok) {
          if (!abortController.signal.aborted) {
            setHasAnalyticsAccess(false)
            setAccessCheckDone(true)
          }
          return
        }

        const data = await response.json()

        if (!abortController.signal.aborted) {
          setHasAnalyticsAccess(data.hasAccess)
          setAccessCheckDone(true)
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        if (!abortController.signal.aborted) {
          setHasAnalyticsAccess(false)
          setAccessCheckDone(true)
        }
      }
    }

    timeoutId = setTimeout(checkAnalyticsAccess, 100)

    return () => {
      clearTimeout(timeoutId)
      abortController.abort()
    }
  }, [userId, accessCheckDone])

  // Данные для отображения — приоритет: store > props > defaults
  const displayName = storeName || user.name || "Пользователь"
  const displayEmail = storeEmail || user.email || ""
  const avatarUrl = profile?.avatar_url || null

  // Обработчик выхода — использует AuthProvider
  const handleLogoutInternal = async () => {
    if (handleLogout) {
      handleLogout()
      return
    }
    // signOut из AuthProvider очистит все stores и сделает редирект
    await signOut()
  }

  const menuItems = [
    { title: "Главная", href: "/dashboard", icon: Home },
    { title: "Проекты", href: "/dashboard/projects", icon: FolderOpen },
    { title: "Планирование", href: "/dashboard/planning", icon: CalendarDays },
    { title: "Канбан", href: "/dashboard/kanban", icon: Columns3 },
    { title: "Заметки", href: "/dashboard/notions", icon: List },
    { title: "Отчёты", href: "/dashboard/reports", icon: BarChart },
  ]

  const isUsersActiveInternal = isUsersActive ?? pathname === "/dashboard/users"

  return (
    <div
      data-sidebar
      className={cn(
        "h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className={cn("p-4", collapsed ? "flex flex-col items-center space-y-3" : "flex items-center")}>
          <div className={cn("flex items-center", collapsed ? "justify-center" : "")}>
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image__10_-removebg-preview-DH3poORK5SwnmDnICGNszX6XADuVhH.png"
              alt="eneca.work Logo"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            {!collapsed && (
              <h1 className="text-xl font-mono ml-3">
                <span className="text-primary">eneca</span>
                <span className="dark:text-gray-200">.work</span>
              </h1>
            )}
            {!collapsed && (
              <div className="ml-auto mr-2">
                <NotificationBell collapsed={collapsed} />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", collapsed ? "ml-2" : "", collapsed && "rotate-180")}
              onClick={onToggle}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          {collapsed && (
            <div className="flex justify-center">
              <NotificationBell collapsed={collapsed} />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 nav-item transition-colors",
                    pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <item.icon className={cn("h-5 w-5", collapsed ? "mr-0" : "mr-3")} />
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Аналитика */}
        {hasAnalyticsAccess && (
          <div className="px-2 mt-2">
            <Link
              href="/dashboard/feedback-analytics"
              className={cn(
                "flex items-center rounded-md px-3 py-2 nav-item transition-colors w-full",
                pathname === "/dashboard/feedback-analytics"
                  ? "bg-primary/10 text-primary"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
                collapsed && "justify-center px-0"
              )}
            >
              <LineChart className={cn("h-5 w-5", collapsed ? "mr-0" : "mr-3")} />
              {!collapsed && <span>Аналитика</span>}
            </Link>
          </div>
        )}

        {/* Документация */}
        <div className="px-2 mt-2">
          <Link
            href="/dashboard/user-docs"
            className={cn(
              "flex items-center rounded-md px-3 py-2 nav-item transition-colors w-full",
              pathname === "/dashboard/user-docs"
                ? "bg-primary/10 text-primary"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
              collapsed && "justify-center px-0"
            )}
          >
            <FileText className={cn("h-5 w-5", collapsed ? "mr-0" : "mr-3")} />
            {!collapsed && <span>Документация</span>}
          </Link>
        </div>

        {/* Сообщить о проблеме */}
        <div className="px-2 mt-2">
          <Link
            href="/dashboard/report"
            className={cn(
              "flex items-center rounded-md px-3 py-2 nav-item transition-colors w-full",
              pathname === "/dashboard/report"
                ? "bg-primary/10 text-primary"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
              collapsed && "justify-center px-0"
            )}
          >
            <MessageSquare className={cn("h-5 w-5", collapsed ? "mr-0" : "mr-3")} />
            {!collapsed && <span>Сообщить о проблеме</span>}
          </Link>
        </div>

        {/* Weekly Calendar */}
        <WeeklyCalendar collapsed={collapsed} />

        {/* User and Theme */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className={cn("flex items-center", collapsed ? "flex-col space-y-2" : "space-x-3")}>
            <UserAvatar
              avatarUrl={avatarUrl}
              name={displayName}
              email={displayEmail}
              size="md"
              className="flex-shrink-0"
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="list-item-title truncate dark:text-gray-200">{displayName}</p>
                <p className="metadata truncate">{displayEmail}</p>
              </div>
            )}
          </div>

          {collapsed ? (
            <div className="mt-4 flex flex-col items-center space-y-2">
              <ThemeToggle />

              <Link href="/dashboard/users">
                <Button
                  variant={isUsersActiveInternal ? "secondary" : "ghost"}
                  size="icon"
                  className={`h-9 w-9 ${isUsersActiveInternal ? "bg-primary/10 text-primary" : ""}`}
                >
                  <Users className={`h-4 w-4 ${isUsersActiveInternal ? "text-primary" : "text-gray-600 dark:text-gray-400"}`} />
                </Button>
              </Link>

              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleLogoutInternal}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <ThemeToggle />

                <Link href="/dashboard/users">
                  <Button
                    variant={isUsersActiveInternal ? "secondary" : "ghost"}
                    size="icon"
                    className={`h-9 w-9 ${isUsersActiveInternal ? "bg-primary/10 text-primary" : ""}`}
                  >
                    <Users className={`h-4 w-4 ${isUsersActiveInternal ? "text-primary" : "text-gray-600 dark:text-gray-400"}`} />
                  </Button>
                </Link>

                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleLogoutInternal}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
