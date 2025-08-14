"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Sidebar } from "@/components/sidebar"
import { createClient } from "@/utils/supabase/client"
import { useRouter, usePathname } from "next/navigation"
import { useUserStore } from "@/stores/useUserStore"
// Удален import getUserRoleAndPermissions - используем новую систему permissions
import { toast } from "@/components/ui/use-toast"
import { UserPermissionsSyncProvider } from "@/modules/permissions"
import { useSidebarState } from "@/hooks/useSidebarState"

// УДАЛЕНО: Константы retry логики - упрощение

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebarState()
  const name = useUserStore((state) => state.name)
  const email = useUserStore((state) => state.email)
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  // УДАЛЕНО: Legacy permissions - теперь используем permissions модуль
  const router = useRouter()
  const supabase = createClient()
  const pathname = usePathname()
  
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
    console.error("❌ DashboardLayout: Ошибка авторизации:", error)
    toast({
      title: "Ошибка авторизации",
      description: "Пожалуйста, войдите в систему заново",
      variant: "destructive"
    })
    useUserStore.getState().clearState()
    router.push('/auth/login')
  }, [router])

  // УДАЛЕНО: Legacy функция получения разрешений
  // Теперь разрешения загружаются через permissions модуль

  // Мемоизируем функцию получения пользователя
  const fetchUser = useCallback(async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error("DashboardLayout: Ошибка при получении пользователя:", error)
        router.push('/auth/login')
        return
      }
      
      if (!user) {
        console.log("DashboardLayout: Пользователь не авторизован")
        router.push('/auth/login')
        return
      }
      
      // УДАЛЕНО: Legacy загрузка разрешений
      // Теперь разрешения автоматически загружаются через permissions модуль
      setPermissionsLoaded(true) // Временно, пока не подключим новую систему
      
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
          console.error("DashboardLayout: Ошибка при получении профиля:", profileError)
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
          console.error("DashboardLayout: Ошибка при установке данных пользователя:", setUserError)
          toast({
            title: "Ошибка обновления данных",
            description: "Не удалось обновить данные пользователя",
            variant: "destructive"
          })
        }
      }
    } catch (error) {
      console.error("DashboardLayout: Критическая ошибка при получении данных:", error)
      handleAuthError(error as Error)
    }
  }, [supabase, router, handleAuthError])

  // УДАЛЕНО: Legacy отслеживание permissions
  // Теперь permissions загружаются через modules/permissions

  // Fallback timeout для случаев когда права не загрузятся
  useEffect(() => {
    if (mounted && !permissionsLoaded) {
      const fallbackTimer = setTimeout(() => {
        console.warn("Timeout при загрузке прав, продолжаем без них")
        setPermissionsLoaded(true)
      }, 5000) // 5 секунд максимум

      return () => clearTimeout(fallbackTimer)
    }
  }, [mounted, permissionsLoaded])

  useEffect(() => {
    if (!mounted) {
      fetchUser()
      setMounted(true)
    }
  }, [mounted, fetchUser])

  if (!mounted || !permissionsLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {!mounted ? "Инициализация..." : "Загрузка прав доступа..."}
          </p>
        </div>
      </div>
    )
  }

  const sidebarWidth = sidebarCollapsed ? "w-20" : "w-64"
  const marginLeft = sidebarCollapsed ? "ml-20" : "ml-64"

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
      {/* Контент с отступом слева */}
      <div className={`flex-1 ${pathname?.startsWith('/dashboard/reports') || pathname?.startsWith('/dashboard/notions') ? 'px-0' : 'px-0 md:px-6'} ${pathname?.startsWith('/dashboard/reports') || pathname?.startsWith('/dashboard/notions') ? 'py-0' : 'py-6'} transition-all duration-300 ${marginLeft}`}>
        <UserPermissionsSyncProvider>
          {children}
        </UserPermissionsSyncProvider>
      </div>
    </div>
  )
}
