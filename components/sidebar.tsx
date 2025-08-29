"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useLocalStorage } from "usehooks-ts"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/ui/user-avatar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, Home, Calendar, Send, ChevronLeft, BarChart, Users, Bug, MessageSquare, Settings, FolderOpen, CalendarDays, ClipboardList, ChevronsLeft, ChevronsRight, LayoutDashboard, List, FileText } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { useUserStore } from "@/stores/useUserStore"
import { WeeklyCalendar } from "@/components/weekly-calendar"
import { NotificationBell } from "@/modules/notifications/components/NotificationBell"

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

interface ListItemProps {
  label: string
  icon: any
  active: boolean
  collapsed: boolean
}

function ListItem({ label, icon: Icon, active, collapsed }: ListItemProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full p-2",
        collapsed ? "justify-center" : "justify-start",
        active ? "bg-primary/5 text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="mr-2 h-4 w-4" />
      {!collapsed && label}
    </Button>
  )
}

interface UserAvatarInternalProps {
  avatarUrl: string | null
  name: string | null
  email: string | null
  size: "sm" | "md" | "lg"
  className?: string
}

function UserAvatarInternal({ avatarUrl, name, email, size, className }: UserAvatarInternalProps) {
  let avatarSize = "h-8 w-8"
  let avatarFontSize = "text-sm"

  switch (size) {
    case "sm":
      avatarSize = "h-6 w-6"
      avatarFontSize = "text-xs"
      break
    case "md":
      avatarSize = "h-8 w-8"
      avatarFontSize = "text-sm"
      break
    case "lg":
      avatarSize = "h-10 w-10"
      avatarFontSize = "text-base"
      break
  }

  return (
    <Avatar className={cn(avatarSize, className)}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl || "/placeholder.svg"} alt={name || "Avatar"} />
      ) : (
        <AvatarFallback className={avatarFontSize}>{name ? name[0] : email ? email[0] : "U"}</AvatarFallback>
      )}
    </Avatar>
  )
}

export function Sidebar({ user, collapsed, onToggle, isUsersActive, handleLogout }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  
  // Получаем данные из store
  const { name: storeName, email: storeEmail, profile } = useUserStore()
  
  // Используем данные из store, если они есть, иначе из props
  const displayName = storeName || user.name || "Пользователь"
  const displayEmail = storeEmail || user.email || ""
  const avatarUrl = profile?.avatar_url || null

  // Локальное состояние для localStorage данных
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null)
  const [localDisplayName, setLocalDisplayName] = useState<string | null>(null)
  const [localDisplayEmail, setLocalDisplayEmail] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    const storedAvatarUrl = localStorage.getItem("avatarUrl")
    const storedDisplayName = localStorage.getItem("displayName")
    const storedDisplayEmail = localStorage.getItem("displayEmail")

    if (storedAvatarUrl) {
      setLocalAvatarUrl(storedAvatarUrl)
    }
    if (storedDisplayName) {
      setLocalDisplayName(storedDisplayName)
    }
    if (storedDisplayEmail) {
      setLocalDisplayEmail(storedDisplayEmail)
    }
  }, [])

  const handleLogoutInternal = async () => {
    if (handleLogout) {
      handleLogout()
    } else {
      await supabase.auth.signOut()
      router.push("/auth/login")
    }
  }

  const menuItems = [
    {
      title: "Главная",
      href: "/dashboard",
      icon: Home,
    },
    {
      title: "Проекты",
      href: "/dashboard/projects",
      icon: FolderOpen,
    },
    {
      title: "Планирование",
      href: "/dashboard/planning",
      icon: CalendarDays,
    },
    {
      title: "Заметки",
      href: "/dashboard/notions",
      icon: List,
    },
    {
      title: "Отчёты",
      href: "/dashboard/reports",
      icon: BarChart,
    },

  ]

  const isSettingsActive = pathname === "/dashboard/settings"
  const isUsersActiveInternal = isUsersActive ?? pathname === "/dashboard/users"
  const isDebugActive = pathname === "/dashboard/debug"
  const isReportActive = pathname === "/dashboard/report"

  // Используем локальные данные только после монтирования
  const finalAvatarUrl = mounted ? (localAvatarUrl || avatarUrl) : avatarUrl
  const finalDisplayName = mounted ? (localDisplayName || displayName) : displayName
  const finalDisplayEmail = mounted ? (localDisplayEmail || displayEmail) : displayEmail

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
          {/* Notifications Bell for collapsed state */}
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
              avatarUrl={finalAvatarUrl}
              name={finalDisplayName}
              email={finalDisplayEmail}
              size="md"
              className="flex-shrink-0"
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="list-item-title truncate dark:text-gray-200">{finalDisplayName}</p>
                <p className="metadata truncate">{finalDisplayEmail}</p>
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
