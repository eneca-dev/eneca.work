"use client"

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react"
import { Sidebar } from "@/components/sidebar"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/stores/useUserStore"
import { useNotificationsUiStore } from "@/stores/useNotificationsUiStore"
// Удален import getUserRoleAndPermissions - используем новую систему permissions
import { toast } from "@/components/ui/use-toast"
import { ChatInterface } from "@/modules/chat"
import { UserPermissionsSyncProvider, useUserPermissionsSync } from "@/modules/permissions"
import { PermissionsErrorBoundary } from "@/modules/permissions/components/PermissionsErrorBoundary"
import { NotificationsProvider } from "@/modules/notifications/components/NotificationsProvider"
import { useSidebarState } from "@/hooks/useSidebarState"
import { setSentryUser, clearSentryUser } from "@/utils/sentry"

// УДАЛЕНО: Константы retry логики - упрощение

// Мемоизированный компонент для предотвращения ре-рендера провайдеров и children
const ContentArea = memo(({ children }: { children: React.ReactNode }) => (
  <UserPermissionsSyncProvider>
    <PermissionsManager>
      <NotificationsProvider>
        {children}
      </NotificationsProvider>
    </PermissionsManager>
  </UserPermissionsSyncProvider>
))

ContentArea.displayName = 'ContentArea'

// Внутренний компонент PermissionsManager (будет использоваться внутри ContentArea)
function PermissionsManager({ children }: { children: React.ReactNode }) {
  const { isLoading, error, reloadPermissions } = useUserPermissionsSync()

  // Если есть ошибка загрузки разрешений
  if (error) {
    return (
      <PermissionsErrorBoundary
        error={error}
        onRetry={reloadPermissions}
      />
    )
  }

  // Если загружаем разрешения
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка прав доступа...</p>
        </div>
      </div>
    )
  }

  return children
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebarState()
  const userId = useUserStore((state) => state.id)
  const name = useUserStore((state) => state.name)
  const email = useUserStore((state) => state.email)
  const profile = useUserStore((state) => state.profile)
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  // УДАЛЕНО: Legacy permissions - теперь используем permissions модуль
  const router = useRouter()
  const supabase = createClient()
  
  // Реф для отслеживания актуальности компонента
  const isMounted = useRef(true)
  
  // Очистка при размонтировании
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  // УДАЛЕНО: fetchWithRetry - упрощение логики

  // Обработчик ошибок авторизации
  const handleAuthError = useCallback((error: Error) => {
    if (!isMounted.current) return
    
    console.error("Ошибка авторизации:", error)
    toast({
      title: "Ошибка авторизации",
      description: "Пожалуйста, войдите в систему заново",
      variant: "destructive"
    })
    useUserStore.getState().clearState()
    router.push('/auth/login')
  }, [router, email, name, isAuthenticated])

  // Мемоизированный стиль для контента - предотвращает создание нового объекта при каждом рендере
  const contentStyle = useMemo(() => ({
    marginLeft: sidebarCollapsed ? 80 : 256,
    transition: 'margin-left 300ms cubic-bezier(0.4, 0, 0.2, 1)',
    willChange: 'margin-left' as const
  }), [sidebarCollapsed])

  // Мемоизируем функцию получения пользователя
  const fetchUser = useCallback(async () => {
    if (!isMounted.current) return
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error("Ошибка при получении пользователя:", error)
        router.push('/auth/login')
        return
      }
      
      if (!user) {
        console.log("Пользователь не авторизован")
        router.push('/auth/login')
        return
      }
      
      // Права загружаются через UserPermissionsSyncProvider и usePermissionsStore
      
      // Проверяем, нужно ли обновлять остальные данные пользователя
      const userState = useUserStore.getState()
      const needsRefresh = !userState.id || userState.id !== user.id || !userState.profile || !userState.name
      
      if (needsRefresh) {
        const { data: userData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single()
        
        if (profileError) {
          if (!isMounted.current) return
          
          console.error("Ошибка при получении профиля:", profileError)
          toast({
            title: "Ошибка получения профиля",
            description: "Некоторые данные могут отображаться некорректно",
            variant: "destructive"
          })
        }
        
        try {
          const userName = userData 
            ? [userData.first_name ?? "", userData.last_name ?? ""].filter(Boolean).join(" ") 
            : ""
          const finalName = userName || user.email?.split("@")[0] || "Пользователь"
          
          const userDataToSet = {
            id: user.id,
            email: user.email ?? "",
            name: finalName,
            profile: userData
          }
          
          useUserStore.getState().setUser(userDataToSet)
        } catch (setUserError) {
          console.error("Ошибка при установке данных пользователя:", setUserError)
          toast({
            title: "Ошибка обновления данных",
            description: "Не удалось обновить данные пользователя",
            variant: "destructive"
          })
        }
      }
    } catch (error) {
      if (!isMounted.current) return
      
      console.error("Критическая ошибка при получении данных:", error)
      handleAuthError(error as Error)
    }
  }, [supabase, router, handleAuthError])

  // УДАЛЕНО: Legacy отслеживание permissions
  // Теперь permissions загружаются через modules/permissions

  useEffect(() => {
    if (!mounted) {
      fetchUser()
      setMounted(true)
    }
  }, [mounted, fetchUser])

  // Устанавливаем пользователя в Sentry при изменении данных
  useEffect(() => {
    if (mounted && isAuthenticated && userId && email) {
      const firstName = profile?.firstName || profile?.first_name
      const lastName = profile?.lastName || profile?.last_name
      setSentryUser(userId, email, firstName, lastName)
    } else if (mounted && !isAuthenticated) {
      // Очищаем данные пользователя при выходе
      clearSentryUser()
    }
  }, [mounted, isAuthenticated, userId, email, profile])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Инициализация...</p>
        </div>
      </div>
    )
  }

  const sidebarWidth = sidebarCollapsed ? "w-20" : "w-64"

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Фиксированное меню */}
      <div className={`fixed inset-y-0 left-0 z-40 h-screen ${sidebarWidth} transition-all duration-300`}>
        <Sidebar
          user={{ name: name || "Пользователь", email: email || "" }}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>
      {/* Контент с отступом слева и динамическим отступом слева под панель уведомлений (панель раскрывается справа от сайдбара) */}
      <div className="flex-1 px-0 py-0" style={contentStyle}>
        <ContentArea>{children}</ContentArea>
      </div>
      
      {/* Chat Interface */}
      <ChatInterface />
    </div>
  )
}
