"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Sidebar } from "@/components/sidebar"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/stores/useUserStore"
import { getUserRoleAndPermissions } from "@/utils/role-utils"
import { toast } from "@/components/ui/use-toast"

// Константы для retry логики
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000
const MAX_RETRY_DELAY = 5000

// Типы для улучшения типизации
interface FetchPermissionsResult {
  roleId: string | null;
  permissions: string[];
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const name = useUserStore((state) => state.name)
  const email = useUserStore((state) => state.email)
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  const router = useRouter()
  const supabase = createClient()
  
  // Реф для отслеживания актуальности компонента
  const isMounted = useRef(true)
  
  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  // Функция для повторных попыток с exponential backoff
  const fetchWithRetry = useCallback(async <T,>(
    operation: () => Promise<T>,
    retries = MAX_RETRIES
  ): Promise<T> => {
    let lastError: Error | null = null
    
    for (let i = 0; i < retries && isMounted.current; i++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        if (i === retries - 1) break
        
        // Проверяем, что компонент еще смонтирован перед задержкой
        if (!isMounted.current) break
        
        // Exponential backoff с максимальной задержкой
        const delay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(2, i),
          MAX_RETRY_DELAY
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError
  }, [])

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
  }, [router])

  // Функция получения разрешений с правильной обработкой race condition
  const fetchPermissions = useCallback(async (userId: string): Promise<FetchPermissionsResult | null> => {
    try {
      const { roleId, permissions } = await getUserRoleAndPermissions(userId, supabase)
      
      if (!isMounted.current) return null
      
      if (roleId) {
        useUserStore.getState().setRoleAndPermissions(roleId, permissions)
        console.log("Роль и разрешения обновлены:", { roleId, permissions })
      }
      
      return { roleId, permissions }
    } catch (error) {
      console.error("Ошибка при получении разрешений:", error)
      throw error
    }
  }, [supabase])

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
      
      // Получаем разрешения с retry логикой
      try {
        await fetchWithRetry(() => fetchPermissions(user.id))
      } catch (error) {
        if (!isMounted.current) return
        
        console.error("Не удалось получить разрешения после всех попыток:", error)
        toast({
          title: "Ошибка получения разрешений",
          description: "Попробуйте обновить страницу",
          variant: "destructive"
        })
      }
      
      // Проверяем, нужно ли обновлять остальные данные пользователя
      if (!isMounted.current) return
      
      const userState = useUserStore.getState()
      const needsRefresh = !userState.id || userState.id !== user.id || !userState.profile
      
      if (needsRefresh) {
        console.log("Обновляем данные пользователя в хранилище")
        
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
        
        if (!isMounted.current) return
        
        try {
          useUserStore.getState().setUser({
            id: user.id,
            email: user.email ?? "",
            name: userData ? [userData.first_name ?? "", userData.last_name ?? ""].filter(Boolean).join(" ") : "Пользователь",
            profile: userData
          })
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
  }, [supabase, fetchWithRetry, fetchPermissions, router, handleAuthError])

  useEffect(() => {
    if (!mounted) {
      fetchUser()
      setMounted(true)
    }
  }, [mounted, fetchUser])

  if (!mounted) {
    return null
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
          onToggle={() => setSidebarCollapsed((c) => !c)}
        />
      </div>
      {/* Контент с отступом слева */}
      <div className={`flex-1 p-6 transition-all duration-300 ${marginLeft}`}>
        {children}
      </div>
    </div>
  )
}
