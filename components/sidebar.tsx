"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { LogOut, User, Home, Calendar, Send, ChevronLeft, Settings, BarChart } from "lucide-react"
import { createClient } from "@/utils/supabase/client"

interface SidebarProps {
  user: {
    name: string
    email: string
  }
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ user, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push("/auth/login")
  }

  const menuItems = [
    {
      title: "Главная",
      href: "/dashboard",
      icon: Home,
    },
    {
      title: "Система планирования",
      href: "/dashboard/planning",
      icon: Calendar,
    },
    {
      title: "Передача заданий",
      href: "/dashboard/tasks",
      icon: Send,
    },
    {
      title: "Прогресс проектов",
      href: "/dashboard/progress",
      icon: BarChart,
    },
  ]

  const isSettingsActive = pathname === "/dashboard/settings"

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
        <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
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
          <Button
            variant="ghost"
            size="icon"
            className={cn("ml-auto h-8 w-8", collapsed && "rotate-180")}
            onClick={onToggle}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
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

        {/* User and Theme */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className={cn("flex items-center", collapsed ? "flex-col space-y-2" : "space-x-3")}>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate dark:text-gray-200">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
              </div>
            )}
          </div>

          {collapsed ? (
            <div className="mt-4 flex flex-col items-center space-y-2">
              <ThemeToggle />

              <Link href="/dashboard/settings">
                <Button
                  variant={isSettingsActive ? "secondary" : "ghost"}
                  size="icon"
                  className={`h-9 w-9 ${isSettingsActive ? "bg-primary/10 text-primary" : ""}`}
                >
                  <Settings className={`h-4 w-4 ${isSettingsActive ? "text-primary" : "text-gray-600 dark:text-gray-400"}`} />
                </Button>
              </Link>

              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <ThemeToggle />
                <Link href="/dashboard/settings">
                  <Button
                    variant={isSettingsActive ? "secondary" : "ghost"}
                    size="icon"
                    className={`h-9 w-9 ${isSettingsActive ? "bg-primary/10 text-primary" : ""}`}
                  >
                    <Settings className={`h-4 w-4 ${isSettingsActive ? "text-primary" : "text-gray-600 dark:text-gray-400"}`} />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleLogout}>
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
