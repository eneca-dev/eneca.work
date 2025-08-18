"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import * as Sentry from "@sentry/nextjs"
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
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const name = useUserStore((state) => state.name)
  const email = useUserStore((state) => state.email)
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  const permissions = useUserStore((state) => state.permissions)
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
    
    Sentry.captureException(error, {
      tags: {
        module: 'dashboard_layout',
        action: 'handle_auth_error',
        component: 'DashboardLayout',
        critical: true
      },
      extra: {
        error_message: error.message,
        error_stack: error.stack,
        user_email: email,
        user_name: name,
        is_authenticated: isAuthenticated,
        timestamp: new Date().toISOString()
      },
      level: 'error'
    })
    
    toast({
      title: "Ошибка авторизации",
      description: "Пожалуйста, войдите в систему заново",
      variant: "destructive"
    })
    useUserStore.getState().clearState()
    router.push('/auth/login')
  }, [router, email, name, isAuthenticated])

  // Функция получения разрешений с правильной обработкой race condition
  const fetchPermissions = useCallback(async (userId: string): Promise<FetchPermissionsResult | null> => {
    return Sentry.startSpan(
      {
        op: "auth.permissions",
        name: "Получение разрешений пользователя",
      },
      async (span) => {
        try {
          span.setAttribute("user.id", userId)
          
          const { roleId, permissions } = await getUserRoleAndPermissions(userId, supabase)
          
          if (!isMounted.current) {
            span.setAttribute("component.unmounted", true)
            return null
          }
          
          span.setAttribute("role.id", roleId || "none")
          span.setAttribute("permissions.count", permissions.length)
          span.setAttribute("permissions.list", permissions.join(','))
          
          if (roleId) {
            useUserStore.getState().setRoleAndPermissions(roleId, permissions)
            console.log("Роль и разрешения обновлены:", { roleId, permissions })
          } else {
            // Даже если нет roleId, устанавливаем пустые права
            useUserStore.getState().setRoleAndPermissions(null, [])
            console.log("Установлены пустые разрешения для пользователя")
          }
          
          // Устанавливаем флаг загрузки прав
          setPermissionsLoaded(true)
          span.setAttribute("permissions.loaded", true)
          
          return { roleId, permissions }
        } catch (error) {
          span.setAttribute("error", true)
          span.setAttribute("error.message", (error as Error).message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'dashboard_layout',
              action: 'fetch_permissions',
              component: 'DashboardLayout'
            },
            extra: {
              user_id: userId,
              error_message: (error as Error).message,
              timestamp: new Date().toISOString()
            }
          })
          
          // Даже при ошибке устанавливаем флаг загрузки
          setPermissionsLoaded(true)
          throw error
        }
      }
    )
  }, [supabase])

  // Мемоизируем функцию получения пользователя
  const fetchUser = useCallback(async () => {
    if (!isMounted.current) return
    
    return Sentry.startSpan(
      {
        op: "auth.user",
        name: "Получение и инициализация пользователя",
      },
      async (span) => {
        try {
          const { data: { user }, error } = await supabase.auth.getUser()
          
          if (error) {
            span.setAttribute("auth.error", true)
            span.setAttribute("auth.error_message", error.message)
            
            Sentry.captureException(error, {
              tags: {
                module: 'dashboard_layout',
                action: 'get_user',
                component: 'DashboardLayout',
                error_type: 'auth_user_error'
              },
              extra: {
                error_message: error.message,
                timestamp: new Date().toISOString()
              }
            })
            router.push('/auth/login')
            return
          }
          
          if (!user) {
            span.setAttribute("user.exists", false)
            console.log("Пользователь не авторизован")
            router.push('/auth/login')
            return
          }
          
          span.setAttribute("user.exists", true)
          span.setAttribute("user.id", user.id)
          span.setAttribute("user.email", user.email || '')
      
          // Получаем разрешения с retry логикой
          try {
            await fetchWithRetry(() => fetchPermissions(user.id))
            span.setAttribute("permissions.fetch_success", true)
          } catch (error) {
            if (!isMounted.current) return
            
            span.setAttribute("permissions.fetch_error", true)
            Sentry.captureException(error, {
              tags: {
                module: 'dashboard_layout',
                action: 'fetch_permissions_retry',
                component: 'DashboardLayout',
                error_type: 'permissions_retry_failed'
              },
              extra: {
                user_id: user.id,
                user_email: user.email,
                max_retries: MAX_RETRIES,
                error_message: (error as Error).message,
                timestamp: new Date().toISOString()
              }
            })
            
            // Устанавливаем флаг загрузки даже при ошибке
            setPermissionsLoaded(true)
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
          
          span.setAttribute("profile.fetch_error", true)
          Sentry.captureException(profileError, {
            tags: {
              module: 'dashboard_layout',
              action: 'fetch_profile',
              component: 'DashboardLayout',
              error_type: 'profile_fetch_error'
            },
            extra: {
              user_id: user.id,
              user_email: user.email,
              error_message: profileError.message,
              error_code: profileError.code,
              timestamp: new Date().toISOString()
            }
          })
          
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
          span.setAttribute("user.set_error", true)
          Sentry.captureException(setUserError, {
            tags: {
              module: 'dashboard_layout',
              action: 'set_user_data',
              component: 'DashboardLayout',
              error_type: 'user_data_update_error'
            },
            extra: {
              user_id: user.id,
              user_email: user.email,
              profile_exists: !!userData,
              error_message: (setUserError as Error).message,
              timestamp: new Date().toISOString()
            }
          })
          
          toast({
            title: "Ошибка обновления данных",
            description: "Не удалось обновить данные пользователя",
            variant: "destructive"
          })
        }
      }
        } catch (error) {
          if (!isMounted.current) return
          
          span.setAttribute("critical_error", true)
          span.setAttribute("critical_error_message", (error as Error).message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'dashboard_layout',
              action: 'fetch_user_critical',
              component: 'DashboardLayout',
              error_type: 'critical_user_fetch_error',
              critical: true
            },
            extra: {
              error_message: (error as Error).message,
              error_stack: (error as Error).stack,
              timestamp: new Date().toISOString()
            }
          })
          
          handleAuthError(error as Error)
        }
      }
    )
  }, [supabase, fetchWithRetry, fetchPermissions, router, handleAuthError])

  // Отслеживаем загрузку прав из store (для случая когда они уже были загружены ранее)
  useEffect(() => {
    if (isAuthenticated && permissions !== null) {
      setPermissionsLoaded(true)
    }
  }, [permissions, isAuthenticated])

  // Fallback timeout для случаев когда права не загрузятся
  useEffect(() => {
    if (mounted && !permissionsLoaded) {
      const fallbackTimer = setTimeout(() => {
        Sentry.captureMessage("Timeout при загрузке прав, продолжаем без них", {
          level: 'warning',
          tags: {
            module: 'dashboard_layout',
            action: 'permissions_timeout',
            component: 'DashboardLayout'
          },
          extra: {
            timeout_duration: 5000,
            user_email: email,
            user_name: name,
            is_authenticated: isAuthenticated,
            timestamp: new Date().toISOString()
          }
        })
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
