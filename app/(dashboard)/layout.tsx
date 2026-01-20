"use client"

import { useMemo, memo, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { useUserStore } from "@/stores/useUserStore"
import { ChatInterface } from "@/modules/chat"
import { NotificationsProvider } from "@/modules/notifications/components/NotificationsProvider"
import { useSidebarState } from "@/hooks/useSidebarState"
import { useAuthContext } from "@/modules/auth"
import { TopNavbar } from "@/modules/layout"

/**
 * Мемоизированная обёртка для контента
 * NotificationsProvider обеспечивает realtime уведомления
 */
const ContentArea = memo(({ children }: { children: React.ReactNode }) => (
  <NotificationsProvider>
    {children}
  </NotificationsProvider>
))
ContentArea.displayName = 'ContentArea'

// Временный переключатель для тестирования нового навбара
const USE_TOP_NAVBAR = false

/**
 * Layout для dashboard
 *
 * Данные пользователя загружаются централизованно в AuthProvider (ClientProviders)
 * Permissions загружаются в UserPermissionsSyncProvider (ClientProviders)
 *
 * Этот layout только:
 * - Отображает sidebar с данными из store
 * - Управляет состоянием сворачивания sidebar
 * - Рендерит chat interface
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebarState()
  const { isInitialized, isLoading } = useAuthContext()

  // Данные пользователя из store (уже загружены AuthProvider)
  const name = useUserStore((state) => state.name)
  const email = useUserStore((state) => state.email)
  const profile = useUserStore((state) => state.profile)

  // Мемоизированный стиль контента для бокового меню
  const sidebarContentStyle = useMemo(() => ({
    marginLeft: sidebarCollapsed ? 80 : 256,
    transition: 'margin-left 300ms cubic-bezier(0.4, 0, 0.2, 1)',
    willChange: 'margin-left' as const
  }), [sidebarCollapsed])

  // Стиль контента для верхнего навбара
  const topNavbarContentStyle = useMemo(() => ({
    paddingTop: 60, // высота топ навбара
  }), [])

  // Показываем загрузку пока AuthProvider инициализируется
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Инициализация...</p>
        </div>
      </div>
    )
  }

  // Новый layout с верхним навбаром
  if (USE_TOP_NAVBAR) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-200">
        {/* Верхний навбар */}
        <TopNavbar
          user={{
            name: name || "Пользователь",
            email: email || "",
            avatarUrl: profile?.avatar_url,
          }}
        />

        {/* Контент */}
        <div className="flex-1 px-0 py-0" style={topNavbarContentStyle}>
          <ContentArea>{children}</ContentArea>
        </div>

        {/* Chat Interface */}
        <ChatInterface />
      </div>
    )
  }

  // Старый layout с боковым меню
  const sidebarWidth = sidebarCollapsed ? "w-20" : "w-64"

  return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      {/* Фиксированное меню */}
      <div className={`fixed inset-y-0 left-0 z-40 h-screen ${sidebarWidth} transition-all duration-300`}>
        <Sidebar
          user={{ name: name || "Пользователь", email: email || "" }}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Контент */}
      <div className="flex-1 px-0 py-0" style={sidebarContentStyle}>
        <ContentArea>{children}</ContentArea>
      </div>

      {/* Chat Interface */}
      <ChatInterface />
    </div>
  )
}
